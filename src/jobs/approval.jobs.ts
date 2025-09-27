import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ApprovalService } from '@/services/approval/approval.service';
import { CacheService } from '@/services/cache/cache.service';
import { NotificationService } from '@/services/notification/notification.service';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

// Create queue for approval-related jobs
export const approvalQueue = new Queue('approvals', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      count: 100 // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50 // Keep last 50 failed jobs
    }
  }
});

// Worker to process approval jobs
export const approvalWorker = new Worker('approvals', async (job) => {
  const prisma = new PrismaClient();
  const cache = new CacheService();
  const notificationService = new NotificationService(prisma);
  const approvalService = new ApprovalService(prisma, cache, notificationService);

  try {
    logger.info('Processing approval job', { jobType: job.name, jobId: job.id });

    switch (job.name) {
      case 'process-auto-approvals':
        const processedCount = await approvalService.processAutoApprovals();
        logger.info('Auto-approvals processed', { processedCount });
        return { processedCount };

      case 'escalate-overdue-approvals':
        const escalatedCount = await approvalService.escalateOverdueApprovals();
        logger.info('Overdue approvals escalated', { escalatedCount });
        return { escalatedCount };

      case 'check-approval-deadlines':
        // Check for approvals approaching deadline and send reminders
        const approachingDeadline = await prisma.approval.findMany({
          where: {
            status: 'pending',
            deadline: {
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
            }
          },
          include: {
            campaign: true,
            approver: true
          }
        });

        for (const approval of approachingDeadline) {
          await notificationService.sendApprovalRequest(approval as any);
        }

        logger.info('Deadline reminders sent', { count: approachingDeadline.length });
        return { remindersCount: approachingDeadline.length };

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  } catch (error) {
    logger.error('Failed to process approval job', {
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
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000 // Max 10 jobs per second
  }
});

// Schedule recurring jobs
export async function scheduleApprovalJobs() {
  try {
    // Process auto-approvals every 30 minutes
    await approvalQueue.add(
      'process-auto-approvals',
      {},
      {
        repeat: {
          pattern: '*/30 * * * *' // Every 30 minutes
        },
        jobId: 'auto-approvals-recurring'
      }
    );

    // Escalate overdue approvals every hour
    await approvalQueue.add(
      'escalate-overdue-approvals',
      {},
      {
        repeat: {
          pattern: '0 * * * *' // Every hour at minute 0
        },
        jobId: 'escalate-overdue-recurring'
      }
    );

    // Check approval deadlines twice a day
    await approvalQueue.add(
      'check-approval-deadlines',
      {},
      {
        repeat: {
          pattern: '0 9,15 * * *' // At 9 AM and 3 PM
        },
        jobId: 'deadline-check-recurring'
      }
    );

    logger.info('Approval jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule approval jobs', {
      error: (error as Error).message
    });
    throw error;
  }
}

// Event handlers
approvalWorker.on('completed', (job) => {
  logger.info('Approval job completed', {
    jobId: job.id,
    jobName: job.name
  });
});

approvalWorker.on('failed', (job, error) => {
  logger.error('Approval job failed', {
    jobId: job?.id,
    jobName: job?.name,
    error: error.message
  });
});