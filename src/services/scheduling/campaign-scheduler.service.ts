import * as cron from 'node-cron';
import { logger } from '../../utils/logger';
import { SlackManagerMCPService } from '../slack-manager-mcp.service';
import { CampaignSlackNotifications, CampaignNotificationData } from '../slack/campaign-notifications';
import { ListQualityAgent } from '../agents/list-quality-agent';

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

    // Schedule the 5 specific notifications requested:
    // 1. Monday 3am UTC (4am London) - day before preparation notification
    // 2. Tuesday 6am UTC (7am London) - pre-launch checks
    // 3. Tuesday 8:45am UTC (9:45am London) - launch countdown (15 minutes before 9am UTC campaign)
    // 4. Tuesday 9:00am UTC (10:00am London) - campaign launch notification
    // 5. Tuesday 9:15am UTC (10:15am London) - post-launch status update (15 min after launch)

    await this.schedulePreparationNotification(config);
    await this.schedulePreLaunchChecksNotification(config);
    await this.scheduleLaunchCountdownNotification(config);
    await this.scheduleLaunchNotification(config);
    await this.schedulePostLaunchNotification(config);

    logger.info('Campaign notifications scheduled successfully', {
      campaignName: config.campaignName,
      totalJobs: this.scheduledJobs.size
    });
  }

  /**
   * Schedule day before preparation notification at 3:00 AM UTC
   */
  private async schedulePreparationNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-preparation`;

    // Day before at 3:00 AM UTC
    const task = cron.schedule('0 3 * * 1', async () => {
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
      schedule: 'Monday 3:00 AM UTC',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule day-of morning pre-launch checks at 6:00 AM UTC
   */
  private async schedulePreLaunchChecksNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-pre-launch-checks`;

    // Day of at 6:00 AM UTC
    const task = cron.schedule('0 6 * * 2', async () => {
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
      schedule: 'Tuesday 6:00 AM UTC',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule 15-minute countdown notification at 8:45 AM UTC (15 min before 9:00 AM launch)
   */
  private async scheduleLaunchCountdownNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-launch-countdown`;

    // Day of at 8:45 AM UTC (15 min before 9:00 AM launch)
    const task = cron.schedule('45 8 * * 2', async () => {
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
      schedule: 'Tuesday 8:45 AM UTC',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule campaign launch notification at 9:00 AM UTC (10:00 AM London)
   */
  private async scheduleLaunchNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-launch`;

    // Day of at 9:00 AM UTC (10:00 AM London - campaign launch time)
    const task = cron.schedule('0 9 * * 2', async () => {
      try {
        logger.info('Sending campaign launch notification', { campaignName: config.campaignName });

        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for launch notification', { campaignName: config.campaignName });
          return;
        }

        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime
        };

        const notification = this.notificationService.createLaunchNotification(notificationData);

        const success = await this.slackService.sendMessage({
          channel: config.channel,
          text: notification.text,
          blocks: notification.blocks
        });

        if (success) {
          logger.info('Campaign launch notification sent successfully', {
            campaignName: config.campaignName,
            channel: config.channel
          });
        }
      } catch (error) {
        logger.error('Error sending campaign launch notification', {
          error: error.message,
          campaignName: config.campaignName
        });
      }
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(jobId, task);
    task.start();

    logger.info('Campaign launch notification scheduled', {
      jobId,
      schedule: 'Tuesday 9:00 AM UTC (10:00 AM London)',
      campaignName: config.campaignName
    });
  }

  /**
   * Schedule post-launch status notification at 9:15 AM UTC (15 min after 9:00 AM launch)
   */
  private async schedulePostLaunchNotification(config: CampaignScheduleConfig): Promise<void> {
    const jobId = `${config.campaignName}-post-launch-status`;

    // Day of at 9:15 AM UTC (10:15 AM London - 15 min after launch)
    const task = cron.schedule('15 9 * * 2', async () => {
      try {
        logger.info('Sending post-launch status notification', { campaignName: config.campaignName });

        const tuesdayRound = config.rounds.find(r => r.executionDay.toLowerCase() === 'tuesday');
        if (!tuesdayRound) {
          logger.warn('No Tuesday round found for post-launch status', { campaignName: config.campaignName });
          return;
        }

        // TODO: Fetch live campaign statistics from MailJet
        // For now, using simulated progress data until MailJet campaign ID tracking is implemented
        // Future: const mailjetClient = new MailjetAgentClient();
        //         const liveStats = await mailjetClient.getEmailStatistics(mailjetCampaignId);

        // Simulated data for demonstration - replace with live MailJet data
        const sent = Math.floor(tuesdayRound.targetCount * 0.15);
        const delivered = Math.floor(tuesdayRound.targetCount * 0.14);
        const bounced = Math.floor(tuesdayRound.targetCount * 0.01);
        const hardBounced = Math.floor(bounced * 0.6); // Assume 60% of bounces are hard
        const softBounced = bounced - hardBounced;

        const notificationData: CampaignNotificationData = {
          campaignName: config.campaignName,
          roundNumber: tuesdayRound.roundNumber,
          targetCount: tuesdayRound.targetCount,
          userRange: tuesdayRound.userRange,
          executionTime: tuesdayRound.executionTime,
          currentProgress: {
            sent,
            total: tuesdayRound.targetCount,
            timeElapsed: '15 minutes',
            estimatedCompletion: '45 minutes',
            accepted: delivered,
            bounced,
            hardBounced,
            softBounced
          }
        };

        // Run AI list quality assessment
        try {
          logger.info('Running AI list quality assessment for post-launch', {
            campaignName: config.campaignName,
            roundNumber: tuesdayRound.roundNumber
          });

          const listQualityAgent = new ListQualityAgent();

          // Get previous round stats if available (Round 2 has Round 1 data)
          const previousRoundStats = tuesdayRound.roundNumber > 1 ? {
            sent: 1000,
            delivered: 970,
            bounced: 30,
            hardBounced: 18,
            softBounced: 12,
            opened: 240,
            clicked: 32,
            deliveryRate: 97.0,
            bounceRate: 3.0,
            openRate: 24.0,
            clickRate: 3.2
          } : undefined;

          const assessment = await listQualityAgent.assessListQuality({
            campaignName: config.campaignName,
            currentRound: tuesdayRound.roundNumber,
            currentStats: {
              sent,
              delivered,
              bounced,
              hardBounced,
              softBounced,
              opened: 0, // Too early for opens in 15 min
              clicked: 0, // Too early for clicks in 15 min
              deliveryRate: (delivered / sent) * 100,
              bounceRate: (bounced / sent) * 100,
              openRate: 0,
              clickRate: 0,
              timeElapsed: '15 minutes'
            },
            previousRoundStats,
            userSegment: tuesdayRound.userRange
          });

          notificationData.listQualityAssessment = assessment;

          logger.info('AI list quality assessment completed', {
            overallQuality: assessment.overallQuality,
            qualityScore: assessment.qualityScore
          });

        } catch (error) {
          logger.error('Failed to run AI list quality assessment', {
            error: error.message,
            campaignName: config.campaignName
          });
          // Continue without AI assessment - notification will just show stats
        }

        const notification = this.notificationService.createPostLaunchNotification(notificationData);

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
      schedule: 'Tuesday 9:15 AM UTC (10:15 AM London)',
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
    if (jobId.includes('preparation')) return 'Monday 3:00 AM UTC';
    if (jobId.includes('pre-launch-checks')) return 'Tuesday 6:00 AM UTC';
    if (jobId.includes('launch-countdown')) return 'Tuesday 8:45 AM UTC (9:45 AM London)';
    if (jobId.includes('-launch') && !jobId.includes('countdown') && !jobId.includes('post')) return 'Tuesday 9:00 AM UTC (10:00 AM London)';
    if (jobId.includes('post-launch-status')) return 'Tuesday 9:15 AM UTC (10:15 AM London)';
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