import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { TimelineService } from '@/services/timeline/timeline.service';
import { CacheService } from '@/services/cache/cache.service';
import { authMiddleware } from '@/api/middleware/auth';
import { logger } from '@/utils/logger';

export async function timelineRoutes(fastify: FastifyInstance) {
  const cache = new CacheService();
  const timelineService = new TimelineService(prisma, cache);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // POST /timelines/generate - Generate timeline for campaign
  fastify.post('/generate', async (request: FastifyRequest<{
    Body: {
      campaignId: string;
      template: string;
      targetDate: string;
      customRequirements?: Record<string, any>;
    }
  }>, reply: FastifyReply) => {
    try {
      const { campaignId, template, targetDate, customRequirements } = request.body;

      if (!campaignId || !template || !targetDate) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'campaignId, template, and targetDate are required',
            statusCode: 400
          }
        });
        return;
      }

      const parsedTargetDate = new Date(targetDate);
      if (isNaN(parsedTargetDate.getTime())) {
        reply.status(400).send({
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid targetDate format',
            statusCode: 400
          }
        });
        return;
      }

      const result = await timelineService.generateTimeline(
        campaignId,
        template,
        parsedTargetDate,
        customRequirements
      );

      reply.status(201).send({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Failed to generate timeline', {
        error: (error as Error).message,
        body: request.body
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'CAMPAIGN_NOT_FOUND' : 'GENERATION_FAILED',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /timelines/:id - Get timeline details
  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const timeline = await timelineService.getTimeline(request.params.id);

      if (!timeline) {
        reply.status(404).send({
          error: {
            code: 'TIMELINE_NOT_FOUND',
            message: 'Timeline not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: timeline
      });

    } catch (error) {
      logger.error('Failed to get timeline', {
        error: (error as Error).message,
        timelineId: request.params.id
      });

      reply.status(500).send({
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve timeline',
          statusCode: 500
        }
      });
    }
  });

  // PUT /timelines/:id - Update timeline
  fastify.put('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      milestones?: any[];
      buffer?: number;
      targetDate?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const updates: any = { ...request.body };

      if (updates.targetDate) {
        const parsedDate = new Date(updates.targetDate);
        if (isNaN(parsedDate.getTime())) {
          reply.status(400).send({
            error: {
              code: 'INVALID_DATE',
              message: 'Invalid targetDate format',
              statusCode: 400
            }
          });
          return;
        }
        updates.targetDate = parsedDate;
      }

      const timeline = await timelineService.updateTimeline(request.params.id, updates);

      reply.send({
        success: true,
        data: timeline
      });

    } catch (error) {
      logger.error('Failed to update timeline', {
        error: (error as Error).message,
        timelineId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'TIMELINE_NOT_FOUND' : 'UPDATE_FAILED',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /timelines/templates - List available timeline templates
  fastify.get('/templates', async (request: FastifyRequest<{
    Querystring: {
      campaignType?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { campaignType } = request.query;

      // Return available templates
      const templates = [
        {
          id: 'standard',
          name: 'Standard Timeline',
          description: 'Standard campaign timeline based on campaign type',
          supportedTypes: ['email_blast', 'product_launch', 'webinar', 'newsletter', 'custom'],
          estimatedDuration: {
            email_blast: 14,
            product_launch: 42,
            webinar: 28,
            newsletter: 7,
            custom: 14
          }
        },
        {
          id: 'express',
          name: 'Express Timeline',
          description: 'Accelerated timeline for urgent campaigns',
          supportedTypes: ['email_blast', 'newsletter'],
          estimatedDuration: {
            email_blast: 7,
            newsletter: 3
          }
        },
        {
          id: 'comprehensive',
          name: 'Comprehensive Timeline',
          description: 'Detailed timeline with extended planning phase',
          supportedTypes: ['product_launch', 'webinar'],
          estimatedDuration: {
            product_launch: 84,
            webinar: 56
          }
        }
      ];

      let filteredTemplates = templates;
      if (campaignType) {
        filteredTemplates = templates.filter(template =>
          template.supportedTypes.includes(campaignType)
        );
      }

      reply.send({
        success: true,
        data: filteredTemplates
      });

    } catch (error) {
      logger.error('Failed to get timeline templates', {
        error: (error as Error).message
      });

      reply.status(500).send({
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve timeline templates',
          statusCode: 500
        }
      });
    }
  });

  // GET /timelines/:id/milestones - Get timeline milestones
  fastify.get('/:id/milestones', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const timeline = await timelineService.getTimeline(request.params.id);

      if (!timeline) {
        reply.status(404).send({
          error: {
            code: 'TIMELINE_NOT_FOUND',
            message: 'Timeline not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: {
          timelineId: timeline.id,
          milestones: timeline.milestones,
          criticalPath: timeline.criticalPath,
          totalDuration: timeline.estimatedHours
        }
      });

    } catch (error) {
      logger.error('Failed to get timeline milestones', {
        error: (error as Error).message,
        timelineId: request.params.id
      });

      reply.status(500).send({
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve timeline milestones',
          statusCode: 500
        }
      });
    }
  });

  // POST /timelines/:id/milestones/:milestoneId/complete - Mark milestone as complete
  fastify.post('/:id/milestones/:milestoneId/complete', async (request: FastifyRequest<{
    Params: { id: string; milestoneId: string };
    Body: { notes?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id: timelineId, milestoneId } = request.params;
      const { notes } = request.body;

      const timeline = await timelineService.getTimeline(timelineId);
      if (!timeline) {
        reply.status(404).send({
          error: {
            code: 'TIMELINE_NOT_FOUND',
            message: 'Timeline not found',
            statusCode: 404
          }
        });
        return;
      }

      // Update milestone status
      const milestones = Array.isArray(timeline.milestones) ? timeline.milestones : [];
      const milestoneIndex = milestones.findIndex((m: any) => m.id === milestoneId);

      if (milestoneIndex === -1) {
        reply.status(404).send({
          error: {
            code: 'MILESTONE_NOT_FOUND',
            message: 'Milestone not found',
            statusCode: 404
          }
        });
        return;
      }

      milestones[milestoneIndex] = {
        ...milestones[milestoneIndex],
        status: 'completed',
        completedAt: new Date(),
        completionNotes: notes
      };

      await timelineService.updateTimeline(timelineId, { milestones });

      reply.send({
        success: true,
        message: 'Milestone marked as complete',
        data: milestones[milestoneIndex]
      });

    } catch (error) {
      logger.error('Failed to complete milestone', {
        error: (error as Error).message,
        timelineId: request.params.id,
        milestoneId: request.params.milestoneId
      });

      reply.status(500).send({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to complete milestone',
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