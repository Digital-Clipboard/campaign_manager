import { BaseMCPClient } from './base-mcp-client';
import { logger } from '@/utils/logger';

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  num_members?: number;
}

export interface SlackUser {
  id: string;
  username: string;
  real_name?: string;
  email?: string;
  is_bot: boolean;
}

export interface SlackMessage {
  ts: string;
  channel: string;
  user?: string;
  text: string;
}

export class SlackManagerClient extends BaseMCPClient {
  constructor() {
    super({
      name: 'slack-manager',
      url: process.env.SLACK_MANAGER_URL || 'https://slack-manager-prod.herokuapp.com',
      apiKey: process.env.SLACK_MANAGER_API_KEY,
      timeout: 30000
    });
  }

  // Channel Management
  async getChannelId(channelName: string): Promise<string | null> {
    return this.callTool<string | null>('get_channel_id', { channel_name: channelName });
  }

  async getChannelInfo(channelId: string): Promise<SlackChannel | null> {
    return this.callTool<SlackChannel | null>('get_channel_info', { channel_id: channelId });
  }

  async listChannels(): Promise<SlackChannel[]> {
    return this.callTool<SlackChannel[]>('list_channels') || [];
  }

  async createChannel(name: string, isPrivate: boolean = false): Promise<SlackChannel> {
    return this.callTool<SlackChannel>('create_channel', {
      name,
      is_private: isPrivate
    });
  }

