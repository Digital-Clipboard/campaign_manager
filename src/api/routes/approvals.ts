import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ApprovalService } from '@/services/approval/approval.service';
import { CacheService } from '@/services/cache/cache.service';
import { NotificationService } from '@/services/notification/notification.service';
import { authMiddleware } from '@/api/middleware/auth';
import {
  CreateApprovalRequest,
  ApprovalDecision,
  ApprovalFilters,
  ApprovalStage,
  ApprovalStatus,
  ApprovalUrgency
} from '@/types';
import { logger } from '@/utils/logger';

export async function approvalRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const cache = new CacheService();
  const notificationService = new NotificationService(prisma);
  const approvalService = new ApprovalService(prisma, cache, notificationService);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /approvals - List approvals with filtering
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      campaignId?: string;
      approverId?: string;
      status?: string;
      urgency?: string;
      stage?: string;
      overdue?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        campaignId,
        approverId,
        status,
        urgency,
        stage,
        overdue
      } = request.query;

      const filters: ApprovalFilters = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        campaignId,
        approverId,
        status: status as ApprovalStatus,
        urgency: urgency as ApprovalUrgency,
        stage: stage as ApprovalStage,
        overdue: overdue === 'true'
      };

      const result = await approvalService.listApprovals(filters);

      reply.send({
        success: true,
        data: result.approvals,
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
      logger.error('Failed to list approvals', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve approvals',
          statusCode: 500
        }
      });
    }
  });

  // POST /approvals - Create new approval request
  fastify.post('/', async (request: FastifyRequest<{
    Body: {
      campaignId: string;
      stage: string;
      approverId: string;
      urgency?: string;
      autoApprove?: boolean;
      conditions?: string[];
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      if (!request.body.campaignId || !request.body.stage || !request.body.approverId) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'campaignId, stage, and approverId are required',
            statusCode: 400
          }
        });
        return;
      }

      const approvalData: CreateApprovalRequest = {
        campaignId: request.body.campaignId,
        stage: request.body.stage as ApprovalStage,
        approverId: request.body.approverId,
        urgency: request.body.urgency as ApprovalUrgency,
        autoApprove: request.body.autoApprove,
        conditions: request.body.conditions
      };

      const approval = await approvalService.createApproval(approvalData, userId);

      reply.status(201).send({
        success: true,
        data: approval
      });

    } catch (error) {
      logger.error('Failed to create approval', { error: (error as Error).message });

      const statusCode = (error as Error).message.includes('not found') ? 404 :
                        (error as Error).message.includes('already') ? 409 : 500;

      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' :
                statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /approvals/:id - Get single approval
  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const approval = await approvalService.getApproval(request.params.id);

      if (!approval) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Approval not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: approval
      });

    } catch (error) {
      logger.error('Failed to get approval', {
        error: (error as Error).message,
        approvalId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve approval',
          statusCode: 500
        }
      });
    }
  });

  // POST /approvals/:id/decide - Make approval decision
  fastify.post('/:id/decide', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      decision: 'approve' | 'reject' | 'request_changes';
      comments: string;
      conditions?: string[];
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { decision, comments, conditions } = request.body;

      if (!decision || !comments) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'decision and comments are required',
            statusCode: 400
          }
        });
        return;
      }

      const approvalDecision: ApprovalDecision = {
        decision,
        comments,
        conditions
      };

      const approval = await approvalService.processDecision(
        request.params.id,
        approvalDecision,
        userId
      );

      reply.send({
        success: true,
        data: approval,
        message: `Approval ${decision === 'approve' ? 'approved' :
                           decision === 'reject' ? 'rejected' :
                           'marked for changes'} successfully`
      });

    } catch (error) {
      logger.error('Failed to process approval decision', {
        error: (error as Error).message,
        approvalId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 :
                        (error as Error).message.includes('already') ? 409 :
                        (error as Error).message.includes('Only assigned') ? 403 : 500;

      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' :
                statusCode === 409 ? 'CONFLICT' :
                statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /approvals/campaign/:campaignId/workflow - Get campaign approval workflow
  fastify.get('/campaign/:campaignId/workflow', async (request: FastifyRequest<{
    Params: { campaignId: string }
  }>, reply: FastifyReply) => {
    try {
      const workflow = await approvalService.getCampaignApprovalWorkflow(
        request.params.campaignId
      );

      reply.send({
        success: true,
        data: workflow
      });

    } catch (error) {
      logger.error('Failed to get campaign approval workflow', {
        error: (error as Error).message,
        campaignId: request.params.campaignId
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve approval workflow',
          statusCode: 500
        }
      });
    }
  });

  // POST /approvals/campaign/:campaignId/stage - Create stage approvals
  fastify.post('/campaign/:campaignId/stage', async (request: FastifyRequest<{
    Params: { campaignId: string };
    Body: {
      stage: string;
      approverIds: string[];
      urgency?: string;
      autoApprove?: boolean;
      conditions?: string[];
    }
  }>, reply: FastifyReply) => {
    try {
      const { stage, approverIds, urgency, autoApprove, conditions } = request.body;

      if (!stage || !approverIds || !Array.isArray(approverIds) || approverIds.length === 0) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'stage and approverIds array are required',
            statusCode: 400
          }
        });
        return;
      }

      const approvals = await approvalService.createStageApprovals(
        request.params.campaignId,
        stage as ApprovalStage,
        approverIds,
        {
          urgency: urgency as ApprovalUrgency,
          autoApprove,
          conditions
        }
      );

      reply.status(201).send({
        success: true,
        data: approvals,
        message: `Created ${approvals.length} approval requests for ${stage} stage`
      });

    } catch (error) {
      logger.error('Failed to create stage approvals', {
        error: (error as Error).message,
        campaignId: request.params.campaignId
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create stage approvals',
          statusCode: 500
        }
      });
    }
  });

  // POST /approvals/process-auto - Process auto-approvals
  fastify.post('/process-auto', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const processedCount = await approvalService.processAutoApprovals();

      reply.send({
        success: true,
        data: {
          processedCount
        },
        message: `Processed ${processedCount} auto-approvals`
      });

    } catch (error) {
      logger.error('Failed to process auto-approvals', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process auto-approvals',
          statusCode: 500
        }
      });
    }
  });

  // POST /approvals/escalate - Escalate overdue approvals
  fastify.post('/escalate', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const escalatedCount = await approvalService.escalateOverdueApprovals();

      reply.send({
        success: true,
        data: {
          escalatedCount
        },
        message: `Escalated ${escalatedCount} overdue approvals`
      });

    } catch (error) {
      logger.error('Failed to escalate overdue approvals', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to escalate overdue approvals',
          statusCode: 500
        }
      });
    }
  });

  // GET /approvals/pending/my - Get current user's pending approvals
  fastify.get('/pending/my', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { page = '1', pageSize = '20' } = request.query;

      const filters: ApprovalFilters = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        approverId: userId,
        status: 'pending'
      };

      const result = await approvalService.listApprovals(filters);

      reply.send({
        success: true,
        data: result.approvals,
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
      logger.error('Failed to get user pending approvals', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pending approvals',
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