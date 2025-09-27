import { logger } from '@/utils/logger';
import { MailjetMCPClient } from './clients/mailjet-mcp.client';
import { SlackMCPClient } from './clients/slack-mcp.client';
import { CacheService } from '@/services/cache/cache.service';
import { PrismaClient } from '@prisma/client';
import {
  Campaign,
  Task,
  Approval,
  TeamMember
} from '@/types';

export interface CampaignEmailRequest {
  campaignId: string;
  templateId: string;
  recipients: Array<{
    email: string;
    name: string;
    variables: Record<string, any>;
  }>;
  scheduledAt?: Date;
  testMode?: boolean;
}

export interface SlackCampaignNotification {
  type: 'status_change' | 'approval_needed' | 'task_assigned' | 'milestone_reached';
  campaignId: string;
  campaignName: string;
  channelId?: string;
  userId?: string;
  message: string;
  attachments?: Array<{
    title: string;
    value: string;
    color?: string;
  }>;
  actions?: Array<{
    type: 'button';
    text: string;
    url: string;
  }>;
}

export interface SlackApprovalRequest {
  approvalId: string;
  campaignId: string;
  stage: string;
  approverId: string;
  slackUserId?: string;
  deadline: Date;
  actions: {
    approve: string;
    reject: string;
    requestChanges: string;
  };
}

export interface EmailPerformanceMetrics {
  campaignId: string;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue?: number;
  };
  trends: {
    openRateTrend: number;
    clickRateTrend: number;
    engagementScore: number;
  };
}

/**
 * MCPClientService - Manages all external MCP integrations
 */
export class MCPClientService {
  private mailjetClient: MailjetMCPClient;
  private slackClient: SlackMCPClient;

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {
    this.mailjetClient = new MailjetMCPClient(cache);
    this.slackClient = new SlackMCPClient(cache);
  }

