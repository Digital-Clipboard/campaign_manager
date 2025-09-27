import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export async function createServer() {
  const server = fastify({
    logger: false,
  });

  // Initialize Prisma
  const prisma = new PrismaClient();

  // Register basic plugins
  await server.register(require('@fastify/cors'), {
    origin: true,
  });

  await server.register(require('@fastify/helmet'));

  // Basic health check route
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'campaign-manager',
      version: '1.0.0'
    };
  });

  // Basic root route
  server.get('/', async (request, reply) => {
    return {
      service: 'Campaign Manager',
      version: '1.0.0',
      status: 'running',
      documentation: '/api/docs'
    };
  });

  // Enhanced MCP endpoint with database functionality
  server.post('/mcp', async (request, reply) => {
    const { tool, params = {} } = request.body as any;

    try {
      switch (tool) {
        case 'listCampaigns': {
          const campaigns = await prisma.campaign.findMany({
            take: params.limit || 10,
            skip: params.offset || 0,
            include: {
              tasks: {
                select: { id: true, title: true, status: true }
              }
            }
          });

          const total = await prisma.campaign.count();

          return {
            success: true,
            data: {
              campaigns,
              total,
              message: campaigns.length > 0 ? `Found ${campaigns.length} campaigns` : 'No campaigns found - database connected successfully'
            }
          };
        }

        case 'createCampaign': {
          const { name, type, targetDate, objectives, priority, description } = params;

          if (!name || !type || !targetDate) {
            return {
              success: false,
              error: 'Missing required fields: name, type, targetDate'
            };
          }

          const campaign = await prisma.campaign.create({
            data: {
              name,
              type: type || 'custom',
              targetDate: new Date(targetDate),
              objectives: objectives || [],
              priority: priority || 'medium',
              description: description || '',
              stakeholders: [],
              readinessScore: 0,
              createdBy: 'mcp-user',
              updatedBy: 'mcp-user'
            }
          });

          return {
            success: true,
            data: {
              campaign,
              message: `Campaign '${name}' created successfully`
            }
          };
        }

        case 'getCampaign': {
          const { campaignId } = params;

          if (!campaignId) {
            return {
              success: false,
              error: 'Missing required field: campaignId'
            };
          }

          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
              tasks: true,
              timeline: true,
              approvals: true
            }
          });

          if (!campaign) {
            return {
              success: false,
              error: `Campaign with ID '${campaignId}' not found`
            };
          }

          return {
            success: true,
            data: { campaign }
          };
        }

        default:
          return {
            success: false,
            error: `Tool '${tool}' not implemented`,
            availableTools: ['listCampaigns', 'createCampaign', 'getCampaign']
          };
      }
    } catch (error) {
      logger.error('MCP endpoint error', { tool, error: error.message });
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
  });

  return server;
}