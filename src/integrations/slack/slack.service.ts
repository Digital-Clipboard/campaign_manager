import { WebClient } from '@slack/web-api';
import { logger } from '@/utils/logger';
import { Campaign, Task, Approval } from '@/types';

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
  thread_ts?: string;
}

export interface SlackNotification {
  type: 'campaign_update' | 'task_assigned' | 'approval_request' | 'deadline_reminder';
  recipient: string;
  data: any;
}

export class SlackService {
  private client: WebClient;
  private botUserId?: string;

  constructor() {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      logger.warn('Slack bot token not configured');
    }
    this.client = new WebClient(token);
    this.initialize();
  }

  private async initialize() {
    try {
      // Test connection and get bot user ID
      const auth = await this.client.auth.test();
      this.botUserId = auth.user_id as string;
      logger.info('Slack service initialized', { botUserId: this.botUserId });
    } catch (error) {
      logger.error('Failed to initialize Slack service', error);
    }
  }

  // Send a message to a Slack channel
  async sendMessage(message: SlackMessage): Promise<boolean> {
    try {
      const result = await this.client.chat.postMessage({
        channel: message.channel,
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
        thread_ts: message.thread_ts
      });

      logger.info('Slack message sent', {
        channel: message.channel,
        ts: result.ts
      });

      return true;
    } catch (error) {
      logger.error('Failed to send Slack message', {
        channel: message.channel,
        error
      });
      return false;
    }
  }

  // Send a direct message to a user
  async sendDirectMessage(userId: string, text: string, blocks?: any[]): Promise<boolean> {
    try {
      // Open a DM channel with the user
      const conversation = await this.client.conversations.open({
        users: userId
      });

      if (!conversation.channel?.id) {
        throw new Error('Failed to open DM channel');
      }

      return await this.sendMessage({
        channel: conversation.channel.id,
        text,
        blocks
      });
    } catch (error) {
      logger.error('Failed to send direct message', {
        userId,
        error
      });
      return false;
    }
  }

  // Send campaign update notification
  async notifyCampaignUpdate(campaign: Campaign, updateType: string): Promise<boolean> {
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

    const channel = process.env.SLACK_CAMPAIGN_CHANNEL || '#campaigns';

    return await this.sendMessage({
      channel,
      text: `Campaign "${campaign.name}" has been updated`,
      blocks
    });
  }

  // Send task assignment notification
  async notifyTaskAssignment(task: Task, assigneeName: string, assigneeSlackId?: string): Promise<boolean> {
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
          },
          {
            type: 'mrkdwn',
            text: `*Estimated Hours:* ${task.estimatedHours}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:* ${task.status}`
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

    // Send DM if we have Slack ID, otherwise send to tasks channel
    if (assigneeSlackId) {
      return await this.sendDirectMessage(
        assigneeSlackId,
        `You've been assigned a new task: ${task.title}`,
        blocks
      );
    } else {
      const channel = process.env.SLACK_TASKS_CHANNEL || '#tasks';
      return await this.sendMessage({
        channel,
        text: `${assigneeName} has been assigned a new task: ${task.title}`,
        blocks
      });
    }
  }

  // Send approval request notification
  async notifyApprovalRequest(approval: Approval, campaignName: string, approverSlackId?: string): Promise<boolean> {
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
            value: `view_${approval.campaignId}`,
            action_id: 'view_campaign'
          }
        ]
      }
    ];

    // Send DM if we have approver's Slack ID
    if (approverSlackId) {
      return await this.sendDirectMessage(
        approverSlackId,
        `Campaign "${campaignName}" requires your approval`,
        blocks
      );
    } else {
      const channel = process.env.SLACK_APPROVALS_CHANNEL || '#approvals';
      return await this.sendMessage({
        channel,
        text: `Campaign "${campaignName}" requires approval`,
        blocks
      });
    }
  }

  // Send deadline reminder
  async sendDeadlineReminder(
    entityType: 'campaign' | 'task',
    entityName: string,
    dueDate: Date,
    recipientSlackId?: string
  ): Promise<boolean> {
    const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const urgency = daysUntil <= 1 ? 'URGENT' : daysUntil <= 3 ? 'Important' : 'Reminder';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${urgency}: ${entityType === 'campaign' ? 'Campaign' : 'Task'} Deadline`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${entityName}* is due ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Due Date:* ${dueDate.toLocaleDateString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Days Remaining:* ${daysUntil}`
          }
        ]
      }
    ];

    if (recipientSlackId) {
      return await this.sendDirectMessage(
        recipientSlackId,
        `${urgency}: ${entityName} is due soon`,
        blocks
      );
    } else {
      const channel = process.env.SLACK_REMINDERS_CHANNEL || '#reminders';
      return await this.sendMessage({
        channel,
        text: `${urgency}: ${entityName} is due soon`,
        blocks
      });
    }
  }

  // Send daily digest
  async sendDailyDigest(
    recipientSlackId: string,
    stats: {
      activeCampaigns: number;
      pendingTasks: number;
      overdueItems: number;
      todayDeadlines: number;
      pendingApprovals: number;
    }
  ): Promise<boolean> {
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

    return await this.sendDirectMessage(
      recipientSlackId,
      'Your daily campaign digest',
      blocks
    );
  }

  // Handle Slack interactive components (button clicks, etc.)
  async handleInteraction(payload: any): Promise<void> {
    try {
      const action = payload.actions[0];
      const user = payload.user;

      switch (action.action_id) {
        case 'approve_campaign':
          // Handle approval
          await this.handleApprovalAction(action.value, 'approved', user.id);
          break;

        case 'reject_campaign':
          // Handle rejection
          await this.handleApprovalAction(action.value, 'rejected', user.id);
          break;

        case 'view_campaign':
          // Send campaign details
          await this.sendCampaignDetails(action.value, payload.response_url);
          break;

        default:
          logger.warn('Unknown Slack action', { actionId: action.action_id });
      }

      // Update the original message to show action taken
      await this.updateInteractiveMessage(payload.response_url, action.action_id);

    } catch (error) {
      logger.error('Error handling Slack interaction', { payload, error });
    }
  }

  private async handleApprovalAction(
    value: string,
    decision: string,
    userId: string
  ): Promise<void> {
    const approvalId = value.split('_')[1];
    logger.info('Processing approval action', { approvalId, decision, userId });

    // This would integrate with the approval service
    // For now, just log the action
  }

  private async sendCampaignDetails(campaignId: string, responseUrl: string): Promise<void> {
    // This would fetch campaign details and send them
    logger.info('Sending campaign details', { campaignId, responseUrl });
  }

  private async updateInteractiveMessage(responseUrl: string, actionTaken: string): Promise<void> {
    // Update the message to show the action was processed
    const actionText = actionTaken === 'approve_campaign' ? 'approved' :
                      actionTaken === 'reject_campaign' ? 'rejected' : 'viewed';

    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replace_original: true,
        text: `Action ${actionText} - processed at ${new Date().toISOString()}`
      })
    });
  }

  // Check if Slack is configured and available
  isAvailable(): boolean {
    return !!process.env.SLACK_BOT_TOKEN && !!this.botUserId;
  }
}