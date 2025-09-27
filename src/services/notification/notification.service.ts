import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { EmailService } from './email.service';
import { SlackService } from './slack.service';
import {
  Approval,
  Task,
  Campaign,
  Notification,
  TeamMember
} from '@/types';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Create Redis connection for notification queue
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

/**
 * NotificationService - Handles multi-channel notifications (email, Slack, in-app)
 */
export class NotificationService {
  private emailService: EmailService;
  private slackService: SlackService;
  private notificationQueue: Queue;

  constructor(private prisma: PrismaClient) {
    this.emailService = new EmailService();
    this.slackService = new SlackService();

    // Create notification processing queue
    this.notificationQueue = new Queue('notifications', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: {
          count: 100
        },
        removeOnFail: {
          count: 50
        }
      }
    });
  }

  /**
   * Send notification through multiple channels based on user preferences
   */
  async sendNotification(data: {
    type: string;
    recipientId: string;
    subject: string;
    message: string;
    urgency?: 'low' | 'normal' | 'high' | 'critical';
    channels?: ('email' | 'slack' | 'in-app')[];
    payload?: Record<string, any>;
    campaignId?: string;
  }): Promise<void> {
    try {
      // Get recipient details and preferences
      const recipient = await this.prisma.teamMember.findUnique({
        where: { id: data.recipientId },
        include: {
          notificationPreferences: true
        }
      });

      if (!recipient) {
        logger.error('Recipient not found', { recipientId: data.recipientId });
        return;
      }

      // Determine channels to use
      const channels = data.channels || this.getChannelsForNotification(
        data.type,
        data.urgency || 'normal',
        recipient.notificationPreferences as any
      );

      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          type: data.type,
          recipientId: data.recipientId,
          campaignId: data.campaignId,
          channel: channels[0] || 'in-app', // Primary channel
          urgency: data.urgency || 'normal',
          subject: data.subject,
          message: data.message,
          payload: data.payload || {},
          scheduledFor: new Date(),
          retries: 0,
          maxRetries: 3
        }
      });

      // Queue notifications for each channel
      for (const channel of channels) {
        await this.notificationQueue.add(
          `send-${channel}`,
          {
            notificationId: notification.id,
            channel,
            recipient,
            ...data
          },
          {
            priority: this.getPriorityForUrgency(data.urgency || 'normal')
          }
        );
      }

      logger.info('Notification queued', {
        notificationId: notification.id,
        type: data.type,
        recipientId: data.recipientId,
        channels
      });

    } catch (error) {
      logger.error('Failed to send notification', {
        error: (error as Error).message,
        type: data.type,
        recipientId: data.recipientId
      });
    }
  }

  /**
   * Send approval request notification
   */
  async sendApprovalRequest(approval: Approval): Promise<void> {
    try {
      const approver = await this.prisma.teamMember.findUnique({
        where: { id: approval.approverId }
      });

      if (!approver) {
        logger.error('Approver not found', { approverId: approval.approverId });
        return;
      }

      const deadlineDate = new Date(approval.deadline);
      const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Send email
      if (approver.email) {
        const emailHtml = this.emailService.generateEmailFromTemplate('approval-request', {
          approverName: approver.name,
          campaignName: approval.campaign?.name || 'Campaign',
          stage: approval.stage,
          urgency: approval.urgency,
          deadline: formattedDeadline,
          approvalUrl: `${process.env.APP_URL}/approvals/${approval.id}`
        });

        await this.emailService.sendEmail({
          to: approver.email,
          subject: `Approval Required: ${approval.campaign?.name || 'Campaign'}`,
          html: emailHtml
        });
      }

      // Send Slack notification
      if (approver.slackUserId) {
        const slackMessage = this.slackService.createApprovalMessage({
          campaignName: approval.campaign?.name || 'Campaign',
          stage: approval.stage,
          urgency: approval.urgency,
          deadline: formattedDeadline,
          approvalId: approval.id
        });

        await this.slackService.sendMessage({
          ...slackMessage,
          userId: approver.slackUserId
        });
      }

      // Create in-app notification
      await this.sendNotification({
        type: 'approval_request',
        recipientId: approval.approverId,
        subject: `Approval Required: ${approval.campaign?.name || 'Campaign'}`,
        message: `Your approval is required for the ${approval.stage} stage`,
        urgency: approval.urgency,
        channels: ['in-app'],
        campaignId: approval.campaignId,
        payload: {
          approvalId: approval.id,
          stage: approval.stage,
          deadline: approval.deadline
        }
      });

    } catch (error) {
      logger.error('Failed to send approval request notification', {
        error: (error as Error).message,
        approvalId: approval.id
      });
    }
  }

  /**
   * Send escalation notice
   */
  async sendEscalationNotice(approval: Approval): Promise<void> {
    try {
      const approver = await this.prisma.teamMember.findUnique({
        where: { id: approval.approverId }
      });

      if (!approver) return;

      const deadlineDate = new Date(approval.deadline);
      const now = new Date();
      const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));

      // Send email
      if (approver.email) {
        const emailHtml = this.emailService.generateEmailFromTemplate('approval-escalated', {
          approverName: approver.name,
          campaignName: approval.campaign?.name || 'Campaign',
          stage: approval.stage,
          deadline: deadlineDate.toLocaleDateString(),
          daysOverdue,
          approvalUrl: `${process.env.APP_URL}/approvals/${approval.id}`
        });

        await this.emailService.sendEmail({
          to: approver.email,
          subject: `⚠️ ESCALATED: Approval Overdue - ${approval.campaign?.name}`,
          html: emailHtml
        });
      }

      // Send Slack with high priority
      if (approver.slackUserId) {
        await this.slackService.sendMessage({
          userId: approver.slackUserId,
          text: `⚠️ ESCALATED: Approval for ${approval.campaign?.name} is ${daysOverdue} days overdue!`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚨 Escalated Approval Request'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Campaign:* ${approval.campaign?.name}\n*Stage:* ${approval.stage}\n*Days Overdue:* ${daysOverdue}\n\n⚠️ This approval has been escalated to high priority.`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔥 Review Immediately'
                  },
                  style: 'danger',
                  url: `${process.env.APP_URL}/approvals/${approval.id}`
                }
              ]
            }
          ]
        });
      }

      // Update notification urgency
      await this.sendNotification({
        type: 'escalation',
        recipientId: approval.approverId,
        subject: `ESCALATED: Approval Overdue`,
        message: `Approval for ${approval.campaign?.name} is overdue and has been escalated`,
        urgency: 'critical',
        campaignId: approval.campaignId,
        payload: {
          approvalId: approval.id,
          stage: approval.stage,
          daysOverdue
        }
      });

    } catch (error) {
      logger.error('Failed to send escalation notice', {
        error: (error as Error).message,
        approvalId: approval.id
      });
    }
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignment(task: Task & { assignee?: TeamMember; campaign?: Campaign }): Promise<void> {
    try {
      if (!task.assignee) return;

      const dueDate = new Date(task.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Send email
      if (task.assignee.email) {
        const emailHtml = this.emailService.generateEmailFromTemplate('task-assigned', {
          assigneeName: task.assignee.name,
          taskTitle: task.title,
          campaignName: task.campaign?.name || 'Campaign',
          dueDate,
          priority: task.priority,
          description: task.description || '',
          taskUrl: `${process.env.APP_URL}/tasks/${task.id}`
        });

        await this.emailService.sendEmail({
          to: task.assignee.email,
          subject: `New Task: ${task.title}`,
          html: emailHtml
        });
      }

      // Send Slack notification
      if (task.assignee.slackUserId) {
        const slackMessage = this.slackService.createTaskMessage({
          taskTitle: task.title,
          campaignName: task.campaign?.name || 'Campaign',
          dueDate,
          priority: task.priority,
          description: task.description,
          taskId: task.id
        });

        await this.slackService.sendMessage({
          ...slackMessage,
          userId: task.assignee.slackUserId
        });
      }

      // Create in-app notification
      await this.sendNotification({
        type: 'task_assigned',
        recipientId: task.assigneeId!,
        subject: `New Task: ${task.title}`,
        message: `You have been assigned a new task for ${task.campaign?.name}`,
        urgency: task.priority === 'critical' ? 'high' : 'normal',
        campaignId: task.campaignId,
        payload: {
          taskId: task.id,
          dueDate: task.dueDate,
          priority: task.priority
        }
      });

    } catch (error) {
      logger.error('Failed to send task assignment notification', {
        error: (error as Error).message,
        taskId: task.id
      });
    }
  }

  /**
   * Send campaign status update notification
   */
  async sendCampaignStatusUpdate(data: {
    campaign: Campaign;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    notes?: string;
    recipientIds: string[];
  }): Promise<void> {
    try {
      // Get all recipients
      const recipients = await this.prisma.teamMember.findMany({
        where: {
          id: { in: data.recipientIds }
        }
      });

      // Send to each recipient
      for (const recipient of recipients) {
        // Email notification
        if (recipient.email) {
          const emailHtml = this.emailService.generateEmailFromTemplate('campaign-status-change', {
            recipientName: recipient.name,
            campaignName: data.campaign.name,
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
            changedBy: data.changedBy,
            changedAt: new Date().toLocaleString(),
            notes: data.notes,
            campaignUrl: `${process.env.APP_URL}/campaigns/${data.campaign.id}`
          });

          await this.emailService.sendEmail({
            to: recipient.email,
            subject: `Campaign Update: ${data.campaign.name}`,
            html: emailHtml
          });
        }

        // Slack notification
        if (recipient.slackUserId) {
          const slackMessage = this.slackService.createStatusUpdateMessage({
            campaignName: data.campaign.name,
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
            changedBy: data.changedBy,
            notes: data.notes,
            campaignId: data.campaign.id
          });

          await this.slackService.sendMessage({
            ...slackMessage,
            userId: recipient.slackUserId
          });
        }
      }

      // Create in-app notifications
      await Promise.all(
        data.recipientIds.map(recipientId =>
          this.sendNotification({
            type: 'campaign_status_update',
            recipientId,
            subject: `Campaign Update: ${data.campaign.name}`,
            message: `Status changed from ${data.oldStatus} to ${data.newStatus}`,
            urgency: 'normal',
            campaignId: data.campaign.id,
            payload: {
              oldStatus: data.oldStatus,
              newStatus: data.newStatus,
              changedBy: data.changedBy,
              notes: data.notes
            }
          })
        )
      );

    } catch (error) {
      logger.error('Failed to send campaign status update', {
        error: (error as Error).message,
        campaignId: data.campaign.id
      });
    }
  }

  /**
   * Send reminder notifications
   */
  async sendReminder(data: {
    type: 'approval' | 'task' | 'deadline';
    recipientId: string;
    subject: string;
    message: string;
    entityId: string;
    urgency?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<void> {
    await this.sendNotification({
      type: `${data.type}_reminder`,
      recipientId: data.recipientId,
      subject: data.subject,
      message: data.message,
      urgency: data.urgency || 'normal',
      payload: {
        entityId: data.entityId,
        reminderType: data.type
      }
    });
  }

  /**
   * Send digest notifications (daily/weekly summaries)
   */
  async sendDigest(recipientId: string, period: 'daily' | 'weekly'): Promise<void> {
    try {
      const recipient = await this.prisma.teamMember.findUnique({
        where: { id: recipientId }
      });

      if (!recipient) return;

      // Get pending tasks and approvals
      const [pendingTasks, pendingApprovals] = await Promise.all([
        this.prisma.task.findMany({
          where: {
            assigneeId: recipientId,
            status: { in: ['pending', 'in_progress'] }
          },
          include: { campaign: true },
          take: 10,
          orderBy: { dueDate: 'asc' }
        }),
        this.prisma.approval.findMany({
          where: {
            approverId: recipientId,
            status: 'pending'
          },
          include: { campaign: true },
          take: 10,
          orderBy: { deadline: 'asc' }
        })
      ]);

      if (pendingTasks.length === 0 && pendingApprovals.length === 0) {
        return; // No digest needed
      }

      // Create digest content
      let digestHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your ${period === 'daily' ? 'Daily' : 'Weekly'} Campaign Manager Digest</h2>
          <p>Hi ${recipient.name},</p>
          <p>Here's your ${period} summary:</p>
      `;

      if (pendingTasks.length > 0) {
        digestHtml += `
          <h3>📋 Pending Tasks (${pendingTasks.length})</h3>
          <ul>
        `;
        for (const task of pendingTasks) {
          const dueDate = new Date(task.dueDate).toLocaleDateString();
          digestHtml += `<li><strong>${task.title}</strong> - ${task.campaign?.name} (Due: ${dueDate})</li>`;
        }
        digestHtml += '</ul>';
      }

      if (pendingApprovals.length > 0) {
        digestHtml += `
          <h3>✅ Pending Approvals (${pendingApprovals.length})</h3>
          <ul>
        `;
        for (const approval of pendingApprovals) {
          const deadline = new Date(approval.deadline).toLocaleDateString();
          digestHtml += `<li><strong>${approval.campaign?.name}</strong> - ${approval.stage} stage (Deadline: ${deadline})</li>`;
        }
        digestHtml += '</ul>';
      }

      digestHtml += `
          <p><a href="${process.env.APP_URL}/dashboard" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Dashboard</a></p>
        </div>
      `;

      // Send digest email
      if (recipient.email) {
        await this.emailService.sendEmail({
          to: recipient.email,
          subject: `Your ${period === 'daily' ? 'Daily' : 'Weekly'} Campaign Digest`,
          html: digestHtml
        });
      }

      logger.info('Digest sent', {
        recipientId,
        period,
        taskCount: pendingTasks.length,
        approvalCount: pendingApprovals.length
      });

    } catch (error) {
      logger.error('Failed to send digest', {
        error: (error as Error).message,
        recipientId,
        period
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() }
    });
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        readAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return notifications as Notification[];
  }

  /**
   * Notify that next approval stage is ready
   */
  async notifyNextStageReady(campaignId: string, nextStage: string): Promise<void> {
    try {
      // Get all approvers for the next stage
      const approvals = await this.prisma.approval.findMany({
        where: {
          campaignId,
          stage: nextStage,
          status: 'pending'
        },
        include: {
          campaign: true,
          approver: true
        }
      });

      // Send notifications to all approvers
      for (const approval of approvals) {
        if (approval.approver) {
          await this.sendApprovalRequest(approval as any);
        }
      }

      logger.info('Next stage notifications sent', {
        campaignId,
        nextStage,
        approverCount: approvals.length
      });

    } catch (error) {
      logger.error('Failed to notify next stage ready', {
        error: (error as Error).message,
        campaignId,
        nextStage
      });
    }
  }

  /**
   * Notify when approval is blocked
   */
  async notifyApprovalBlocked(approval: Approval): Promise<void> {
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: approval.campaignId },
        select: {
          createdBy: true,
          name: true,
          team: {
            include: {
              member: true
            }
          }
        }
      });

      if (!campaign) return;

      // Notify campaign owner
      if (campaign.createdBy) {
        await this.sendNotification({
          type: 'approval_blocked',
          recipientId: campaign.createdBy,
          subject: `Approval ${approval.status === 'rejected' ? 'Rejected' : 'Needs Changes'}: ${campaign.name}`,
          message: `The ${approval.stage} stage approval has been ${approval.status === 'rejected' ? 'rejected' : 'marked for changes'}`,
          urgency: 'high',
          campaignId: approval.campaignId,
          payload: {
            approvalId: approval.id,
            stage: approval.stage,
            status: approval.status,
            comments: approval.comments
          }
        });
      }

      // Notify all campaign team members
      const teamMemberIds = campaign.team
        ?.filter(tm => tm.role === 'owner' || tm.role === 'contributor')
        .map(tm => tm.memberId) || [];

      for (const memberId of teamMemberIds) {
        await this.sendNotification({
          type: 'approval_blocked',
          recipientId: memberId,
          subject: `Approval Blocked: ${campaign.name}`,
          message: `The ${approval.stage} stage needs attention`,
          urgency: 'normal',
          campaignId: approval.campaignId,
          payload: {
            approvalId: approval.id,
            stage: approval.stage,
            status: approval.status
          }
        });
      }

    } catch (error) {
      logger.error('Failed to notify approval blocked', {
        error: (error as Error).message,
        approvalId: approval.id
      });
    }
  }

  /**
   * Helper: Determine notification channels based on type and urgency
   */
  private getChannelsForNotification(
    type: string,
    urgency: string,
    preferences?: any
  ): ('email' | 'slack' | 'in-app')[] {
    const channels: ('email' | 'slack' | 'in-app')[] = ['in-app'];

    // Always include in-app
    // Add email for important notifications
    if (['approval_request', 'escalation', 'approval_blocked'].includes(type) ||
        urgency === 'high' || urgency === 'critical') {
      channels.push('email');
    }

    // Add Slack for urgent notifications
    if (urgency === 'high' || urgency === 'critical') {
      channels.push('slack');
    }

    // Override with user preferences if available
    if (preferences) {
      // Implementation based on user preference model
    }

    return [...new Set(channels)]; // Remove duplicates
  }

  /**
   * Helper: Get queue priority for urgency level
   */
  private getPriorityForUrgency(urgency: string): number {
    const priorities: Record<string, number> = {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4
    };
    return priorities[urgency] || 3;
  }
}