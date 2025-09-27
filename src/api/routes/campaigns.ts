import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CampaignService } from '@/services/campaign/campaign.service';
import { CacheService } from '@/services/cache/cache.service';
import { authMiddleware } from '@/api/middleware/auth';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignFilters
} from '@/types';
import { logger } from '@/utils/logger';

export async function campaignRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const cache = new CacheService();
  const campaignService = new CampaignService(prisma, cache);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /campaigns - List campaigns with filtering, pagination, and search
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      status?: string;
      type?: string;
      priority?: string;
      createdBy?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  }>, reply: FastifyReply) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        status,
        type,
        priority,
        createdBy,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = request.query;

      const filters: CampaignFilters = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        status: status as any,
        type: type as any,
        priority: priority as any,
        createdBy,
        search,
        sortBy: sortBy as any,
        sortOrder
      };

      const result = await campaignService.listCampaigns(filters);

      reply.send({
        success: true,
        data: result.campaigns,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          pages: Math.ceil(result.total / result.pageSize),
          hasNext: result.page * result.pageSize < result.total,
          hasPrev: result.page > 1
        }
      });
    } catch (error) {
      logger.error('Failed to list campaigns', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve campaigns',
          statusCode: 500
        }
      });
    }
  });

  // POST /campaigns - Create new campaign
  fastify.post('/', async (request: FastifyRequest<{
    Body: CreateCampaignRequest
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const campaign = await campaignService.createCampaign(request.body, userId);

      reply.status(201).send({
        success: true,
        data: campaign
      });
    } catch (error) {
      logger.error('Failed to create campaign', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create campaign',
          statusCode: 500
        }
      });
    }
  });

  // GET /campaigns/:id - Get single campaign
  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const campaign = await campaignService.getCampaign(request.params.id);

      if (!campaign) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Campaign not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: campaign
      });
    } catch (error) {
      logger.error('Failed to get campaign', {
        error: (error as Error).message,
        campaignId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve campaign',
          statusCode: 500
        }
      });
    }
  });

  // PUT /campaigns/:id - Update campaign
  fastify.put('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateCampaignRequest;
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const campaign = await campaignService.updateCampaign(
        request.params.id,
        request.body,
        userId
      );

      reply.send({
        success: true,
        data: campaign
      });
    } catch (error) {
      logger.error('Failed to update campaign', {
        error: (error as Error).message,
        campaignId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update campaign',
          statusCode: 500
        }
      });
    }
  });

  // DELETE /campaigns/:id - Delete campaign
  fastify.delete('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      await campaignService.deleteCampaign(request.params.id, userId);

      reply.send({
        success: true,
        message: 'Campaign deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete campaign', {
        error: (error as Error).message,
        campaignId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete campaign',
          statusCode: 500
        }
      });
    }
  });

  // PATCH /campaigns/:id/status - Update campaign status
  fastify.patch('/:id/status', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { status: string };
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const campaign = await campaignService.updateCampaignStatus(
        request.params.id,
        request.body.status,
        userId
      );

      reply.send({
        success: true,
        data: campaign
      });
    } catch (error) {
      logger.error('Failed to update campaign status', {
        error: (error as Error).message,
        campaignId: request.params.id,
        status: request.body.status
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 :
                        (error as Error).message.includes('Invalid status transition') ? 400 : 500;

      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'INVALID_TRANSITION' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /campaigns/:id/readiness - Get campaign readiness score
  fastify.get('/:id/readiness', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const score = await campaignService.calculateReadinessScore(request.params.id);

      reply.send({
        success: true,
        data: {
          campaignId: request.params.id,
          readinessScore: score,
          calculatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to calculate readiness score', {
        error: (error as Error).message,
        campaignId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to calculate readiness score',
          statusCode: 500
        }
      });
    }
  });

  // Cleanup on app close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}