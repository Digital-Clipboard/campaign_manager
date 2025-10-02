/**
 * Lifecycle API Routes (Fastify)
 * RESTful API endpoints for campaign lifecycle management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';
import {
  CampaignOrchestratorService,
  type CampaignCreationParams,
  type CampaignLaunchParams
} from '@/services/lifecycle';
import { lifecycleScheduler } from '@/queues';

const orchestrator = new CampaignOrchestratorService();

/**
 * POST /api/lifecycle/campaigns
 * Create a new campaign with 3 scheduled rounds
 */
interface CreateCampaignRequest {
  Body: CampaignCreationParams;
}

/**
 * POST /api/lifecycle/campaigns/:scheduleId/launch
 * Launch a campaign (manual trigger)
 */
interface LaunchCampaignRequest {
  Params: {
    scheduleId: string;
  };
  Body: {
    skipPreFlight?: boolean;
  };
}

/**
 * GET /api/lifecycle/campaigns/:campaignName
 * Get status of all rounds for a campaign
 */
interface GetCampaignRequest {
  Params: {
    campaignName: string;
  };
}

/**
 * POST /api/lifecycle/campaigns/:scheduleId/preflight
 * Run pre-flight verification
 */
interface PreflightRequest {
  Params: {
    scheduleId: string;
  };
}

/**
 * POST /api/lifecycle/campaigns/:scheduleId/wrapup
 * Run wrap-up analysis
 */
interface WrapupRequest {
  Params: {
    scheduleId: string;
  };
}

/**
 * DELETE /api/lifecycle/campaigns/:scheduleId
 * Cancel a scheduled campaign
 */
interface CancelCampaignRequest {
  Params: {
    scheduleId: string;
  };
  Body: {
    reason: string;
  };
}

/**
 * GET /api/lifecycle/campaigns/:scheduleId/jobs
 * Get status of scheduled jobs
 */
interface GetJobsRequest {
  Params: {
    scheduleId: string;
  };
}

/**
 * PUT /api/lifecycle/campaigns/:scheduleId/reschedule
 * Reschedule a campaign
 */
interface RescheduleRequest {
  Params: {
    scheduleId: string;
  };
  Body: {
    scheduledDate: string;
    scheduledTime: string;
  };
}

