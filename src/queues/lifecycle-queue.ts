/**
 * Lifecycle Queue
 * Bull queue for scheduling lifecycle notification stages
 */

import Bull from 'bull';
import { logger } from '@/utils/logger';
import { CampaignOrchestratorService } from '@/services/lifecycle';
import { ListMaintenanceOrchestrator } from '@/services/lists/list-maintenance-orchestrator.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Queue for lifecycle notifications
export const lifecycleQueue = new Bull('lifecycle-notifications', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500 // Keep last 500 failed jobs
  }
});

// Job data types
export interface PreLaunchJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
}

export interface PreFlightJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
}

export interface LaunchWarningJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
}

export interface LaunchJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
}

export interface WrapUpJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
}

export interface ListMaintenanceJobData {
  campaignScheduleId: number;
  campaignName: string;
  roundNumber: number;
  listId: string;
}

// Process Pre-Launch notifications (T-21h)
lifecycleQueue.process('prelaunch', async (job: Bull.Job<PreLaunchJobData>) => {
  logger.info('[LifecycleQueue] Processing Pre-Launch job', job.data);

  const orchestrator = new CampaignOrchestratorService();

  // Pre-Launch notification is already sent during campaign creation
  // This job is for reminder/verification purposes
  return { success: true, stage: 'prelaunch', ...job.data };
});

// Process Pre-Flight checks (T-3.25h)
lifecycleQueue.process('preflight', async (job: Bull.Job<PreFlightJobData>) => {
  logger.info('[LifecycleQueue] Processing Pre-Flight job', job.data);

  const orchestrator = new CampaignOrchestratorService();
  const result = await orchestrator.runPreFlight(job.data.campaignScheduleId);

  if (!result.success) {
    throw new Error(`Pre-Flight failed: ${result.error}`);
  }

  return result;
});

// Process Launch Warning (T-15min)
lifecycleQueue.process('launch-warning', async (job: Bull.Job<LaunchWarningJobData>) => {
  logger.info('[LifecycleQueue] Processing Launch Warning job', job.data);

  const orchestrator = new CampaignOrchestratorService();
  const result = await orchestrator.sendLaunchWarning(job.data.campaignScheduleId);

  if (!result.success) {
    throw new Error(`Launch Warning failed: ${result.error}`);
  }

  return result;
});

// Process Campaign Launch (T+0)
lifecycleQueue.process('launch', async (job: Bull.Job<LaunchJobData>) => {
  logger.info('[LifecycleQueue] Processing Launch job', job.data);

  const orchestrator = new CampaignOrchestratorService();
  const result = await orchestrator.launchCampaign({
    campaignScheduleId: job.data.campaignScheduleId,
    skipPreFlight: false
  });

  if (!result.success) {
    throw new Error(`Campaign launch failed: ${result.error}`);
  }

  return result;
});

// Process Wrap-Up analysis (T+30min)
lifecycleQueue.process('wrapup', async (job: Bull.Job<WrapUpJobData>) => {
  logger.info('[LifecycleQueue] Processing Wrap-Up job', job.data);

  const orchestrator = new CampaignOrchestratorService();
  const result = await orchestrator.runWrapUp(job.data.campaignScheduleId);

  if (!result.success) {
    throw new Error(`Wrap-Up failed: ${result.error}`);
  }

  return result;
});

// Process List Maintenance (T+24h - Stage 6)
lifecycleQueue.process('list-maintenance', async (job: Bull.Job<ListMaintenanceJobData>) => {
  logger.info('[LifecycleQueue] Processing List Maintenance job', job.data);

  const maintenanceOrchestrator = new ListMaintenanceOrchestrator();
  const result = await maintenanceOrchestrator.runPostCampaignMaintenance({
    campaignScheduleId: job.data.campaignScheduleId,
    listId: job.data.listId,
    campaignName: job.data.campaignName,
    roundNumber: job.data.roundNumber
  });

  if (!result.success) {
    throw new Error(`List maintenance failed: ${result.error}`);
  }

  return result;
});

// Event handlers
lifecycleQueue.on('completed', (job, result) => {
  logger.info('[LifecycleQueue] Job completed', {
    jobId: job.id,
    jobType: job.name,
    result
  });
});

lifecycleQueue.on('failed', (job, err) => {
  logger.error('[LifecycleQueue] Job failed', {
    jobId: job.id,
    jobType: job.name,
    error: err.message,
    data: job.data
  });
});

lifecycleQueue.on('stalled', (job) => {
  logger.warn('[LifecycleQueue] Job stalled', {
    jobId: job.id,
    jobType: job.name,
    data: job.data
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[LifecycleQueue] Shutting down gracefully...');
  await lifecycleQueue.close();
});

export default lifecycleQueue;
