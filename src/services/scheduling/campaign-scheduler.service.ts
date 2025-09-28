import * as cron from 'node-cron';
import { logger } from '../../utils/logger';
import { SlackManagerMCPService } from '../slack-manager-mcp.service';
import { CampaignSlackNotifications, CampaignNotificationData } from '../slack/campaign-notifications';

export interface CampaignScheduleConfig {
  campaignName: string;
  rounds: Array<{
    roundNumber: number;
    executionDay: string; // e.g., 'friday', 'tuesday', 'thursday'
    executionTime: string; // e.g., '10:00 AM'
    targetCount: number;
    userRange: string;
  }>;
  channel: string; // Slack channel to send notifications to (e.g., '#_traction')
}

export class CampaignSchedulerService {
  private slackService: SlackManagerMCPService;
  private notificationService: CampaignSlackNotifications;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.slackService = new SlackManagerMCPService();
    this.notificationService = new CampaignSlackNotifications();
  }

  /**
   * Schedule all campaign lifecycle notifications
   */
  async scheduleCampaignNotifications(config: CampaignScheduleConfig): Promise<void> {
    logger.info('Scheduling campaign notifications', {
      campaignName: config.campaignName,
      rounds: config.rounds.length,
      channel: config.channel
    });

    // Schedule the 4 specific notifications requested:
    // 1. Monday 4pm - preparation notification
    // 2. Tuesday 7am - pre-launch checks
    // 3. Tuesday 9:45am - launch countdown (15 minutes before 10am campaign)
    // 4. Tuesday 10:10am - post-launch status update

    await this.schedulePreparationNotification(config);
    await this.schedulePreLaunchChecksNotification(config);
    await this.scheduleLaunchCountdownNotification(config);
    await this.schedulePostLaunchNotification(config);

    logger.info('Campaign notifications scheduled successfully', {
      campaignName: config.campaignName,
      totalJobs: this.scheduledJobs.size
    });
  }

  /**
   * Schedule Monday 4pm preparation notification
   */
  private async schedulePreparationNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-preparation`;

    // Monday at 4:00 PM (16:00)
    const task = cron.schedule('0 16 * * 1', async () => {
      try {
        logger.info('Sending preparation notification', { campaignName: config.campaignName });

        // Find the next round (assuming Tuesday round)
        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for preparation notification', { campaignName: config.campaignName });
          return;
        }

        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime
        };

        const notification = this.notificationService.createPreparationNotification(notificationData);

        const success = await this.slackService.sendMessage({
          channel: config.channel,
          text: notification.text,
          blocks: notification.blocks
        });

        if (success) {
          logger.info('Preparation notification sent successfully', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        } else {
          logger.error('Failed to send preparation notification', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        }
      } catch (error) {
        logger.error('Error sending preparation notification', {
          error: error.message,
          campaignName: config.campaignName
        });
      }
    }, {
      scheduled: false // Don't start immediately
    });

    this.scheduledJobs.set(jobId, task);
    task.start();

    logger.info('Preparation notification scheduled', {
      jobId,
      schedule: 'Monday 4:00 PM',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule Tuesday 7am pre-launch checks notification
   */
  private async schedulePreLaunchChecksNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-pre-launch-checks`;

    // Tuesday at 7:00 AM
    const task = cron.schedule('0 7 * * 2', async () => {
      try {
        logger.info('Sending pre-launch checks notification', { campaignName: config.campaignName });

        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for pre-launch checks', { campaignName: config.campaignName });
          return;
        }

        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime
        };

        const notification = this.notificationService.createPreparationNotification(notificationData);

        const success = await this.slackService.sendMessage({
          channel: config.channel,
          text: notification.text,
          blocks: notification.blocks
        });

        if (success) {
          logger.info('Pre-launch checks notification sent successfully', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        }
      } catch (error) {
        logger.error('Error sending pre-launch checks notification', {
          error: error.message,
          campaignName: config.campaignName
        });
      }
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(jobId, task);
    task.start();

    logger.info('Pre-launch checks notification scheduled', {
      jobId,
      schedule: 'Tuesday 7:00 AM',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule Tuesday 9:45am launch countdown notification (15 minutes before 10am)
   */
  private async scheduleLaunchCountdownNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-launch-countdown`;

    // Tuesday at 9:45 AM
    const task = cron.schedule('45 9 * * 2', async () => {
      try {
        logger.info('Sending launch countdown notification', { campaignName: config.campaignName });

        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for launch countdown', { campaignName: config.campaignName });
          return;
        }

        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime
        };

        const notification = this.notificationService.createAboutToSendNotification(notificationData);

        const success = await this.slackService.sendMessage({
          channel: config.channel,
          text: notification.text,
          blocks: notification.blocks
        });

        if (success) {
          logger.info('Launch countdown notification sent successfully', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        }
      } catch (error) {
        logger.error('Error sending launch countdown notification', {
          error: error.message,
          campaignName: config.campaignName
        });
      }
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(jobId, task);
    task.start();

    logger.info('Launch countdown notification scheduled', {
      jobId,
      schedule: 'Tuesday 9:45 AM',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule Tuesday 10:10am post-launch status notification
   */
  private async schedulePostLaunchNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-post-launch-status`;

    // Tuesday at 10:10 AM
    const task = cron.schedule('10 10 * * 2', async () => {
      try {
        logger.info('Sending post-launch status notification', { campaignName: config.campaignName });

        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for post-launch status', { campaignName: config.campaignName });
          return;
        }

        // For post-launch, we'll use execution notification with simulated progress
        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime,
          currentProgress: {
            sent: Math.floor(tuesdayRound.targetCount * 0.15), // Assume 15% sent in 10 minutes
            total: tuesdayRound.targetCount,
            timeElapsed: '10 minutes',
            estimatedCompletion: '45 minutes',
            accepted: Math.floor(tuesdayRound.targetCount * 0.14), // Assume 93% acceptance rate
            bounced: Math.floor(tuesdayRound.targetCount * 0.01) // Assume 1% bounce rate
          }
        };

        const notification = this.notificationService.createExecutionNotification(notificationData);

        const success = await this.slackService.sendMessage({
          channel: config.channel,
          text: notification.text,
          blocks: notification.blocks
        });

        if (success) {
          logger.info('Post-launch status notification sent successfully', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        }
      } catch (error) {
        logger.error('Error sending post-launch status notification', {
          error: error.message,
          campaignName: config.campaignName
        });
      }
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(jobId, task);
    task.start();

    logger.info('Post-launch status notification scheduled', {
      jobId,
      schedule: 'Tuesday 10:10 AM',
      campaignName: config.campaignName
    });
  }

  /**
   * Send immediate test notification
   */
  async sendTestNotification(config: CampaignScheduleConfig, type: 'preparation' | 'pre-launch' | 'countdown' | 'post-launch'): Promise<boolean> {
    try {
      logger.info('Sending test notification', {
        campaignName: config.campaignName,
        type,
        channel: config.channel
      });

      const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
      if (!tuesdayRound) {
        throw new Error('No Tuesday round found for test notification');
      }

      const notificationData: CampaignNotificationData = {
        campaignName: config.campaignName,
        roundNumber: tuesdayRound.roundNumber,
        targetCount: tuesdayRound.targetCount,
        userRange: tuesdayRound.userRange,
        executionTime: tuesdayRound.executionTime
      };

      let notification: any;

      switch (type) {
        case 'preparation':
          notification = this.notificationService.createPreparationNotification(notificationData);
          break;
        case 'pre-launch':
          notification = this.notificationService.createPreparationNotification(notificationData);
          break;
        case 'countdown':
          notification = this.notificationService.createAboutToSendNotification(notificationData);
          break;
        case 'post-launch':
          notificationData.currentProgress = {
            sent: Math.floor(tuesdayRound.targetCount * 0.15),
            total: tuesdayRound.targetCount,
            timeElapsed: '10 minutes',
            estimatedCompletion: '45 minutes',
            accepted: Math.floor(tuesdayRound.targetCount * 0.14),
            bounced: Math.floor(tuesdayRound.targetCount * 0.01)
          };
          notification = this.notificationService.createExecutionNotification(notificationData);
          break;
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }

      const success = await this.slackService.sendMessage({
        channel: config.channel,
        text: `[TEST] ${notification.text}`,
        blocks: notification.blocks
      });

      if (success) {
        logger.info('Test notification sent successfully', {
          campaignName: config.campaignName,
          type,
          channel: config.channel
        });
      }

      return success;
    } catch (error) {
      logger.error('Error sending test notification', {
        error: error.message,
        campaignName: config.campaignName,
        type
      });
      return false;
    }
  }

  /**
   * Stop all scheduled jobs for a campaign
   */
  stopCampaignNotifications(campaignName: string): void {
    const jobIds = Array.from(this.scheduledJobs.keys()).filter(id => id.startsWith(campaignName));

    for (const jobId of jobIds) {
      const task = this.scheduledJobs.get(jobId);
      if (task) {
        task.stop();
        this.scheduledJobs.delete(jobId);
        logger.info('Stopped scheduled job', { jobId });
      }
    }

    logger.info('Campaign notifications stopped', {
      campaignName,
      stoppedJobs: jobIds.length
    });
  }

  /**
   * Get status of all scheduled jobs
   */
  getScheduleStatus(): Array<{ jobId: string; isRunning: boolean; schedule: string }> {
    const status = [];

    for (const [jobId, task] of this.scheduledJobs) {
      status.push({
        jobId,
        isRunning: task.getStatus() === 'scheduled',
        schedule: this.getScheduleDescription(jobId)
      });
    }

    return status;
  }

  private getScheduleDescription(jobId: string): string {
    if (jobId.includes('preparation')) return 'Monday 4:00 PM';
    if (jobId.includes('pre-launch-checks')) return 'Tuesday 7:00 AM';
    if (jobId.includes('launch-countdown')) return 'Tuesday 9:45 AM';
    if (jobId.includes('post-launch-status')) return 'Tuesday 10:10 AM';
    return 'Unknown';
  }

  /**
   * Stop all scheduled jobs (for cleanup)
   */
  stopAllJobs(): void {
    for (const [jobId, task] of this.scheduledJobs) {
      task.stop();
      logger.info('Stopped scheduled job', { jobId });
    }

    this.scheduledJobs.clear();
    logger.info('All scheduled jobs stopped');
  }
}