  /**
   * Sync campaign statistics from Mailjet
   */
  async syncCampaignStatistics(campaignId: string): Promise<void> {
    try {
      logger.info('Syncing campaign statistics from Mailjet', { campaignId });

      // Get campaign details
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          metadata: true
        }
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Check if campaign has Mailjet integration
      const integration = await this.prisma.mCPIntegration.findFirst({
        where: {
          service: 'mailjet',
          internalId: campaignId
        }
      });

      if (!integration) {
        logger.warn('No Mailjet integration found for campaign', { campaignId });
        return;
      }

      // Fetch statistics from Mailjet
      const stats = await this.mailjetClient.getCampaignStatistics(integration.externalId);

      // Store statistics in database
      await this.prisma.emailStatistics.create({
        data: {
          campaignId,
          mailjetId: integration.externalId,
          sent: stats.sent || 0,
          delivered: stats.delivered || 0,
          opened: stats.opened || 0,
          clicked: stats.clicked || 0,
          bounced: stats.bounced || 0,
          unsubscribed: stats.unsubscribed || 0,
          openRate: stats.openRate || 0,
          clickRate: stats.clickRate || 0,
          recordedAt: new Date()
        }
      });

      // Update integration last synced time
      await this.prisma.mCPIntegration.update({
        where: { id: integration.id },
        data: { lastSynced: new Date() }
      });

      // Cache the latest stats
      await this.cache.set(
        `campaign:stats:${campaignId}`,
        JSON.stringify(stats),
        300 // 5 minutes
      );

      logger.info('Campaign statistics synced successfully', {
        campaignId,
        stats: {
          sent: stats.sent,
          opened: stats.opened,
          clicked: stats.clicked
        }
      });

    } catch (error) {
      logger.error('Failed to sync campaign statistics', {
        error: (error as Error).message,
        campaignId
      });
      throw error;
    }
  }

  /**
   * Send campaign emails through Mailjet
   */
  async sendCampaignEmails(request: CampaignEmailRequest): Promise<void> {
    try {
      logger.info('Sending campaign emails through Mailjet', {
        campaignId: request.campaignId,
        recipientCount: request.recipients.length
      });

      // Validate campaign exists
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: request.campaignId }
      });

      if (!campaign) {
        throw new Error(`Campaign ${request.campaignId} not found`);
      }

      // Create or update Mailjet integration
      let integration = await this.prisma.mCPIntegration.findFirst({
        where: {
          service: 'mailjet',
          internalId: request.campaignId
        }
      });

      // Prepare email batch
      const emailBatch = {
        campaignName: campaign.name,
        templateId: request.templateId,
        recipients: request.recipients,
        testMode: request.testMode || false,
        scheduledAt: request.scheduledAt
      };

      // Send through Mailjet MCP
      const result = await this.mailjetClient.sendCampaignEmails(emailBatch);

      // Create or update integration record
      if (!integration) {
        integration = await this.prisma.mCPIntegration.create({
          data: {
            service: 'mailjet',
            externalId: result.campaignId,
            internalId: request.campaignId,
            metadata: {
              templateId: request.templateId,
              recipientCount: request.recipients.length,
              sentAt: new Date().toISOString()
            },
            lastSynced: new Date()
          }
        });
      } else {
        await this.prisma.mCPIntegration.update({
          where: { id: integration.id },
          data: {
            externalId: result.campaignId,
            metadata: {
              templateId: request.templateId,
              recipientCount: request.recipients.length,
              sentAt: new Date().toISOString()
            },
            lastSynced: new Date()
          }
        });
      }

      // Log activity
      await this.prisma.activityLog.create({
        data: {
          entityType: 'campaign',
          entityId: request.campaignId,
          action: 'email_sent',
          metadata: {
            mailjetCampaignId: result.campaignId,
            recipientCount: request.recipients.length,
            templateId: request.templateId
          }
        }
      });

      logger.info('Campaign emails sent successfully', {
        campaignId: request.campaignId,
        mailjetCampaignId: result.campaignId
      });

    } catch (error) {
      logger.error('Failed to send campaign emails', {
        error: (error as Error).message,
        campaignId: request.campaignId
      });
      throw error;
    }
  }

  /**
   * Post notification to Slack
   */
  async postSlackNotification(notification: SlackCampaignNotification): Promise<void> {
    try {
      logger.info('Posting Slack notification', {
        type: notification.type,
        campaignId: notification.campaignId
      });

      // Determine target channel or user
      let target: { type: 'channel' | 'user'; id: string } | undefined;

      if (notification.channelId) {
        target = { type: 'channel', id: notification.channelId };
      } else if (notification.userId) {
        // Get Slack user ID from team member
        const slackIntegration = await this.prisma.slackIntegration.findFirst({
          where: {
            teamMemberId: notification.userId,
            isActive: true
          }
        });

        if (slackIntegration) {
          target = { type: 'user', id: slackIntegration.slackUserId };
        }
      }

      if (!target) {
        // Use default campaign channel if exists
        const campaignChannel = await this.getCampaignSlackChannel(notification.campaignId);
        if (campaignChannel) {
          target = { type: 'channel', id: campaignChannel };
        } else {
          logger.warn('No Slack target found for notification', {
            campaignId: notification.campaignId
          });
          return;
        }
      }

      // Format message for Slack
      const slackMessage = {
        channel: target.type === 'channel' ? target.id : undefined,
        userId: target.type === 'user' ? target.id : undefined,
        text: notification.message,
        blocks: this.formatSlackBlocks(notification)
      };

      // Send through Slack MCP
      await this.slackClient.postMessage(slackMessage);

      // Log activity
      await this.prisma.activityLog.create({
        data: {
          entityType: 'campaign',
          entityId: notification.campaignId,
          action: 'slack_notification',
          metadata: {
            type: notification.type,
            target: target.id,
            message: notification.message
          }
        }
      });

      logger.info('Slack notification posted successfully', {
        campaignId: notification.campaignId,
        target
      });

    } catch (error) {
      logger.error('Failed to post Slack notification', {
        error: (error as Error).message,
        campaignId: notification.campaignId
      });
    }
  }

  /**
   * Create Slack approval request
   */
  async createSlackApproval(approval: SlackApprovalRequest): Promise<void> {
    try {
      logger.info('Creating Slack approval request', {
        approvalId: approval.approvalId,
        campaignId: approval.campaignId
      });

      // Get Slack user ID for approver
      let slackUserId = approval.slackUserId;
      if (!slackUserId) {
        const slackIntegration = await this.prisma.slackIntegration.findFirst({
          where: {
            teamMemberId: approval.approverId,
            isActive: true
          }
        });

        if (!slackIntegration) {
          logger.warn('No Slack integration found for approver', {
            approverId: approval.approverId
          });
          return;
        }

        slackUserId = slackIntegration.slackUserId;
      }

      // Format approval message
      const approvalMessage = {
        userId: slackUserId,
        text: `Approval required for campaign: ${approval.campaignId}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📋 Approval Request'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Campaign:* ${approval.campaignId}\n*Stage:* ${approval.stage}\n*Deadline:* ${approval.deadline.toLocaleString()}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '✅ Approve'
                },
                style: 'primary',
                action_id: `approve_${approval.approvalId}`,
                value: approval.approvalId,
                url: approval.actions.approve
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '❌ Reject'
                },
                style: 'danger',
                action_id: `reject_${approval.approvalId}`,
                value: approval.approvalId,
                url: approval.actions.reject
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '💬 Request Changes'
                },
                action_id: `changes_${approval.approvalId}`,
                value: approval.approvalId,
                url: approval.actions.requestChanges
              }
            ]
          }
        ]
      };

      // Send through Slack MCP
      const result = await this.slackClient.postMessage(approvalMessage);

      // Store Slack message details for tracking
      await this.prisma.mCPIntegration.create({
        data: {
          service: 'slack',
          externalId: result.ts, // Slack timestamp
          internalId: approval.approvalId,
          metadata: {
            type: 'approval',
            slackUserId,
            channel: result.channel,
            messageTs: result.ts
          },
          lastSynced: new Date()
        }
      });

      logger.info('Slack approval request created successfully', {
        approvalId: approval.approvalId,
        slackUserId
      });

    } catch (error) {
      logger.error('Failed to create Slack approval', {
        error: (error as Error).message,
        approvalId: approval.approvalId
      });
      throw error;
    }
  }

  /**
   * Get email performance metrics
   */
  async getEmailPerformanceMetrics(
    campaignId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<EmailPerformanceMetrics> {
    try {
      // Calculate date range based on period
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case 'daily':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      // Get email statistics from database
      const stats = await this.prisma.emailStatistics.findMany({
        where: {
          campaignId,
          recordedAt: {
            gte: startDate,
            lte: now
          }
        },
        orderBy: { recordedAt: 'desc' }
      });

      if (stats.length === 0) {
        return {
          campaignId,
          period,
          metrics: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            unsubscribed: 0
          },
          trends: {
            openRateTrend: 0,
            clickRateTrend: 0,
            engagementScore: 0
          }
        };
      }

      // Calculate aggregated metrics
      const latest = stats[0];
      const previous = stats[stats.length - 1];

      const metrics = {
        sent: latest.sent,
        delivered: latest.delivered,
        opened: latest.opened,
        clicked: latest.clicked,
        bounced: latest.bounced,
        unsubscribed: latest.unsubscribed
      };

      // Calculate trends
      const openRateTrend = previous.openRate > 0
        ? ((latest.openRate - previous.openRate) / previous.openRate) * 100
        : 0;

      const clickRateTrend = previous.clickRate > 0
        ? ((latest.clickRate - previous.clickRate) / previous.clickRate) * 100
        : 0;

      // Calculate engagement score (weighted average)
      const engagementScore =
        (latest.openRate * 0.3) +
        (latest.clickRate * 0.5) +
        ((1 - (latest.bounced / latest.sent)) * 0.2) * 100;

      return {
        campaignId,
        period,
        metrics,
        trends: {
          openRateTrend,
          clickRateTrend,
          engagementScore
        }
      };

    } catch (error) {
      logger.error('Failed to get email performance metrics', {
        error: (error as Error).message,
        campaignId
      });
      throw error;
    }
  }

  /**
   * Sync Slack team members
   */
  async syncSlackTeamMembers(): Promise<void> {
    try {
      logger.info('Syncing Slack team members');

      // Get all users from Slack
      const slackUsers = await this.slackClient.listUsers();

      // Process each Slack user
      for (const slackUser of slackUsers) {
        // Find team member by email
        const teamMember = await this.prisma.teamMember.findFirst({
          where: { email: slackUser.email }
        });

        if (teamMember) {
          // Create or update Slack integration
          await this.prisma.slackIntegration.upsert({
            where: { slackUserId: slackUser.id },
            create: {
              teamMemberId: teamMember.id,
              slackUserId: slackUser.id,
              slackUsername: slackUser.name,
              isActive: !slackUser.deleted,
              channelMappings: []
            },
            update: {
              slackUsername: slackUser.name,
              isActive: !slackUser.deleted
            }
          });
        }
      }

      logger.info('Slack team members synced successfully', {
        userCount: slackUsers.length
      });

    } catch (error) {
      logger.error('Failed to sync Slack team members', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Helper: Get campaign Slack channel
   */
  private async getCampaignSlackChannel(campaignId: string): Promise<string | null> {
    try {
      // Check for mapped channel in metadata
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { metadata: true }
      });

      if (campaign?.metadata && typeof campaign.metadata === 'object') {
        const metadata = campaign.metadata as any;
        if (metadata.slackChannelId) {
          return metadata.slackChannelId;
        }
      }

      // Check for integration mapping
      const integration = await this.prisma.mCPIntegration.findFirst({
        where: {
          service: 'slack',
          internalId: campaignId,
          metadata: {
            path: '$.channelId',
            not: null
          }
        }
      });

      if (integration?.metadata && typeof integration.metadata === 'object') {
        const metadata = integration.metadata as any;
        return metadata.channelId || null;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get campaign Slack channel', {
        error: (error as Error).message,
        campaignId
      });
      return null;
    }
  }

  /**
   * Helper: Format Slack blocks from notification
   */
  private formatSlackBlocks(notification: SlackCampaignNotification): any[] {
    const blocks: any[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: this.getNotificationTitle(notification.type)
      }
    });

    // Main content
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Campaign:* ${notification.campaignName}\n${notification.message}`
      }
    });

    // Attachments
    if (notification.attachments && notification.attachments.length > 0) {
      const fields = notification.attachments.map(att => ({
        type: 'mrkdwn',
        text: `*${att.title}:* ${att.value}`
      }));

      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10) // Slack limit
      });
    }

    // Actions
    if (notification.actions && notification.actions.length > 0) {
      const elements = notification.actions.map((action, index) => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.text
        },
        url: action.url,
        action_id: `action_${index}`
      }));

      blocks.push({
        type: 'actions',
        elements: elements.slice(0, 5) // Slack limit
      });
    }

    return blocks;
  }

  /**
   * Helper: Get notification title
   */
  private getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      status_change: '🔄 Status Update',
      approval_needed: '📋 Approval Required',
      task_assigned: '📌 New Task Assigned',
      milestone_reached: '🎯 Milestone Reached'
    };
    return titles[type] || '📢 Campaign Update';
  }
}