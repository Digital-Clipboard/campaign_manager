import { Queue } from 'bullmq';
import { queueRedis } from '../utils/redis';
import { logger } from '../utils/logger';
import { SlackManagerMCPService } from '../services/slack-manager-mcp.service';
import { CampaignSlackNotifications, CampaignNotificationData } from '../services/slack/campaign-notifications';
import { CampaignReportOrchestrator } from '../services/agents/campaign-report-orchestrator';
import { EmailStatistics } from '../integrations/mcp-clients/mailjet-agent-client';

// Campaign lifecycle notification job data
export interface CampaignLifecycleJobData {
  campaignName: string;
  roundNumber: number;
  targetCount: number;
  userRange: string;
  executionTime: string;
  channel: string;
  notificationType: 'preparation' | 'pre-launch' | 'countdown' | 'launch' | 'post-launch' | 'completion';
  previousRoundStats?: {
    sent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  currentProgress?: {
    sent: number;
    total: number;
    timeElapsed: string;
    estimatedCompletion: string;
    accepted: number;
    bounced: number;
  };
  finalStats?: {
    totalSent: number;
    delivered: number;
    deliveryRate: number;
    bounced: number;
    bounceRate: number;
    duration: string;
  };
}

// Create queue for campaign lifecycle notifications
export const campaignLifecycleQueue = new Queue<CampaignLifecycleJobData>('campaign-lifecycle', {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      count: 50
    },
    removeOnFail: {
      count: 25
    }
  }
});

/**
 * Queue a campaign lifecycle notification
 */
export async function queueCampaignNotification(
  jobData: CampaignLifecycleJobData,
  delay?: number
): Promise<void> {
  try {
    const jobOptions: any = {
      jobId: `${jobData.campaignName}-${jobData.notificationType}-${Date.now()}`
    };

    if (delay) {
      jobOptions.delay = delay;
    }

    await campaignLifecycleQueue.add(
      `campaign-${jobData.notificationType}`,
      jobData,
      jobOptions
    );

    logger.info('Campaign notification queued', {
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType,
      roundNumber: jobData.roundNumber,
      delay: delay || 0
    });

  } catch (error) {
    logger.error('Failed to queue campaign notification', {
      error: error.message,
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType
    });
    throw error;
  }
}

/**
 * Schedule immediate campaign notification for testing
 */
export async function sendImmediateCampaignNotification(jobData: CampaignLifecycleJobData): Promise<boolean> {
  try {
    logger.info('Sending immediate campaign notification', {
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType,
      channel: jobData.channel
    });

    const slackService = new SlackManagerMCPService();
    const notificationService = new CampaignSlackNotifications();

    const notificationData: CampaignNotificationData = {
      campaignName: jobData.campaignName,
      roundNumber: jobData.roundNumber,
      targetCount: jobData.targetCount,
      userRange: jobData.userRange,
      executionTime: jobData.executionTime,
      previousRoundStats: jobData.previousRoundStats,
      currentProgress: jobData.currentProgress,
      finalStats: jobData.finalStats
    };

    let notification: any;

    // Generate appropriate notification based on type
    switch (jobData.notificationType) {
      case 'preparation':
        notification = notificationService.createPreparationNotification(notificationData);
        break;
      case 'pre-launch':
        notification = notificationService.createPreparationNotification(notificationData);
        break;
      case 'countdown':
        notification = notificationService.createAboutToSendNotification(notificationData);
        break;
      case 'launch':
        notification = notificationService.createLaunchNotification(notificationData);
        break;
      case 'post-launch':
        notification = notificationService.createPostLaunchNotification(notificationData);
        break;
      case 'completion':
        notification = notificationService.createCompletionNotification(notificationData);
        break;
      default:
        throw new Error(`Unknown notification type: ${jobData.notificationType}`);
    }

    // Send notification with test prefix
    const success = await slackService.sendMessage({
      channel: jobData.channel,
      text: `[TEST] ${notification.text}`,
      blocks: notification.blocks
    });

    if (success) {
      logger.info('Immediate campaign notification sent successfully', {
        campaignName: jobData.campaignName,
        notificationType: jobData.notificationType,
        channel: jobData.channel
      });
    } else {
      logger.error('Failed to send immediate campaign notification', {
        campaignName: jobData.campaignName,
        notificationType: jobData.notificationType,
        channel: jobData.channel
      });
    }

    return success;

  } catch (error) {
    logger.error('Error sending immediate campaign notification', {
      error: error.message,
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType
    });
    return false;
  }
}

/**
 * Process campaign lifecycle notification job
 */
