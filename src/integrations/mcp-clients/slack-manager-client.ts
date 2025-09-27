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
}