  async archiveChannel(channelId: string): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('archive_channel', {
      channel_id: channelId
    });
    return result.success;
  }

  async inviteToChannel(channelId: string, userIds: string[]): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('invite_to_channel', {
      channel_id: channelId,
      user_ids: userIds
    });
    return result.success;
  }

  // User Management
  async getUserId(username: string): Promise<string | null> {
    return this.callTool<string | null>('get_user_id', { username });
  }

  async getUserInfo(userId: string): Promise<SlackUser | null> {
    return this.callTool<SlackUser | null>('get_user_info', { user_id: userId });
  }

  async listUsers(): Promise<SlackUser[]> {
    return this.callTool<SlackUser[]>('list_users') || [];
  }

  async getUsersInChannel(channelId: string): Promise<SlackUser[]> {
    return this.callTool<SlackUser[]>('get_users_in_channel', {
      channel_id: channelId
    }) || [];
  }

  // Messaging
  async sendMessage(channelId: string, text: string, blocks?: any[]): Promise<SlackMessage> {
    return this.callTool<SlackMessage>('send_message', {
      channel_id: channelId,
      text,
      blocks
    });
  }

  async sendDirectMessage(userId: string, text: string, blocks?: any[]): Promise<SlackMessage> {
    return this.callTool<SlackMessage>('send_direct_message', {
      user_id: userId,
      text,
      blocks
    });
  }

  async updateMessage(channelId: string, ts: string, text: string): Promise<SlackMessage> {
    return this.callTool<SlackMessage>('update_message', {
      channel_id: channelId,
      ts,
      text
    });
  }

  async addReaction(channelId: string, ts: string, emoji: string): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('add_reaction', {
      channel_id: channelId,
      ts,
      emoji
    });
    return result.success;
  }

  // Helper Methods for Campaign Manager specific needs

  async notifyCampaignUpdate(
    campaign: { name: string; status: string; priority: string; targetDate: Date },
    updateType: string
  ): Promise<boolean> {
    try {
      const channelName = process.env.SLACK_CAMPAIGN_CHANNEL || 'campaigns';
      const channelId = await this.getChannelId(channelName);

      if (!channelId) {
        logger.warn(`Slack channel ${channelName} not found`);
        return false;
      }

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Campaign Update: ${campaign.name}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:* ${campaign.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Priority:* ${campaign.priority}`
            },
            {
              type: 'mrkdwn',
              text: `*Target Date:* ${new Date(campaign.targetDate).toLocaleDateString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Update Type:* ${updateType}`
            }
          ]
        }
      ];

      await this.sendMessage(
        channelId,
        `Campaign "${campaign.name}" has been updated`,
        blocks
      );

      return true;

    } catch (error) {
      logger.error('Failed to notify campaign update via Slack', { error });
      return false;
    }
  }

  async notifyTaskAssignment(
    task: { title: string; dueDate: Date; priority: string; description?: string },
    assigneeName: string,
    assigneeUsername?: string
  ): Promise<boolean> {
    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'New Task Assigned'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `You've been assigned a new task: *${task.title}*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Due Date:* ${new Date(task.dueDate).toLocaleDateString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Priority:* ${task.priority}`
            }
          ]
        }
      ];

      if (task.description) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${task.description}`
          }
        });
      }

      // Try to send DM if we have username
      if (assigneeUsername) {
        const userId = await this.getUserId(assigneeUsername);
        if (userId) {
          await this.sendDirectMessage(
            userId,
            `You've been assigned a new task: ${task.title}`,
            blocks
          );
          return true;
        }
      }

      // Fallback to channel
      const channelName = process.env.SLACK_TASKS_CHANNEL || 'tasks';
      const channelId = await this.getChannelId(channelName);

      if (channelId) {
        await this.sendMessage(
          channelId,
          `${assigneeName} has been assigned: ${task.title}`,
          blocks
        );
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to notify task assignment via Slack', { error });
      return false;
    }
  }

  async notifyApprovalRequest(
    approval: { id: string; stage: string; urgency: string; dueDate?: Date; campaignId: string },
    campaignName: string,
    approverUsername?: string
  ): Promise<boolean> {
    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Approval Request'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Campaign *${campaignName}* requires your approval`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Stage:* ${approval.stage}`
            },
            {
              type: 'mrkdwn',
              text: `*Urgency:* ${approval.urgency}`
            },
            {
              type: 'mrkdwn',
              text: `*Due Date:* ${approval.dueDate ? new Date(approval.dueDate).toLocaleDateString() : 'N/A'}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve'
              },
              style: 'primary',
              value: `approve_${approval.id}`,
              action_id: 'approve_campaign'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Reject'
              },
              style: 'danger',
              value: `reject_${approval.id}`,
              action_id: 'reject_campaign'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Details'
              },
              url: `${process.env.APP_URL}/campaigns/${approval.campaignId}`,
              action_id: 'view_campaign'
            }
          ]
        }
      ];

      // Try to send DM to approver
      if (approverUsername) {
        const userId = await this.getUserId(approverUsername);
        if (userId) {
          await this.sendDirectMessage(
            userId,
            `Campaign "${campaignName}" requires your approval`,
            blocks
          );
          return true;
        }
      }

      // Fallback to approvals channel
      const channelName = process.env.SLACK_APPROVALS_CHANNEL || 'approvals';
      const channelId = await this.getChannelId(channelName);

      if (channelId) {
        await this.sendMessage(
          channelId,
          `Campaign "${campaignName}" requires approval`,
          blocks
        );
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to notify approval request via Slack', { error });
      return false;
    }
  }

  async sendDailyDigest(
    username: string,
    stats: {
      activeCampaigns: number;
      pendingTasks: number;
      overdueItems: number;
      todayDeadlines: number;
      pendingApprovals: number;
    }
  ): Promise<boolean> {
    try {
      const userId = await this.getUserId(username);
      if (!userId) {
        logger.warn(`User ${username} not found in Slack`);
        return false;
      }

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Daily Campaign Manager Digest'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Good morning! Here's your campaign overview for ${new Date().toLocaleDateString()}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Active Campaigns:* ${stats.activeCampaigns}`
            },
            {
              type: 'mrkdwn',
              text: `*Pending Tasks:* ${stats.pendingTasks}`
            },
            {
              type: 'mrkdwn',
              text: `*Today's Deadlines:* ${stats.todayDeadlines}`
            },
            {
              type: 'mrkdwn',
              text: `*Pending Approvals:* ${stats.pendingApprovals}`
            }
          ]
        }
      ];

      if (stats.overdueItems > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *You have ${stats.overdueItems} overdue items that need immediate attention*`
          }
        });
      }

      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard'
            },
            url: `${process.env.APP_URL}/dashboard`,
            action_id: 'view_dashboard'
          }
        ]
      });

      await this.sendDirectMessage(
        userId,
        'Your daily campaign digest',
        blocks
      );

      return true;

    } catch (error) {
      logger.error('Failed to send daily digest via Slack', { error });
      return false;
    }
  }

  // ============================================
  // LIFECYCLE-SPECIFIC NOTIFICATION METHODS
  // ============================================

  /**
   * Pre-Launch Notification (T-21h)
   * Sent when campaign is scheduled
   */
  async sendPreLaunchNotification(params: {
    campaignName: string;
    roundNumber: number;
    scheduledDate: Date;
    scheduledTime: string;
    recipientCount: number;
    listName: string;
  }): Promise<SlackMessage> {
    const channelId = await this.getChannelId(process.env.SLACK_LIFECYCLE_CHANNEL || 'lifecycle-campaigns');
    if (!channelId) throw new Error('Lifecycle channel not found');

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📋 Pre-Launch: ${params.campaignName} (Round ${params.roundNumber})`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Scheduled:*\n${params.scheduledDate.toLocaleDateString()} at ${params.scheduledTime} UTC`
          },
          {
            type: 'mrkdwn',
            text: `*Recipients:*\n${params.recipientCount.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*List:*\n${params.listName}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n✅ Scheduled`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⏰ Next notification in ~18 hours (Pre-Flight Check)'
          }
        ]
      }
    ];

    return this.sendMessage(channelId, `Pre-Launch: ${params.campaignName}`, blocks);
  }

  /**
   * Pre-Flight Notification (T-3.25h)
   * Sent with AI analysis and verification results
   */
  async sendPreFlightNotification(params: {
    campaignName: string;
    roundNumber: number;
    scheduledDate: Date;
    scheduledTime: string;
    recipientCount: number;
    listQualityScore: number;
    previousRoundMetrics?: {
      deliveryRate: number;
      bounceRate: number;
      openRate?: number;
    };
    readinessChecks: {
      hasSubject: boolean;
      hasSender: boolean;
      hasContactList: boolean;
      hasContent: boolean;
      listNotEmpty: boolean;
      noBlockedContacts: boolean;
    };
    issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
    aiRecommendations: string[];
  }): Promise<SlackMessage> {
    const channelId = await this.getChannelId(process.env.SLACK_LIFECYCLE_CHANNEL || 'lifecycle-campaigns');
    if (!channelId) throw new Error('Lifecycle channel not found');

    const allChecksPassed = Object.values(params.readinessChecks).every(v => v === true);
    const hasErrors = params.issues.some(i => i.severity === 'error');

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `✈️ Pre-Flight: ${params.campaignName} (Round ${params.roundNumber})`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Campaign Status:* ${allChecksPassed && !hasErrors ? '✅ Ready to Launch' : '⚠️ Issues Detected'}`
        }
      }
    ];

    // Readiness checks
    const checksText = Object.entries(params.readinessChecks)
      .map(([key, value]) => `${value ? '✅' : '❌'} ${key.replace(/([A-Z])/g, ' $1').trim()}`)
      .join('\n');

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Readiness Checks:*\n${checksText}`
        },
        {
          type: 'mrkdwn',
          text: `*List Quality Score:*\n${params.listQualityScore}/100`
        }
      ]
    });

    // Previous round comparison (if available)
    if (params.previousRoundMetrics) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Round ${params.roundNumber - 1} Performance:*\n• Delivery: ${params.previousRoundMetrics.deliveryRate.toFixed(1)}%\n• Bounce: ${params.previousRoundMetrics.bounceRate.toFixed(1)}%${params.previousRoundMetrics.openRate ? `\n• Open: ${params.previousRoundMetrics.openRate.toFixed(1)}%` : ''}`
        }
      });
    }

    // Issues (if any)
    if (params.issues.length > 0) {
      const issuesText = params.issues
        .map(i => {
          const icon = i.severity === 'error' ? '🔴' : i.severity === 'warning' ? '🟡' : 'ℹ️';
          return `${icon} ${i.message}`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Issues:*\n${issuesText}`
        }
      });
    }

    // AI Recommendations
    if (params.aiRecommendations.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Recommendations:*\n${params.aiRecommendations.map(r => `• ${r}`).join('\n')}`
        }
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⏰ Next notification in ~3 hours (Launch Warning)'
        }
      ]
    });

    return this.sendMessage(channelId, `Pre-Flight: ${params.campaignName}`, blocks);
  }

  /**
   * Launch Warning Notification (T-15min)
   * Final warning before launch
   */
  async sendLaunchWarningNotification(params: {
    campaignName: string;
    roundNumber: number;
    scheduledTime: string;
    recipientCount: number;
    finalChecksStatus: 'ready' | 'warning' | 'blocked';
  }): Promise<SlackMessage> {
    const channelId = await this.getChannelId(process.env.SLACK_LIFECYCLE_CHANNEL || 'lifecycle-campaigns');
    if (!channelId) throw new Error('Lifecycle channel not found');

    const statusEmoji = params.finalChecksStatus === 'ready' ? '🚀' : params.finalChecksStatus === 'warning' ? '⚠️' : '🛑';
    const statusText = params.finalChecksStatus === 'ready' ? 'Ready to Launch' : params.finalChecksStatus === 'warning' ? 'Warning - Review Needed' : 'BLOCKED';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Launch Warning: ${params.campaignName}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Campaign launches in 15 minutes!*\nRound ${params.roundNumber} | ${params.recipientCount.toLocaleString()} recipients`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Launch Time:*\n${params.scheduledTime} UTC`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${statusText}`
          }
        ]
      }
    ];

    if (params.finalChecksStatus === 'blocked') {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🛑 *CAMPAIGN BLOCKED* - Critical issues detected. Launch will not proceed automatically.'
        }
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⏰ Launch confirmation in 15 minutes'
        }
      ]
    });

    return this.sendMessage(channelId, `⚠️ LAUNCH WARNING: ${params.campaignName}`, blocks);
  }

  /**
   * Launch Confirmation Notification (T+0)
   * Sent immediately after launch
   */
  async sendLaunchConfirmationNotification(params: {
    campaignName: string;
    roundNumber: number;
    launchedAt: Date;
    recipientCount: number;
    queuedCount: number;
    messageId: string;
    mailjetCampaignId: bigint;
  }): Promise<SlackMessage> {
    const channelId = await this.getChannelId(process.env.SLACK_LIFECYCLE_CHANNEL || 'lifecycle-campaigns');
    if (!channelId) throw new Error('Lifecycle channel not found');

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎯 LAUNCHED: ${params.campaignName} (Round ${params.roundNumber})`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Campaign successfully launched at ${params.launchedAt.toLocaleTimeString()} UTC`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Recipients:*\n${params.recipientCount.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Queued for Delivery:*\n${params.queuedCount.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Campaign ID:*\n${params.mailjetCampaignId.toString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Message ID:*\n\`${params.messageId}\``
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⏰ Wrap-up report in 30 minutes'
          }
        ]
      }
    ];

    return this.sendMessage(channelId, `🎯 LAUNCHED: ${params.campaignName}`, blocks);
  }

  /**
   * Wrap-Up Notification (T+30min)
   * Sent with final metrics and AI analysis
   */
  async sendWrapUpNotification(params: {
    campaignName: string;
    roundNumber: number;
    metrics: {
      processed: number;
      delivered: number;
      bounced: number;
      hardBounces: number;
      softBounces: number;
      deliveryRate: number;
      bounceRate: number;
    };
    comparisonToPrevious?: {
      deliveryRateDelta: number;
      bounceRateDelta: number;
    };
    aiInsights: string[];
    recommendations: string[];
    nextRound?: {
      roundNumber: number;
      scheduledDate: Date;
      scheduledTime: string;
    };
  }): Promise<SlackMessage> {
    const channelId = await this.getChannelId(process.env.SLACK_LIFECYCLE_CHANNEL || 'lifecycle-campaigns');
    if (!channelId) throw new Error('Lifecycle channel not found');

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Wrap-Up: ${params.campaignName} (Round ${params.roundNumber})`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Campaign Metrics (30min post-launch):*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Processed:*\n${params.metrics.processed.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Delivered:*\n${params.metrics.delivered.toLocaleString()} (${params.metrics.deliveryRate.toFixed(1)}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Bounced:*\n${params.metrics.bounced.toLocaleString()} (${params.metrics.bounceRate.toFixed(1)}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Hard Bounces:*\n${params.metrics.hardBounces.toLocaleString()}`
          }
        ]
      }
    ];

    // Comparison to previous round
    if (params.comparisonToPrevious) {
      const deliveryTrend = params.comparisonToPrevious.deliveryRateDelta > 0 ? '📈' : params.comparisonToPrevious.deliveryRateDelta < 0 ? '📉' : '➡️';
      const bounceTrend = params.comparisonToPrevious.bounceRateDelta < 0 ? '📈' : params.comparisonToPrevious.bounceRateDelta > 0 ? '📉' : '➡️';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Comparison to Round ${params.roundNumber - 1}:*\n${deliveryTrend} Delivery: ${params.comparisonToPrevious.deliveryRateDelta > 0 ? '+' : ''}${params.comparisonToPrevious.deliveryRateDelta.toFixed(1)}%\n${bounceTrend} Bounce: ${params.comparisonToPrevious.bounceRateDelta > 0 ? '+' : ''}${params.comparisonToPrevious.bounceRateDelta.toFixed(1)}%`
        }
      });
    }

    // AI Insights
    if (params.aiInsights.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Insights:*\n${params.aiInsights.map(i => `• ${i}`).join('\n')}`
        }
      });
    }

    // Recommendations
    if (params.recommendations.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommendations:*\n${params.recommendations.map(r => `• ${r}`).join('\n')}`
        }
      });
    }

    // Next round preview
    if (params.nextRound) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 Round ${params.nextRound.roundNumber} scheduled for ${params.nextRound.scheduledDate.toLocaleDateString()} at ${params.nextRound.scheduledTime} UTC`
          }
        ]
      });
    }

    return this.sendMessage(channelId, `📊 Wrap-Up: ${params.campaignName}`, blocks);
  }
}