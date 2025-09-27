import { logger } from '@/utils/logger';
import axios from 'axios';

export interface SlackMessage {
  channel?: string;
  userId?: string;
  text: string;
  blocks?: any[];
  threadTs?: string;
  attachments?: any[];
}

/**
 * SlackService - Handles Slack notifications
 */
export class SlackService {
  private botToken: string;
  private appToken: string;
  private defaultChannel: string;
  private baseUrl = 'https://slack.com/api';

  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN || '';
    this.appToken = process.env.SLACK_APP_TOKEN || '';
    this.defaultChannel = process.env.SLACK_DEFAULT_CHANNEL || '#campaign-updates';
  }

  /**
   * Send message to Slack channel or user
   */
  async sendMessage(message: SlackMessage): Promise<boolean> {
    try {
      if (!this.botToken) {
        logger.warn('Slack bot token not configured, skipping Slack notification');
        return false;
      }

      const endpoint = message.userId ? 'chat.postMessage' : 'chat.postMessage';
      const payload: any = {
        text: message.text,
        ...(message.channel && { channel: message.channel }),
        ...(message.userId && { channel: message.userId }), // DM to user
        ...(message.blocks && { blocks: message.blocks }),
        ...(message.threadTs && { thread_ts: message.threadTs }),
        ...(message.attachments && { attachments: message.attachments })
      };

      if (!payload.channel) {
        payload.channel = this.defaultChannel;
      }

      const response = await axios.post(`${this.baseUrl}/${endpoint}`, payload, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.ok) {
        logger.info('Slack message sent successfully', {
          channel: payload.channel,
          ts: response.data.ts
        });
        return true;
      }

      logger.error('Slack message send failed', {
        error: response.data.error,
        channel: payload.channel
      });
      return false;

    } catch (error) {
      logger.error('Failed to send Slack message', {
        error: (error as Error).message,
        channel: message.channel || message.userId
      });
      return false;
    }
  }

  /**
   * Get Slack user ID by email
   */
  async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      if (!this.botToken) {
        return null;
      }

      const response = await axios.get(`${this.baseUrl}/users.lookupByEmail`, {
        params: { email },
        headers: {
          'Authorization': `Bearer ${this.botToken}`
        }
      });

      if (response.data.ok && response.data.user) {
        return response.data.user.id;
      }

      return null;
    } catch (error) {
      logger.error('Failed to lookup Slack user', {
        error: (error as Error).message,
        email
      });
      return null;
    }
  }

  /**
   * Create approval request message with interactive buttons
   */
  createApprovalMessage(data: {
    campaignName: string;
    stage: string;
    urgency: string;
    deadline: string;
    approvalId: string;
    description?: string;
  }): SlackMessage {
    const urgencyEmoji = {
      low: '🟢',
      normal: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    return {
      text: `Approval required for ${data.campaignName}`,
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
            text: `*Campaign:* ${data.campaignName}\n*Stage:* ${data.stage}\n*Priority:* ${urgencyEmoji[data.urgency as keyof typeof urgencyEmoji]} ${data.urgency}\n*Deadline:* ${data.deadline}`
          }
        },
        ...(data.description ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${data.description}`
          }
        }] : []),
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
              action_id: `approve_${data.approvalId}`,
              value: data.approvalId
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '❌ Reject'
              },
              style: 'danger',
              action_id: `reject_${data.approvalId}`,
              value: data.approvalId
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '💬 Request Changes'
              },
              action_id: `changes_${data.approvalId}`,
              value: data.approvalId
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔗 View Details'
              },
              url: `${process.env.APP_URL}/approvals/${data.approvalId}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Create task assignment notification
   */
  createTaskMessage(data: {
    taskTitle: string;
    campaignName: string;
    dueDate: string;
    priority: string;
    description?: string;
    taskId: string;
  }): SlackMessage {
    const priorityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    return {
      text: `New task assigned: ${data.taskTitle}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📌 New Task Assigned'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Task:* ${data.taskTitle}\n*Campaign:* ${data.campaignName}\n*Due Date:* ${data.dueDate}\n*Priority:* ${priorityEmoji[data.priority as keyof typeof priorityEmoji]} ${data.priority}`
          }
        },
        ...(data.description ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${data.description}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👀 View Task'
              },
              url: `${process.env.APP_URL}/tasks/${data.taskId}`
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Mark In Progress'
              },
              action_id: `task_progress_${data.taskId}`,
              value: data.taskId
            }
          ]
        }
      ]
    };
  }

  /**
   * Create campaign status update message
   */
  createStatusUpdateMessage(data: {
    campaignName: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    notes?: string;
    campaignId: string;
  }): SlackMessage {
    const statusEmoji: Record<string, string> = {
      planning: '📝',
      preparation: '🔧',
      review: '👀',
      scheduled: '📅',
      live: '🚀',
      completed: '✅',
      cancelled: '❌'
    };

    return {
      text: `Campaign status updated: ${data.campaignName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔄 Campaign Status Update'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Campaign:* ${data.campaignName}\n*Status:* ${statusEmoji[data.oldStatus]} ${data.oldStatus} → ${statusEmoji[data.newStatus]} ${data.newStatus}\n*Updated by:* ${data.changedBy}`
          }
        },
        ...(data.notes ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes:*\n${data.notes}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Campaign'
              },
              url: `${process.env.APP_URL}/campaigns/${data.campaignId}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Send notification to multiple Slack users
   */
  async sendToMultipleUsers(userIds: string[], message: SlackMessage): Promise<number> {
    let successCount = 0;

    for (const userId of userIds) {
      const sent = await this.sendMessage({
        ...message,
        userId
      });
      if (sent) successCount++;
    }

    return successCount;
  }

  /**
   * Update existing message
   */
  async updateMessage(channel: string, ts: string, message: SlackMessage): Promise<boolean> {
    try {
      if (!this.botToken) {
        return false;
      }

      const payload = {
        channel,
        ts,
        text: message.text,
        ...(message.blocks && { blocks: message.blocks }),
        ...(message.attachments && { attachments: message.attachments })
      };

      const response = await axios.post(`${this.baseUrl}/chat.update`, payload, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.ok;

    } catch (error) {
      logger.error('Failed to update Slack message', {
        error: (error as Error).message,
        channel,
        ts
      });
      return false;
    }
  }
}