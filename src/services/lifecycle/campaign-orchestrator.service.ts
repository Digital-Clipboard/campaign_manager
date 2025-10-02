/**
 * Campaign Orchestrator Service
 * Orchestrates the entire campaign lifecycle from scheduling to wrap-up
 */

import { CampaignStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';
import { CampaignScheduleService, type CreateCampaignScheduleParams } from './campaign-schedule.service';
import { NotificationService } from './notification.service';
import { PreFlightVerificationService } from './preflight-verification.service';
import { MetricsCollectionService } from './metrics-collection.service';

export interface CampaignCreationParams {
  campaignName: string;
  listIdPrefix: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  totalRecipients: number;
  mailjetListIds: [bigint, bigint, bigint]; // 3 lists for 3 rounds
  mailjetDraftId?: bigint;
  startDate?: Date;
}

export interface CampaignLaunchParams {
  campaignScheduleId: number;
  skipPreFlight?: boolean; // For manual override
}

export interface CampaignOrchestrationResult {
  success: boolean;
  campaignScheduleId: number;
  status: CampaignStatus;
  message: string;
  error?: string;
}

export class CampaignOrchestratorService {
  private scheduleService: CampaignScheduleService;
  private notificationService: NotificationService;
  private preFlightService: PreFlightVerificationService;
  private metricsService: MetricsCollectionService;
  private mailjetClient: MailjetAgentClient;

  constructor() {
    this.scheduleService = new CampaignScheduleService();
    this.notificationService = new NotificationService();
    this.preFlightService = new PreFlightVerificationService();
    this.metricsService = new MetricsCollectionService();
    this.mailjetClient = new MailjetAgentClient();
  }

  /**
   * Create a new campaign with 3 scheduled rounds
   */
  async createCampaign(params: CampaignCreationParams): Promise<{
    success: boolean;
    schedules: Array<{ id: number; roundNumber: number; scheduledDate: Date }>;
    message: string;
  }> {
    logger.info('[CampaignOrchestrator] Creating campaign', {
      campaignName: params.campaignName,
      totalRecipients: params.totalRecipients
    });

    try {
      // Create 3 round schedules
      const scheduleParams: CreateCampaignScheduleParams = {
        campaignName: params.campaignName,
        listIdPrefix: params.listIdPrefix,
        subject: params.subject,
        senderName: params.senderName,
        senderEmail: params.senderEmail,
        totalRecipients: params.totalRecipients,
        mailjetListIds: params.mailjetListIds,
        mailjetDraftId: params.mailjetDraftId,
        startDate: params.startDate || new Date()
      };

      const schedules = await this.scheduleService.createCampaignSchedule(scheduleParams);

      // Send Pre-Launch notifications for all rounds
      for (const schedule of schedules) {
        await this.notificationService.sendPreLaunchNotification(schedule.id);
      }

      logger.info('[CampaignOrchestrator] Campaign created', {
        campaignName: params.campaignName,
        scheduleCount: schedules.length
      });

      return {
        success: true,
        schedules: schedules.map(s => ({
          id: s.id,
          roundNumber: s.roundNumber,
          scheduledDate: s.scheduledDate
        })),
        message: `Campaign "${params.campaignName}" created with 3 rounds`
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Campaign creation failed', {
        campaignName: params.campaignName,
        error
      });

      return {
        success: false,
        schedules: [],
        message: `Failed to create campaign: ${error}`
      };
    }
  }

  /**
   * Run Pre-Flight verification (T-3.25h)
   */
  async runPreFlight(campaignScheduleId: number): Promise<CampaignOrchestrationResult> {
    logger.info('[CampaignOrchestrator] Running Pre-Flight', { campaignScheduleId });

    try {
      // Run verification
      const verificationResult = await this.preFlightService.verify(campaignScheduleId);

      // Send Pre-Flight notification
      await this.notificationService.sendPreFlightNotification(campaignScheduleId);

      // Update campaign status based on verification
      const schedule = await prisma.lifecycleCampaignSchedule.update({
        where: { id: campaignScheduleId },
        data: {
          status: verificationResult.status === 'blocked' ? CampaignStatus.BLOCKED :
                  verificationResult.status === 'ready' ? CampaignStatus.READY :
                  CampaignStatus.SCHEDULED
        }
      });

      return {
        success: true,
        campaignScheduleId,
        status: schedule.status,
        message: `Pre-Flight complete: ${verificationResult.status}`
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Pre-Flight failed', { campaignScheduleId, error });

      return {
        success: false,
        campaignScheduleId,
        status: CampaignStatus.BLOCKED,
        message: 'Pre-Flight verification failed',
        error: String(error)
      };
    }
  }

  /**
   * Send Launch Warning (T-15min)
   */
  async sendLaunchWarning(campaignScheduleId: number): Promise<CampaignOrchestrationResult> {
    logger.info('[CampaignOrchestrator] Sending Launch Warning', { campaignScheduleId });

    try {
      await this.notificationService.sendLaunchWarningNotification(campaignScheduleId);

      const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
        where: { id: campaignScheduleId }
      });

      return {
        success: true,
        campaignScheduleId,
        status: schedule!.status,
        message: 'Launch Warning sent'
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Launch Warning failed', { campaignScheduleId, error });

      return {
        success: false,
        campaignScheduleId,
        status: CampaignStatus.SCHEDULED,
        message: 'Launch Warning failed',
        error: String(error)
      };
    }
  }

  /**
   * Launch campaign (T+0)
   */
  async launchCampaign(params: CampaignLaunchParams): Promise<CampaignOrchestrationResult> {
    logger.info('[CampaignOrchestrator] Launching campaign', {
      campaignScheduleId: params.campaignScheduleId,
      skipPreFlight: params.skipPreFlight
    });

    try {
      const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
        where: { id: params.campaignScheduleId }
      });

      if (!schedule) {
        throw new Error(`Campaign schedule ${params.campaignScheduleId} not found`);
      }

      // Check if campaign is ready to launch
      if (schedule.status === CampaignStatus.BLOCKED && !params.skipPreFlight) {
        return {
          success: false,
          campaignScheduleId: params.campaignScheduleId,
          status: CampaignStatus.BLOCKED,
          message: 'Campaign is blocked. Run Pre-Flight verification or use skipPreFlight flag.',
          error: 'Campaign blocked'
        };
      }

      // Update status to launching
      await prisma.lifecycleCampaignSchedule.update({
        where: { id: params.campaignScheduleId },
        data: { status: CampaignStatus.LAUNCHING }
      });

      // Send campaign via MailJet
      if (!schedule.mailjetCampaignId) {
        throw new Error('No MailJet campaign ID configured');
      }

      const sendResult = await this.mailjetClient.sendCampaignNow(schedule.mailjetCampaignId);

      // Update status to sent
      await prisma.lifecycleCampaignSchedule.update({
        where: { id: params.campaignScheduleId },
        data: { status: CampaignStatus.SENT }
      });

      // Send Launch Confirmation notification
      await this.notificationService.sendLaunchConfirmationNotification(
        params.campaignScheduleId,
        {
          mailjetCampaignId: schedule.mailjetCampaignId,
          messageId: sendResult.messageId,
          queuedCount: sendResult.queuedCount
        }
      );

      logger.info('[CampaignOrchestrator] Campaign launched', {
        campaignScheduleId: params.campaignScheduleId,
        queuedCount: sendResult.queuedCount
      });

      return {
        success: true,
        campaignScheduleId: params.campaignScheduleId,
        status: CampaignStatus.SENT,
        message: `Campaign launched successfully. ${sendResult.queuedCount} emails queued.`
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Campaign launch failed', {
        campaignScheduleId: params.campaignScheduleId,
        error
      });

      // Revert status to scheduled
      await prisma.lifecycleCampaignSchedule.update({
        where: { id: params.campaignScheduleId },
        data: { status: CampaignStatus.SCHEDULED }
      });

      return {
        success: false,
        campaignScheduleId: params.campaignScheduleId,
        status: CampaignStatus.SCHEDULED,
        message: 'Campaign launch failed',
        error: String(error)
      };
    }
  }

  /**
   * Run Wrap-Up analysis (T+30min)
   */
  async runWrapUp(campaignScheduleId: number): Promise<CampaignOrchestrationResult> {
    logger.info('[CampaignOrchestrator] Running Wrap-Up', { campaignScheduleId });

    try {
      // Send Wrap-Up notification (includes metrics collection and AI analysis)
      await this.notificationService.sendWrapUpNotification(campaignScheduleId);

      const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
        where: { id: campaignScheduleId }
      });

      return {
        success: true,
        campaignScheduleId,
        status: schedule!.status,
        message: 'Wrap-Up complete'
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Wrap-Up failed', { campaignScheduleId, error });

      return {
        success: false,
        campaignScheduleId,
        status: CampaignStatus.SENT,
        message: 'Wrap-Up analysis failed',
        error: String(error)
      };
    }
  }

  /**
   * Get campaign status for all rounds
   */
  async getCampaignStatus(campaignName: string): Promise<{
    campaignName: string;
    rounds: Array<{
      roundNumber: number;
      scheduledDate: Date;
      status: CampaignStatus;
      recipientCount: number;
      notificationStatus: any;
      metrics?: {
        deliveryRate: number;
        bounceRate: number;
        openRate?: number;
      };
    }>;
  }> {
    const schedules = await prisma.lifecycleCampaignSchedule.findMany({
      where: { campaignName },
      include: { metrics: { orderBy: { collectedAt: 'desc' }, take: 1 } },
      orderBy: { roundNumber: 'asc' }
    });

    return {
      campaignName,
      rounds: schedules.map(s => ({
        roundNumber: s.roundNumber,
        scheduledDate: s.scheduledDate,
        status: s.status,
        recipientCount: s.recipientCount,
        notificationStatus: s.notificationStatus,
        metrics: s.metrics[0]
          ? {
              deliveryRate: s.metrics[0].deliveryRate,
              bounceRate: s.metrics[0].bounceRate,
              openRate: s.metrics[0].openRate || undefined
            }
          : undefined
      }))
    };
  }

  /**
   * Cancel a scheduled campaign
   */
  async cancelCampaign(campaignScheduleId: number, reason: string): Promise<CampaignOrchestrationResult> {
    logger.info('[CampaignOrchestrator] Cancelling campaign', {
      campaignScheduleId,
      reason
    });

    try {
      const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
        where: { id: campaignScheduleId }
      });

      if (!schedule) {
        throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
      }

      // Can only cancel scheduled or blocked campaigns
      if (schedule.status === CampaignStatus.SENT || schedule.status === CampaignStatus.COMPLETED) {
        return {
          success: false,
          campaignScheduleId,
          status: schedule.status,
          message: 'Cannot cancel a campaign that has already been sent',
          error: 'Campaign already sent'
        };
      }

      // Update status
      await prisma.lifecycleCampaignSchedule.update({
        where: { id: campaignScheduleId },
        data: { status: CampaignStatus.BLOCKED } // Using BLOCKED as cancelled state
      });

      logger.info('[CampaignOrchestrator] Campaign cancelled', {
        campaignScheduleId,
        reason
      });

      return {
        success: true,
        campaignScheduleId,
        status: CampaignStatus.BLOCKED,
        message: `Campaign cancelled: ${reason}`
      };

    } catch (error) {
      logger.error('[CampaignOrchestrator] Campaign cancellation failed', {
        campaignScheduleId,
        error
      });

      return {
        success: false,
        campaignScheduleId,
        status: CampaignStatus.SCHEDULED,
        message: 'Campaign cancellation failed',
        error: String(error)
      };
    }
  }
}