export async function processCampaignLifecycleJob(jobData: CampaignLifecycleJobData): Promise<boolean> {
  try {
    logger.info('Processing campaign lifecycle notification', {
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType,
      channel: jobData.channel
    });

    const slackService = new SlackManagerMCPService();
    const notificationService = new CampaignSlackNotifications();

    const notificationData: CampaignNotificationData = {
      campaignName: jobData.campaignName,
      roundNumber: jobData.roundNumber,
      targetCount: jobData.targetCount,
      userRange: jobData.userRange,
      executionTime: jobData.executionTime,
      previousRoundStats: jobData.previousRoundStats,
      currentProgress: jobData.currentProgress,
      finalStats: jobData.finalStats
    };

    let notification: any;

    // Generate appropriate notification based on type
    switch (jobData.notificationType) {
      case 'preparation':
        notification = notificationService.createPreparationNotification(notificationData);
        break;
      case 'pre-launch':
        notification = notificationService.createPreparationNotification(notificationData);
        break;
      case 'countdown':
        notification = notificationService.createAboutToSendNotification(notificationData);
        break;
      case 'launch':
        notification = notificationService.createLaunchNotification(notificationData);
        break;
      case 'post-launch':
        notification = notificationService.createPostLaunchNotification(notificationData);
        break;
      case 'completion':
        // Use AI-enhanced reporting for completion notifications
        try {
          logger.info('Generating AI-enhanced completion report', {
            campaignName: jobData.campaignName,
            roundNumber: jobData.roundNumber
          });

          const orchestrator = new CampaignReportOrchestrator();

          // Convert finalStats to EmailStatistics format
          const currentStats: EmailStatistics = {
            campaignId: `${jobData.campaignName}-round-${jobData.roundNumber}`,
            sent: jobData.finalStats?.totalSent || jobData.targetCount,
            delivered: jobData.finalStats?.delivered || 0,
            opened: 0, // Will be populated by MailJet if available
            clicked: 0,
            bounced: jobData.finalStats?.bounced || 0,
            hardBounced: 0,
            softBounced: 0,
            spam: 0,
            unsubscribed: 0,
            deliveryRate: jobData.finalStats?.deliveryRate || 0,
            openRate: 0, // Will be populated by MailJet if available
            clickRate: 0,
            bounceRate: jobData.finalStats?.bounceRate || 0
          };

          const report = await orchestrator.generateCampaignReport({
            campaignName: jobData.campaignName,
            roundNumber: jobData.roundNumber,
            currentStats
          });

          notification = notificationService.createAIEnhancedCompletionNotification(
            jobData.campaignName,
            jobData.roundNumber,
            report
          );

          logger.info('AI-enhanced completion report generated successfully');
        } catch (error) {
          logger.error('Failed to generate AI-enhanced report, falling back to basic notification', {
            error: error.message
          });
          // Fallback to basic notification if AI fails
          notification = notificationService.createCompletionNotification(notificationData);
        }
        break;
      default:
        throw new Error(`Unknown notification type: ${jobData.notificationType}`);
    }

    // Send notification (without test prefix for scheduled notifications)
    const success = await slackService.sendMessage({
      channel: jobData.channel,
      text: notification.text,
      blocks: notification.blocks
    });

    if (success) {
      logger.info('Campaign lifecycle notification sent successfully', {
        campaignName: jobData.campaignName,
        notificationType: jobData.notificationType,
        channel: jobData.channel
      });
    } else {
      logger.error('Failed to send campaign lifecycle notification', {
        campaignName: jobData.campaignName,
        notificationType: jobData.notificationType,
        channel: jobData.channel
      });
    }

    return success;

  } catch (error) {
    logger.error('Error processing campaign lifecycle notification', {
      error: error.message,
      campaignName: jobData.campaignName,
      notificationType: jobData.notificationType
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Helper to create "Client Letter Automation" campaign notification data
 */
export function createClientLetterAutomationJobData(
  notificationType: CampaignLifecycleJobData['notificationType'],
  roundNumber: number = 2, // Default to Tuesday round
  channel: string = '#_traction'
): CampaignLifecycleJobData {
  const campaignName = 'Client Letter Automation';

  // 3-phase rollout: 1000 recipients each (Friday, Tuesday, Thursday)
  const rounds = {
    1: { day: 'Friday', time: '10:00 AM', userRange: 'Users 1-1,000' },
    2: { day: 'Tuesday', time: '10:00 AM', userRange: 'Users 1,001-2,000' },
    3: { day: 'Thursday', time: '10:00 AM', userRange: 'Users 2,001-3,000' }
  };

  const roundData = rounds[roundNumber] || rounds[2];

  const baseJobData: CampaignLifecycleJobData = {
    campaignName,
    roundNumber,
    targetCount: 1000,
    userRange: roundData.userRange,
    executionTime: roundData.time,
    channel,
    notificationType
  };

  // Add round-specific data based on notification type
  if (notificationType === 'post-launch') {
    baseJobData.currentProgress = {
      sent: Math.floor(1000 * 0.15), // 15% sent in 10 minutes
      total: 1000,
      timeElapsed: '10 minutes',
      estimatedCompletion: '45 minutes',
      accepted: Math.floor(1000 * 0.14), // 93% acceptance rate
      bounced: Math.floor(1000 * 0.01) // 1% bounce rate
    };
  }

  if (notificationType === 'completion') {
    baseJobData.finalStats = {
      totalSent: 1000,
      delivered: 970,
      deliveryRate: 97,
      bounced: 30,
      bounceRate: 3,
      duration: '52 minutes'
    };
  }

  // Add previous round stats for preparation notifications (if round > 1)
  if ((notificationType === 'preparation' || notificationType === 'pre-launch') && roundNumber > 1) {
    baseJobData.previousRoundStats = {
      sent: 1000,
      deliveryRate: 97.2,
      openRate: 24.8,
      clickRate: 3.2
    };
  }

  return baseJobData;
}

// Event handlers for the queue
campaignLifecycleQueue.on('completed', (job, result) => {
  logger.info('Campaign lifecycle job completed', {
    jobId: job.id,
    jobName: job.name,
    campaignName: job.data.campaignName,
    notificationType: job.data.notificationType,
    result
  });
});

campaignLifecycleQueue.on('failed', (job, error) => {
  logger.error('Campaign lifecycle job failed', {
    jobId: job?.id,
    jobName: job?.name,
    campaignName: job?.data?.campaignName,
    notificationType: job?.data?.notificationType,
    error: error.message,
    attempts: job?.attemptsMade
  });
});

campaignLifecycleQueue.on('stalled', (jobId) => {
  logger.warn('Campaign lifecycle job stalled', { jobId });
});