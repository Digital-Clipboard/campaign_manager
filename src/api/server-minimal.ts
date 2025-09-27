import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export async function createServer() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    },
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
    const startTime = Date.now();

    // Log incoming request
    logger.info('MCP request received', {
      tool,
      paramsKeys: Object.keys(params),
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

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

          const response = {
            success: true,
            data: {
              campaigns,
              total,
              message: campaigns.length > 0 ? `Found ${campaigns.length} campaigns` : 'No campaigns found - database connected successfully'
            }
          };

          logger.info('MCP request completed', {
            tool,
            success: true,
            duration: Date.now() - startTime,
            resultCount: campaigns.length
          });

          return response;
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

        case 'createTask': {
          const { campaignId, title, description, dueDate, priority, assigneeId } = params;

          if (!campaignId || !title || !dueDate) {
            return {
              success: false,
              error: 'Missing required fields: campaignId, title, dueDate'
            };
          }

          // Verify campaign exists
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
          });

          if (!campaign) {
            return {
              success: false,
              error: `Campaign with ID '${campaignId}' not found`
            };
          }

          const task = await prisma.task.create({
            data: {
              campaignId,
              title,
              description: description || '',
              dueDate: new Date(dueDate),
              priority: priority || 'medium',
              assigneeId: assigneeId || null,
              status: 'pending',
              dependencies: [],
              estimatedHours: 1,
              actualHours: 0,
              tags: [],
              createdBy: 'mcp-user',
              updatedBy: 'mcp-user'
            }
          });

          logger.info('Task created via MCP', {
            taskId: task.id,
            campaignId,
            title,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              task,
              message: `Task '${title}' created successfully`
            }
          };
        }

        case 'listTasks': {
          const { campaignId, status, assigneeId, limit = 10, offset = 0 } = params;

          const where: any = {};
          if (campaignId) where.campaignId = campaignId;
          if (status) where.status = status;
          if (assigneeId) where.assigneeId = assigneeId;

          const tasks = await prisma.task.findMany({
            where,
            take: limit,
            skip: offset,
            include: {
              campaign: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          });

          const total = await prisma.task.count({ where });

          logger.info('Tasks listed via MCP', {
            count: tasks.length,
            total,
            filters: where,
            duration: Date.now() - startTime
          });

          return {
            success: true,
            data: {
              tasks,
              total,
              message: `Found ${tasks.length} tasks`
            }
          };
        }

        default:
          return {
            success: false,
            error: `Tool '${tool}' not implemented`,
            availableTools: [
              'listCampaigns', 'createCampaign', 'getCampaign',
              'createTask', 'listTasks'
            ]
          };
      }
    } catch (error) {
      logger.error('MCP endpoint error', {
        tool,
        error: error.message,
        duration: Date.now() - startTime,
        stack: error.stack
      });

      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
  });

  // Metrics endpoint for monitoring
  server.get('/metrics', async (request, reply) => {
    try {
      const [
        campaignCount,
        taskCount,
        recentCampaigns
      ] = await Promise.all([
        prisma.campaign.count(),
        prisma.task.count(),
        prisma.campaign.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, createdAt: true }
        })
      ]);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          campaigns: {
            total: campaignCount
          },
          tasks: {
            total: taskCount
          },
          database: {
            connected: true,
            lastQuery: new Date().toISOString()
          }
        },
        recentActivity: recentCampaigns
      };
    } catch (error) {
      logger.error('Metrics endpoint error', { error: error.message });
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  });

  // Cleanup Prisma connection on server close
  server.addHook('onClose', async () => {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  });

  return server;
}