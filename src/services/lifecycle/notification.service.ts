/**
 * Notification Service
 * Handles all 5 lifecycle notification stages with Slack Block Kit formatting
 */

import { NotificationStage, NotificationStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { SlackManagerClient } from '@/integrations/mcp-clients/slack-manager-client';
import { NotificationLogService } from './notification-log.service';
import { PreFlightVerificationService, type PreFlightResult } from './preflight-verification.service';
import { MetricsCollectionService, type MetricsCollectionResult } from './metrics-collection.service';

export interface NotificationContext {
  campaignScheduleId: number;
  stage: NotificationStage;
  retryAttempt?: number;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  stage: NotificationStage;
  attempt: number;
}

export class NotificationService {
  private slackClient: SlackManagerClient;
  private notificationLogService: NotificationLogService;
  private preFlightService: PreFlightVerificationService;
  private metricsService: MetricsCollectionService;

  private maxRetries = 3;
  private retryDelayMs = 5000; // 5 seconds

  constructor() {
    this.slackClient = new SlackManagerClient();
    this.notificationLogService = new NotificationLogService();
    this.preFlightService = new PreFlightVerificationService();
    this.metricsService = new MetricsCollectionService();
  }

  /**
   * Send Pre-Launch notification (T-21h)
   */
  async sendPreLaunchNotification(campaignScheduleId: number): Promise<NotificationResult> {
    logger.info('[Notification] Sending Pre-Launch notification', { campaignScheduleId });

    const schedule = await this.getSchedule(campaignScheduleId);

    try {
      const slackMessage = await this.slackClient.sendPreLaunchNotification({
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        recipientCount: schedule.recipientCount,
        listName: schedule.listName
      });

      await this.updateNotificationStatus(
        campaignScheduleId,
        'prelaunch',
        true,
        slackMessage.ts
      );

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.PRELAUNCH,
        NotificationStatus.SUCCESS,
        slackMessage.ts
      );

      return {
        success: true,
        messageId: slackMessage.ts,
        stage: NotificationStage.PRELAUNCH,
        attempt: 1
      };

    } catch (error) {
      logger.error('[Notification] Pre-Launch notification failed', { campaignScheduleId, error });

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.PRELAUNCH,
        NotificationStatus.FAILURE,
        undefined,
        String(error)
      );

      return {
        success: false,
        error: String(error),
        stage: NotificationStage.PRELAUNCH,
        attempt: 1
      };
    }
  }

  /**
   * Send Pre-Flight notification (T-3.25h) with AI analysis
   */
  async sendPreFlightNotification(campaignScheduleId: number): Promise<NotificationResult> {
    logger.info('[Notification] Sending Pre-Flight notification', { campaignScheduleId });

    const schedule = await this.getSchedule(campaignScheduleId);

    try {
      // Run pre-flight verification with AI analysis
      const preFlightResult: PreFlightResult = await this.preFlightService.verify(campaignScheduleId);

      const slackMessage = await this.slackClient.sendPreFlightNotification({
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        recipientCount: schedule.recipientCount,
        listQualityScore: preFlightResult.aiAnalysis.listQualityScore,
        previousRoundMetrics: preFlightResult.aiAnalysis.previousRoundMetrics,
        readinessChecks: preFlightResult.checks,
        issues: preFlightResult.issues,
        aiRecommendations: preFlightResult.aiAnalysis.recommendations
      });

      await this.updateNotificationStatus(
        campaignScheduleId,
        'preflight',
        true,
        slackMessage.ts
      );

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.PREFLIGHT,
        NotificationStatus.SUCCESS,
        slackMessage.ts
      );

      // Update campaign status based on pre-flight result
      if (preFlightResult.status === 'blocked') {
        await prisma.lifecycleCampaignSchedule.update({
          where: { id: campaignScheduleId },
          data: { status: 'BLOCKED' }
        });
      } else if (preFlightResult.status === 'ready') {
        await prisma.lifecycleCampaignSchedule.update({
          where: { id: campaignScheduleId },
          data: { status: 'READY' }
        });
      }

      return {
        success: true,
        messageId: slackMessage.ts,
        stage: NotificationStage.PREFLIGHT,
        attempt: 1
      };

    } catch (error) {
      logger.error('[Notification] Pre-Flight notification failed', { campaignScheduleId, error });

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.PREFLIGHT,
        NotificationStatus.FAILURE,
        undefined,
        String(error)
      );

      return {
        success: false,
        error: String(error),
        stage: NotificationStage.PREFLIGHT,
        attempt: 1
      };
    }
  }

  /**
   * Send Launch Warning notification (T-15min)
   */
  async sendLaunchWarningNotification(campaignScheduleId: number): Promise<NotificationResult> {
    logger.info('[Notification] Sending Launch Warning notification', { campaignScheduleId });

    const schedule = await this.getSchedule(campaignScheduleId);

    try {
      // Quick verification check
      const quickCheck = await this.preFlightService.quickVerify(campaignScheduleId);

      const finalChecksStatus: 'ready' | 'warning' | 'blocked' =
        schedule.status === 'BLOCKED' ? 'blocked' :
        !quickCheck.isReady ? 'warning' :
        'ready';

      const slackMessage = await this.slackClient.sendLaunchWarningNotification({
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        scheduledTime: schedule.scheduledTime,
        recipientCount: schedule.recipientCount,
        finalChecksStatus
      });

      await this.updateNotificationStatus(
        campaignScheduleId,
        'launchWarning',
        true,
        slackMessage.ts
      );

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.LAUNCH_WARNING,
        NotificationStatus.SUCCESS,
        slackMessage.ts
      );

      return {
        success: true,
        messageId: slackMessage.ts,
        stage: NotificationStage.LAUNCH_WARNING,
        attempt: 1
      };

    } catch (error) {
      logger.error('[Notification] Launch Warning notification failed', { campaignScheduleId, error });

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.LAUNCH_WARNING,
        NotificationStatus.FAILURE,
        undefined,
        String(error)
      );

      return {
        success: false,
        error: String(error),
        stage: NotificationStage.LAUNCH_WARNING,
        attempt: 1
      };
    }
  }

  /**
   * Send Launch Confirmation notification (T+0)
   */
  async sendLaunchConfirmationNotification(
    campaignScheduleId: number,
    launchData: {
      mailjetCampaignId: bigint;
      messageId: string;
      queuedCount: number;
    }
  ): Promise<NotificationResult> {
    logger.info('[Notification] Sending Launch Confirmation notification', { campaignScheduleId });

    const schedule = await this.getSchedule(campaignScheduleId);

    try {
      const slackMessage = await this.slackClient.sendLaunchConfirmationNotification({
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        launchedAt: new Date(),
        recipientCount: schedule.recipientCount,
        queuedCount: launchData.queuedCount,
        messageId: launchData.messageId,
        mailjetCampaignId: launchData.mailjetCampaignId
      });

      await this.updateNotificationStatus(
        campaignScheduleId,
        'launchConfirmation',
        true,
        slackMessage.ts
      );

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.LAUNCH_CONFIRMATION,
        NotificationStatus.SUCCESS,
        slackMessage.ts
      );

      return {
        success: true,
        messageId: slackMessage.ts,
        stage: NotificationStage.LAUNCH_CONFIRMATION,
        attempt: 1
      };

    } catch (error) {
      logger.error('[Notification] Launch Confirmation notification failed', { campaignScheduleId, error });

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.LAUNCH_CONFIRMATION,
        NotificationStatus.FAILURE,
        undefined,
        String(error)
      );

      return {
        success: false,
        error: String(error),
        stage: NotificationStage.LAUNCH_CONFIRMATION,
        attempt: 1
      };
    }
  }

  /**
   * Send Wrap-Up notification (T+30min) with metrics and AI analysis
   */
  async sendWrapUpNotification(campaignScheduleId: number): Promise<NotificationResult> {
    logger.info('[Notification] Sending Wrap-Up notification', { campaignScheduleId });

    const schedule = await this.getSchedule(campaignScheduleId);

    try {
      // Collect metrics with AI analysis
      const metricsResult: MetricsCollectionResult = await this.metricsService.collectMetrics(campaignScheduleId);

      // Get next round info if exists
      const nextRound = schedule.roundNumber < 3
        ? await prisma.lifecycleCampaignSchedule.findFirst({
            where: {
              campaignName: schedule.campaignName,
              roundNumber: schedule.roundNumber + 1
            }
          })
        : null;

      const slackMessage = await this.slackClient.sendWrapUpNotification({
        campaignName: schedule.campaignName,
        roundNumber: schedule.roundNumber,
        metrics: {
          processed: metricsResult.metrics.processed,
          delivered: metricsResult.metrics.delivered,
          bounced: metricsResult.metrics.bounced,
          hardBounces: metricsResult.metrics.hardBounces,
          softBounces: metricsResult.metrics.softBounces,
          deliveryRate: metricsResult.metrics.deliveryRate,
          bounceRate: metricsResult.metrics.bounceRate
        },
        comparisonToPrevious: metricsResult.aiAnalysis.comparison
          ? {
              deliveryRateDelta: metricsResult.aiAnalysis.comparison.deliveryRateDelta || 0,
              bounceRateDelta: metricsResult.aiAnalysis.comparison.bounceRateDelta || 0
            }
          : undefined,
        aiInsights: metricsResult.aiAnalysis.insights,
        recommendations: metricsResult.aiAnalysis.recommendations,
        nextRound: nextRound
          ? {
              roundNumber: nextRound.roundNumber,
              scheduledDate: nextRound.scheduledDate,
              scheduledTime: nextRound.scheduledTime
            }
          : undefined
      });

      await this.updateNotificationStatus(
        campaignScheduleId,
        'wrapup',
        true,
        slackMessage.ts
      );

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.WRAPUP,
        NotificationStatus.SUCCESS,
        slackMessage.ts
      );

      // Update campaign status to completed
      await prisma.lifecycleCampaignSchedule.update({
        where: { id: campaignScheduleId },
        data: { status: 'COMPLETED' }
      });

      return {
        success: true,
        messageId: slackMessage.ts,
        stage: NotificationStage.WRAPUP,
        attempt: 1
      };

    } catch (error) {
      logger.error('[Notification] Wrap-Up notification failed', { campaignScheduleId, error });

      await this.notificationLogService.logNotification(
        campaignScheduleId,
        NotificationStage.WRAPUP,
        NotificationStatus.FAILURE,
        undefined,
        String(error)
      );

      return {
        success: false,
        error: String(error),
        stage: NotificationStage.WRAPUP,
        attempt: 1
      };
    }
  }

  /**
   * Retry failed notification
   */
  async retryNotification(context: NotificationContext): Promise<NotificationResult> {
    const attempt = (context.retryAttempt || 0) + 1;

    if (attempt > this.maxRetries) {
      logger.warn('[Notification] Max retries reached', {
        campaignScheduleId: context.campaignScheduleId,
        stage: context.stage,
        attempt
      });

      return {
        success: false,
        error: 'Max retries reached',
        stage: context.stage,
        attempt
      };
    }

    logger.info('[Notification] Retrying notification', {
      campaignScheduleId: context.campaignScheduleId,
      stage: context.stage,
      attempt
    });

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));

    // Log retry attempt
    await this.notificationLogService.logNotification(
      context.campaignScheduleId,
      context.stage,
      NotificationStatus.RETRYING
    );

    // Retry based on stage
    switch (context.stage) {
      case NotificationStage.PRELAUNCH:
        return this.sendPreLaunchNotification(context.campaignScheduleId);
      case NotificationStage.PREFLIGHT:
        return this.sendPreFlightNotification(context.campaignScheduleId);
      case NotificationStage.LAUNCH_WARNING:
        return this.sendLaunchWarningNotification(context.campaignScheduleId);
      case NotificationStage.WRAPUP:
        return this.sendWrapUpNotification(context.campaignScheduleId);
      default:
        return {
          success: false,
          error: `Cannot retry stage: ${context.stage}`,
          stage: context.stage,
          attempt
        };
    }
  }

  /**
   * Helper: Get schedule by ID
   */
  private async getSchedule(campaignScheduleId: number) {
    const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id: campaignScheduleId }
    });

    if (!schedule) {
      throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
    }

    return schedule;
  }

  /**
   * Helper: Update notification status in schedule
   */
  private async updateNotificationStatus(
    campaignScheduleId: number,
    stage: string,
    sent: boolean,
    messageId?: string
  ) {
    const schedule = await this.getSchedule(campaignScheduleId);
    const notificationStatus = schedule.notificationStatus as any;

    notificationStatus[stage] = {
      sent,
      timestamp: new Date().toISOString(),
      status: sent ? 'success' : 'failed',
      messageId
    };

    await prisma.lifecycleCampaignSchedule.update({
      where: { id: campaignScheduleId },
      data: { notificationStatus }
    });
  }
}
