/**
 * Lifecycle Scheduler
 * Schedules all lifecycle jobs for a campaign
 */

import { LifecycleCampaignSchedule } from '@prisma/client';
import { logger } from '@/utils/logger';
import lifecycleQueue, {
  PreLaunchJobData,
  PreFlightJobData,
  LaunchWarningJobData,
  LaunchJobData,
  WrapUpJobData,
  ListMaintenanceJobData
} from './lifecycle-queue';

export interface ScheduledJobs {
  prelaunch?: string;
  preflight?: string;
  launchWarning?: string;
  launch?: string;
  wrapup?: string;
  listMaintenance?: string;
}

export class LifecycleScheduler {
  /**
   * Schedule all lifecycle jobs for a campaign round
   */
  async scheduleLifecycleJobs(schedule: LifecycleCampaignSchedule): Promise<ScheduledJobs> {
    logger.info('[LifecycleScheduler] Scheduling lifecycle jobs', {
      campaignScheduleId: schedule.id,
      campaignName: schedule.campaignName,
      roundNumber: schedule.roundNumber,
      scheduledDate: schedule.scheduledDate
    });

    const jobs: ScheduledJobs = {};

    // Calculate job times based on scheduled launch time
    const launchTime = new Date(schedule.scheduledDate);
    launchTime.setUTCHours(
      parseInt(schedule.scheduledTime.split(':')[0]),
      parseInt(schedule.scheduledTime.split(':')[1]),
      0,
      0
    );

    // Pre-Launch: T-21h (already sent during creation, but schedule reminder)
    const preLaunchTime = new Date(launchTime.getTime() - 21 * 60 * 60 * 1000);
    const preLaunchJob = await lifecycleQueue.add(
      'prelaunch',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber
      } as PreLaunchJobData,
      {
        delay: Math.max(0, preLaunchTime.getTime() - Date.now()),
        jobId: `prelaunch-${schedule.id}`
      }
    );
    jobs.prelaunch = preLaunchJob.id?.toString();

