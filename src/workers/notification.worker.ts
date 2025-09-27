import { Worker, Job } from 'bullmq';
import { queueRedis } from '@/utils/redis';
import { NotificationJobData } from './queue.config';
import { logger, createPerformanceLogger } from '@/utils/logger';

// Notification worker processor
async function processNotificationJob(job: Job<NotificationJobData>): Promise<any> {
  const perf = createPerformanceLogger(`notification-${job.data.type}`);

  try {
    await job.updateProgress(10);

    const { type, recipientId, channel, urgency } = job.data;

    logger.info('Processing notification job', {
      jobId: job.id,
      type,
      recipientId,
      channel,
      urgency
    });

    // Route to appropriate notification handler
    switch (channel) {
      case 'slack':
        await sendSlackNotification(job.data);
        break;
      case 'email':
        await sendEmailNotification(job.data);
        break;
      case 'in-app':
        await sendInAppNotification(job.data);
        break;
      case 'sms':
        await sendSMSNotification(job.data);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }

    await job.updateProgress(100);

    const duration = perf.finish({ recipientId, channel });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      channel,
      recipientId
    };

  } catch (error) {
    perf.error(error as Error, { jobData: job.data });
    throw error; // Re-throw to mark job as failed
  }
}

// Slack notification handler
async function sendSlackNotification(data: NotificationJobData): Promise<void> {
  // This will be implemented when we integrate with Slack Manager MCP
  logger.info('Slack notification would be sent', { data });

  // Simulated delay for now
  await new Promise(resolve => setTimeout(resolve, 100));

  // TODO: Implement actual Slack MCP call
  // const slackManager = await getMCPClient('slack');
  // await slackManager.callTool('slack_send_dm', {
  //   user_id: data.recipientId,
  //   message: data.message
  // });
}

// Email notification handler
async function sendEmailNotification(data: NotificationJobData): Promise<void> {
  logger.info('Email notification would be sent', { data });

  // Simulated delay for now
  await new Promise(resolve => setTimeout(resolve, 150));

  // TODO: Implement actual email sending
  // This could use Mailjet MCP or direct SMTP
}

// In-app notification handler
async function sendInAppNotification(data: NotificationJobData): Promise<void> {
  logger.info('In-app notification would be sent', { data });

  // TODO: Store in database for in-app notifications
  // This would create a notification record that the frontend can query

  // For now, just simulate processing
  await new Promise(resolve => setTimeout(resolve, 50));
}

// SMS notification handler
async function sendSMSNotification(data: NotificationJobData): Promise<void> {
  logger.info('SMS notification would be sent', { data });

  // Simulated delay for now
  await new Promise(resolve => setTimeout(resolve, 200));

  // TODO: Implement SMS service integration
}

// Create the notification worker
export const notificationWorker = new Worker(
  'notifications',
  processNotificationJob,
  {
    connection: queueRedis,
    concurrency: parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '10'),
    limiter: {
      max: parseInt(process.env.NOTIFICATION_RATE_LIMIT || '100'),
      duration: 1000, // per second
    },
    // Worker settings for job handling
  }
);

// Worker event handlers
notificationWorker.on('completed', (job, result) => {
  logger.info('Notification job completed', {
    jobId: job.id,
    result,
    processingTime: Date.now() - job.processedOn!
  });
});

notificationWorker.on('failed', (job, error) => {
  logger.error('Notification job failed', {
    jobId: job?.id,
    error: error.message,
    attempts: job?.attemptsMade,
    data: job?.data
  });
});

notificationWorker.on('stalled', (jobId) => {
  logger.warn('Notification job stalled', { jobId });
});

notificationWorker.on('error', (error) => {
  logger.error('Notification worker error', { error: error.message });
});

// Graceful shutdown
export async function closeNotificationWorker() {
  logger.info('Closing notification worker...');
  await notificationWorker.close();
  logger.info('Notification worker closed');
}