export default async function lifecycleRoutes(server: FastifyInstance) {
  /**
   * POST /campaigns
   * Create a new campaign with 3 scheduled rounds
   */
  server.post<CreateCampaignRequest>('/campaigns', async (request, reply) => {
    try {
      const params = request.body;

      // Validate required fields
      const requiredFields = [
        'campaignName',
        'listIdPrefix',
        'subject',
        'senderName',
        'senderEmail',
        'totalRecipients',
        'mailjetListIds'
      ];

      const missingFields = requiredFields.filter(field => !(field in params));
      if (missingFields.length > 0) {
        return reply.status(400).send({
          error: 'Missing required fields',
          missingFields
        });
      }

      // Validate mailjetListIds is array of 3
      if (!Array.isArray(params.mailjetListIds) || params.mailjetListIds.length !== 3) {
        return reply.status(400).send({
          error: 'mailjetListIds must be an array of exactly 3 list IDs'
        });
      }

      const result = await orchestrator.createCampaign(params);

      if (!result.success) {
        return reply.status(500).send({
          error: result.message
        });
      }

      // Schedule lifecycle jobs for all rounds
      const scheduledJobs = [];
      for (const schedule of result.schedules) {
        const jobs = await lifecycleScheduler.scheduleLifecycleJobs(schedule as any);
        scheduledJobs.push({
          scheduleId: schedule.id,
          roundNumber: schedule.roundNumber,
          jobs
        });
      }

      return reply.status(201).send({
        success: true,
        message: result.message,
        schedules: result.schedules,
        scheduledJobs
      });

    } catch (error) {
      logger.error('[Lifecycle API] Campaign creation failed', { error });
      return reply.status(500).send({
        error: 'Failed to create campaign',
        details: String(error)
      });
    }
  });

  /**
   * GET /campaigns/:campaignName
   * Get status of all rounds for a campaign
   */
  server.get<GetCampaignRequest>('/campaigns/:campaignName', async (request, reply) => {
    try {
      const { campaignName } = request.params;

      const status = await orchestrator.getCampaignStatus(campaignName);

      return reply.send(status);

    } catch (error) {
      logger.error('[Lifecycle API] Failed to get campaign status', { error });
      return reply.status(500).send({
        error: 'Failed to get campaign status',
        details: String(error)
      });
    }
  });

  /**
   * POST /campaigns/:scheduleId/preflight
   * Run pre-flight verification (can be triggered manually)
   */
  server.post<PreflightRequest>('/campaigns/:scheduleId/preflight', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      const result = await orchestrator.runPreFlight(scheduleId);

      return reply.send(result);

    } catch (error) {
      logger.error('[Lifecycle API] Pre-flight failed', { error });
      return reply.status(500).send({
        error: 'Pre-flight verification failed',
        details: String(error)
      });
    }
  });

  /**
   * POST /campaigns/:scheduleId/launch
   * Launch a campaign (manual trigger)
   */
  server.post<LaunchCampaignRequest>('/campaigns/:scheduleId/launch', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);
      const { skipPreFlight } = request.body;

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      const params: CampaignLaunchParams = {
        campaignScheduleId: scheduleId,
        skipPreFlight: skipPreFlight === true
      };

      const result = await orchestrator.launchCampaign(params);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);

    } catch (error) {
      logger.error('[Lifecycle API] Campaign launch failed', { error });
      return reply.status(500).send({
        error: 'Campaign launch failed',
        details: String(error)
      });
    }
  });

  /**
   * POST /campaigns/:scheduleId/wrapup
   * Run wrap-up analysis (manual trigger)
   */
  server.post<WrapupRequest>('/campaigns/:scheduleId/wrapup', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      const result = await orchestrator.runWrapUp(scheduleId);

      return reply.send(result);

    } catch (error) {
      logger.error('[Lifecycle API] Wrap-up failed', { error });
      return reply.status(500).send({
        error: 'Wrap-up analysis failed',
        details: String(error)
      });
    }
  });

  /**
   * DELETE /campaigns/:scheduleId
   * Cancel a scheduled campaign
   */
  server.delete<CancelCampaignRequest>('/campaigns/:scheduleId', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);
      const { reason } = request.body;

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      if (!reason) {
        return reply.status(400).send({ error: 'Cancellation reason is required' });
      }

      const result = await orchestrator.cancelCampaign(scheduleId, reason);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Cancel scheduled jobs
      await lifecycleScheduler.cancelLifecycleJobs(scheduleId);

      return reply.send({
        ...result,
        jobsCancelled: true
      });

    } catch (error) {
      logger.error('[Lifecycle API] Campaign cancellation failed', { error });
      return reply.status(500).send({
        error: 'Campaign cancellation failed',
        details: String(error)
      });
    }
  });

  /**
   * GET /campaigns/:scheduleId/jobs
   * Get status of scheduled jobs for a campaign
   */
  server.get<GetJobsRequest>('/campaigns/:scheduleId/jobs', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      const jobStatus = await lifecycleScheduler.getJobStatus(scheduleId);
      const areScheduled = await lifecycleScheduler.areJobsScheduled(scheduleId);

      return reply.send({
        scheduleId,
        allJobsScheduled: areScheduled,
        jobs: jobStatus
      });

    } catch (error) {
      logger.error('[Lifecycle API] Failed to get job status', { error });
      return reply.status(500).send({
        error: 'Failed to get job status',
        details: String(error)
      });
    }
  });

  /**
   * PUT /campaigns/:scheduleId/reschedule
   * Reschedule a campaign (updates schedule and jobs)
   */
  server.put<RescheduleRequest>('/campaigns/:scheduleId/reschedule', async (request, reply) => {
    try {
      const scheduleId = parseInt(request.params.scheduleId);
      const { scheduledDate, scheduledTime } = request.body;

      if (isNaN(scheduleId)) {
        return reply.status(400).send({ error: 'Invalid schedule ID' });
      }

      if (!scheduledDate || !scheduledTime) {
        return reply.status(400).send({
          error: 'scheduledDate and scheduledTime are required'
        });
      }

      // Update schedule in database
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const updatedSchedule = await prisma.lifecycleCampaignSchedule.update({
        where: { id: scheduleId },
        data: {
          scheduledDate: new Date(scheduledDate),
          scheduledTime
        }
      });

      // Reschedule jobs
      const jobs = await lifecycleScheduler.rescheduleLifecycleJobs(updatedSchedule);

      await prisma.$disconnect();

      return reply.send({
        success: true,
        message: 'Campaign rescheduled',
        schedule: {
          id: updatedSchedule.id,
          scheduledDate: updatedSchedule.scheduledDate,
          scheduledTime: updatedSchedule.scheduledTime
        },
        jobs
      });

    } catch (error) {
      logger.error('[Lifecycle API] Rescheduling failed', { error });
      return reply.status(500).send({
        error: 'Failed to reschedule campaign',
        details: String(error)
      });
    }
  });
}
