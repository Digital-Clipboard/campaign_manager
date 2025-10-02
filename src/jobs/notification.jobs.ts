import { Queue, Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification/notification.service';
import { EmailService } from '@/services/notification/email.service';
import { SlackService } from '@/services/notification/slack.service';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Create queue for notification jobs
export const notificationQueue = new Queue('notifications', {
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

// Worker to process notification jobs
export const notificationWorker = new Worker('notifications', async (job) => {
  const emailService = new EmailService();
  const slackService = new SlackService();

  try {
    logger.info('Processing notification job', {
      jobType: job.name,
      jobId: job.id,
      channel: job.data.channel
    });

    const { notificationId, channel, recipient } = job.data;

    // Get notification details
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    let success = false;

    switch (channel) {
      case 'email':
        if (recipient.email) {
          // Generate email based on notification type
          const emailHtml = generateEmailContent(notification, recipient);
          success = await emailService.sendEmail({
            to: recipient.email,
            subject: notification.subject || 'Campaign Manager Notification',
            html: emailHtml
          });
        }
        break;

      case 'slack':
        if (recipient.slackUserId) {
          // Generate Slack message based on notification type
          const slackMessage = generateSlackMessage(notification, recipient);
          success = await slackService.sendMessage({
            userId: recipient.slackUserId,
            ...slackMessage
          });
        }
        break;

      case 'in-app':
        // In-app notifications are already stored in database
        // Just mark as sent
        success = true;
        break;

      default:
        logger.warn('Unknown notification channel', { channel });
    }

    if (success) {
      // Update notification as sent
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          sentAt: new Date(),
          channel // Update with actual channel used
        }
      });

      logger.info('Notification sent successfully', {
        notificationId,
        channel,
        recipientId: recipient.id
      });
    } else {
      // Increment retry count
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          retries: { increment: 1 },
          error: `Failed to send via ${channel}`
        }
      });

      throw new Error(`Failed to send notification via ${channel}`);
    }

    return { success, channel, notificationId };

  } catch (error) {
    logger.error('Failed to process notification job', {
      error: (error as Error).message,
      jobType: job.name,
      jobId: job.id
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}, {
  connection: redis,
  concurrency: 10,
  limiter: {
    max: 20,
    duration: 1000 // Max 20 notifications per second
  }
});

// Helper function to generate email content
function generateEmailContent(notification: any, recipient: any): string {
  const payload = notification.payload || {};

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${notification.subject}</h2>
      <p>Hi ${recipient.name},</p>
      <p>${notification.message}</p>
  `;

  // Add type-specific content
  switch (notification.type) {
    case 'task_overdue':
      html += `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>⚠️ Task Overdue</strong></p>
          <p>Task: ${payload.taskTitle}</p>
          <p>Due Date: ${payload.dueDate}</p>
        </div>
      `;
      break;

    case 'campaign_at_risk':
      html += `
        <div style="background: #f8d7da; border: 1px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>🚨 Campaign At Risk</strong></p>
          <p>Campaign: ${payload.campaignName}</p>
          <p>Risk Factors: ${payload.riskFactors}</p>
        </div>
      `;
      break;

    case 'milestone_completed':
      html += `
        <div style="background: #d1ecf1; border: 1px solid #17a2b8; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>✅ Milestone Completed</strong></p>
          <p>Milestone: ${payload.milestoneName}</p>
          <p>Campaign: ${payload.campaignName}</p>
        </div>
      `;
      break;
  }

  html += `
      <p><a href="${process.env.APP_URL}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View in Dashboard</a></p>
    </div>
  `;

  return html;
}

// Helper function to generate Slack message
function generateSlackMessage(notification: any, recipient: any): any {
  const payload = notification.payload || {};

  const baseMessage = {
    text: notification.subject || notification.message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${notification.subject}*\n${notification.message}`
        }
      }
    ]
  };

  // Add type-specific blocks
  switch (notification.type) {
    case 'task_overdue':
      baseMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Task:* ${payload.taskTitle}\n*Due Date:* ${payload.dueDate}`
        }
      });
      break;

    case 'campaign_at_risk':
      baseMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *Campaign:* ${payload.campaignName}\n*Risk Factors:* ${payload.riskFactors}`
        }
      });
      break;

    case 'milestone_completed':
      baseMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Milestone:* ${payload.milestoneName}\n*Campaign:* ${payload.campaignName}`
        }
      });
      break;
  }

  // Add action button
  baseMessage.blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Details'
        },
        url: `${process.env.APP_URL}`
      }
    ]
  });

  return baseMessage;
}

// Schedule recurring notification jobs
export async function scheduleNotificationJobs() {
  try {
    // Send daily digests at 9 AM
    await notificationQueue.add(
      'send-daily-digests',
      {},
      {
        repeat: {
          pattern: '0 9 * * *' // Daily at 9 AM
        },
        jobId: 'daily-digests-recurring'
      }
    );

    // Send weekly digests on Monday at 9 AM
    await notificationQueue.add(
      'send-weekly-digests',
      {},
      {
        repeat: {
          pattern: '0 9 * * 1' // Monday at 9 AM
        },
        jobId: 'weekly-digests-recurring'
      }
    );

    // Check for overdue tasks every 2 hours
    await notificationQueue.add(
      'check-overdue-tasks',
      {},
      {
        repeat: {
          pattern: '0 */2 * * *' // Every 2 hours
        },
        jobId: 'overdue-tasks-recurring'
      }
    );

    // Send approval reminders 3 times a day
    await notificationQueue.add(
      'send-approval-reminders',
      {},
      {
        repeat: {
          pattern: '0 9,13,17 * * *' // At 9 AM, 1 PM, and 5 PM
        },
        jobId: 'approval-reminders-recurring'
      }
    );

    logger.info('Notification jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule notification jobs', {
      error: (error as Error).message
    });
    throw error;
  }
}

// Process digest jobs
notificationQueue.on('completed', async (job) => {
  if (job.name === 'send-daily-digests' || job.name === 'send-weekly-digests') {
    const notificationService = new NotificationService(prisma);

    try {
      const period = job.name === 'send-daily-digests' ? 'daily' : 'weekly';

      // Get all active team members
      const members = await prisma.teamMember.findMany({
        where: { isActive: true }
      });

      // Send digest to each member
      for (const member of members) {
        await notificationService.sendDigest(member.id, period);
      }

      logger.info(`${period} digests sent`, { memberCount: members.length });
    } catch (error) {
      logger.error('Failed to send digests', {
        error: (error as Error).message,
        jobName: job.name
      });
    } finally {
      await prisma.$disconnect();
    }
  }
});

// Process overdue task notifications
notificationQueue.on('completed', async (job) => {
  if (job.name === 'check-overdue-tasks') {
    const notificationService = new NotificationService(prisma);

    try {
      // Find overdue tasks
      const overdueTasks = await prisma.task.findMany({
        where: {
          status: { in: ['pending', 'in_progress'] },
          dueDate: { lt: new Date() }
        },
        include: {
          assignee: true,
          campaign: true
        }
      });

      // Send notifications for overdue tasks
      for (const task of overdueTasks) {
        if (task.assignee) {
          await notificationService.sendReminder({
            type: 'task',
            recipientId: task.assigneeId!,
            subject: `Task Overdue: ${task.title}`,
            message: `Your task "${task.title}" for ${task.campaign?.name} is overdue`,
            entityId: task.id,
            urgency: 'high'
          });
        }
      }

      logger.info('Overdue task notifications sent', { count: overdueTasks.length });
    } catch (error) {
      logger.error('Failed to check overdue tasks', {
        error: (error as Error).message
      });
    } finally {
      await prisma.$disconnect();
    }
  }
});

// Process approval reminder notifications
notificationQueue.on('completed', async (job) => {
  if (job.name === 'send-approval-reminders') {
    const notificationService = new NotificationService(prisma);

    try {
      // Find approvals due within 24 hours
      const upcomingApprovals = await prisma.approval.findMany({
        where: {
          status: 'pending',
          deadline: {
            gte: new Date(),
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        },
        include: {
          approver: true,
          campaign: true
        }
      });

      // Send reminders
      for (const approval of upcomingApprovals) {
        if (approval.approver) {
          await notificationService.sendReminder({
            type: 'approval',
            recipientId: approval.approverId,
            subject: `Approval Reminder: ${approval.campaign?.name}`,
            message: `Your approval for ${approval.campaign?.name} (${approval.stage} stage) is due soon`,
            entityId: approval.id,
            urgency: approval.urgency as any
          });
        }
      }

      logger.info('Approval reminders sent', { count: upcomingApprovals.length });
    } catch (error) {
      logger.error('Failed to send approval reminders', {
        error: (error as Error).message
      });
    } finally {
      await prisma.$disconnect();
    }
  }
});

// Event handlers
notificationWorker.on('completed', (job) => {
  logger.info('Notification job completed', {
    jobId: job.id,
    jobName: job.name
  });
});

notificationWorker.on('failed', (job, error) => {
  logger.error('Notification job failed', {
    jobId: job?.id,
    jobName: job?.name,
    error: error.message
  });
});