    // Pre-Flight: T-3.25h (3 hours 15 minutes)
    const preFlightTime = new Date(launchTime.getTime() - 3.25 * 60 * 60 * 1000);
    const preFlightJob = await lifecycleQueue.add(
      'preflight',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber
      } as PreFlightJobData,
      {
        delay: Math.max(0, preFlightTime.getTime() - Date.now()),
        jobId: `preflight-${schedule.id}`
      }
    );
    jobs.preflight = preFlightJob.id?.toString();

    // Launch Warning: T-15min
    const launchWarningTime = new Date(launchTime.getTime() - 15 * 60 * 1000);
    const launchWarningJob = await lifecycleQueue.add(
      'launch-warning',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber
      } as LaunchWarningJobData,
      {
        delay: Math.max(0, launchWarningTime.getTime() - Date.now()),
        jobId: `launch-warning-${schedule.id}`
      }
    );
    jobs.launchWarning = launchWarningJob.id?.toString();

    // Launch: T+0
    const launchJob = await lifecycleQueue.add(
      'launch',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber
      } as LaunchJobData,
      {
        delay: Math.max(0, launchTime.getTime() - Date.now()),
        jobId: `launch-${schedule.id}`
      }
    );
    jobs.launch = launchJob.id?.toString();

    // Wrap-Up: T+30min
    const wrapUpTime = new Date(launchTime.getTime() + 30 * 60 * 1000);
    const wrapUpJob = await lifecycleQueue.add(
      'wrapup',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber
      } as WrapUpJobData,
      {
        delay: Math.max(0, wrapUpTime.getTime() - Date.now()),
        jobId: `wrapup-${schedule.id}`
      }
    );
    jobs.wrapup = wrapUpJob.id?.toString();

    // List Maintenance (Stage 6): T+24h
    const listMaintenanceTime = new Date(launchTime.getTime() + 24 * 60 * 60 * 1000);
    const listMaintenanceJob = await lifecycleQueue.add(
      'list-maintenance',
      {
        campaignScheduleId: schedule.id,
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        listId: schedule.listId.toString() // Assumes listId exists in schedule
      } as ListMaintenanceJobData,
      {
        delay: Math.max(0, listMaintenanceTime.getTime() - Date.now()),
        jobId: `list-maintenance-${schedule.id}`
      }
    );
    jobs.listMaintenance = listMaintenanceJob.id?.toString();

    logger.info('[LifecycleScheduler] All lifecycle jobs scheduled (including list maintenance)', {
      campaignScheduleId: schedule.id,
      jobs
    });

    return jobs;
  }

  /**
   * Cancel all scheduled jobs for a campaign
   */
  async cancelLifecycleJobs(campaignScheduleId: number): Promise<void> {
    logger.info('[LifecycleScheduler] Cancelling lifecycle jobs', { campaignScheduleId });

    const jobIds = [
      `prelaunch-${campaignScheduleId}`,
      `preflight-${campaignScheduleId}`,
      `launch-warning-${campaignScheduleId}`,
      `launch-${campaignScheduleId}`,
      `wrapup-${campaignScheduleId}`,
      `list-maintenance-${campaignScheduleId}`
    ];

    for (const jobId of jobIds) {
      try {
        const job = await lifecycleQueue.getJob(jobId);
        if (job) {
          await job.remove();
          logger.debug('[LifecycleScheduler] Job removed', { jobId });
        }
      } catch (error) {
        logger.warn('[LifecycleScheduler] Failed to remove job', { jobId, error });
      }
    }

    logger.info('[LifecycleScheduler] All lifecycle jobs cancelled', { campaignScheduleId });
  }

  /**
   * Reschedule lifecycle jobs for a campaign
   */
  async rescheduleLifecycleJobs(schedule: LifecycleCampaignSchedule): Promise<ScheduledJobs> {
    logger.info('[LifecycleScheduler] Rescheduling lifecycle jobs', {
      campaignScheduleId: schedule.id
    });

    // Cancel existing jobs
    await this.cancelLifecycleJobs(schedule.id);

    // Schedule new jobs
    return this.scheduleLifecycleJobs(schedule);
  }

  /**
   * Get status of scheduled jobs for a campaign
   */
  async getJobStatus(campaignScheduleId: number): Promise<{
    [key: string]: {
      jobId: string;
      state: string;
      scheduledTime?: Date;
      processedTime?: Date;
      error?: string;
    };
  }> {
    const jobIds = [
      { id: `prelaunch-${campaignScheduleId}`, name: 'prelaunch' },
      { id: `preflight-${campaignScheduleId}`, name: 'preflight' },
      { id: `launch-warning-${campaignScheduleId}`, name: 'launchWarning' },
      { id: `launch-${campaignScheduleId}`, name: 'launch' },
      { id: `wrapup-${campaignScheduleId}`, name: 'wrapup' }
    ];

    const status: any = {};

    for (const { id, name } of jobIds) {
      try {
        const job = await lifecycleQueue.getJob(id);
        if (job) {
          const state = await job.getState();
          status[name] = {
            jobId: id,
            state,
            scheduledTime: job.processedOn ? new Date(job.processedOn) : undefined,
            processedTime: job.finishedOn ? new Date(job.finishedOn) : undefined,
            error: job.failedReason
          };
        }
      } catch (error) {
        logger.warn('[LifecycleScheduler] Failed to get job status', { jobId: id, error });
      }
    }

    return status;
  }

  /**
   * Check if all jobs for a campaign are scheduled
   */
  async areJobsScheduled(campaignScheduleId: number): Promise<boolean> {
    const status = await this.getJobStatus(campaignScheduleId);
    const requiredJobs = ['prelaunch', 'preflight', 'launchWarning', 'launch', 'wrapup'];

    return requiredJobs.every(job => job in status);
  }
}

export default new LifecycleScheduler();
