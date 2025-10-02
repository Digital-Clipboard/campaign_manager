/**
 * Lifecycle API Routes
 * RESTful API endpoints for campaign lifecycle management
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import {
  CampaignOrchestratorService,
  type CampaignCreationParams,
  type CampaignLaunchParams
} from '@/services/lifecycle';
import { lifecycleScheduler } from '@/queues';

const router = Router();
const orchestrator = new CampaignOrchestratorService();

/**
 * POST /api/lifecycle/campaigns
 * Create a new campaign with 3 scheduled rounds
 */
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const params: CampaignCreationParams = req.body;

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
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }

    // Validate mailjetListIds is array of 3
    if (!Array.isArray(params.mailjetListIds) || params.mailjetListIds.length !== 3) {
      return res.status(400).json({
        error: 'mailjetListIds must be an array of exactly 3 list IDs'
      });
    }

    const result = await orchestrator.createCampaign(params);

    if (!result.success) {
      return res.status(500).json({
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

    res.status(201).json({
      success: true,
      message: result.message,
      schedules: result.schedules,
      scheduledJobs
    });

  } catch (error) {
    logger.error('[Lifecycle API] Campaign creation failed', { error });
    res.status(500).json({
      error: 'Failed to create campaign',
      details: String(error)
    });
  }
});

/**
 * GET /api/lifecycle/campaigns/:campaignName
 * Get status of all rounds for a campaign
 */
router.get('/campaigns/:campaignName', async (req: Request, res: Response) => {
  try {
    const { campaignName } = req.params;

    const status = await orchestrator.getCampaignStatus(campaignName);

    res.json(status);

  } catch (error) {
    logger.error('[Lifecycle API] Failed to get campaign status', { error });
    res.status(500).json({
      error: 'Failed to get campaign status',
      details: String(error)
    });
  }
});

/**
 * POST /api/lifecycle/campaigns/:scheduleId/preflight
 * Run pre-flight verification (can be triggered manually)
 */
router.post('/campaigns/:scheduleId/preflight', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const result = await orchestrator.runPreFlight(scheduleId);

    res.json(result);

  } catch (error) {
    logger.error('[Lifecycle API] Pre-flight failed', { error });
    res.status(500).json({
      error: 'Pre-flight verification failed',
      details: String(error)
    });
  }
});

/**
 * POST /api/lifecycle/campaigns/:scheduleId/launch
 * Launch a campaign (manual trigger)
 */
router.post('/campaigns/:scheduleId/launch', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    const { skipPreFlight } = req.body;

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const params: CampaignLaunchParams = {
      campaignScheduleId: scheduleId,
      skipPreFlight: skipPreFlight === true
    };

    const result = await orchestrator.launchCampaign(params);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('[Lifecycle API] Campaign launch failed', { error });
    res.status(500).json({
      error: 'Campaign launch failed',
      details: String(error)
    });
  }
});

/**
 * POST /api/lifecycle/campaigns/:scheduleId/wrapup
 * Run wrap-up analysis (manual trigger)
 */
router.post('/campaigns/:scheduleId/wrapup', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const result = await orchestrator.runWrapUp(scheduleId);

    res.json(result);

  } catch (error) {
    logger.error('[Lifecycle API] Wrap-up failed', { error });
    res.status(500).json({
      error: 'Wrap-up analysis failed',
      details: String(error)
    });
  }
});

/**
 * DELETE /api/lifecycle/campaigns/:scheduleId
 * Cancel a scheduled campaign
 */
router.delete('/campaigns/:scheduleId', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    const { reason } = req.body;

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const result = await orchestrator.cancelCampaign(scheduleId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Cancel scheduled jobs
    await lifecycleScheduler.cancelLifecycleJobs(scheduleId);

    res.json({
      ...result,
      jobsCancelled: true
    });

  } catch (error) {
    logger.error('[Lifecycle API] Campaign cancellation failed', { error });
    res.status(500).json({
      error: 'Campaign cancellation failed',
      details: String(error)
    });
  }
});

/**
 * GET /api/lifecycle/campaigns/:scheduleId/jobs
 * Get status of scheduled jobs for a campaign
 */
router.get('/campaigns/:scheduleId/jobs', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const jobStatus = await lifecycleScheduler.getJobStatus(scheduleId);
    const areScheduled = await lifecycleScheduler.areJobsScheduled(scheduleId);

    res.json({
      scheduleId,
      allJobsScheduled: areScheduled,
      jobs: jobStatus
    });

  } catch (error) {
    logger.error('[Lifecycle API] Failed to get job status', { error });
    res.status(500).json({
      error: 'Failed to get job status',
      details: String(error)
    });
  }
});

/**
 * PUT /api/lifecycle/campaigns/:scheduleId/reschedule
 * Reschedule a campaign (updates schedule and jobs)
 */
router.put('/campaigns/:scheduleId/reschedule', async (req: Request, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    const { scheduledDate, scheduledTime } = req.body;

    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({
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

    res.json({
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
    res.status(500).json({
      error: 'Failed to reschedule campaign',
      details: String(error)
    });
  }
});

export default router;
