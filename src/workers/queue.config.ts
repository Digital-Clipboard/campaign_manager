import { Queue } from 'bullmq';
import { queueRedis } from '@/utils/redis';
import { logger } from '@/utils/logger';

// Queue configuration
const defaultJobOptions = {
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50,      // Keep last 50 failed jobs
  attempts: 3,           // Retry failed jobs 3 times
  backoff: {
    type: 'exponential' as const,
    delay: 2000,         // Start with 2 second delay
  },
};

// Queue definitions
export const queues = {
  notifications: new Queue('notifications', {
    connection: queueRedis,
    defaultJobOptions,
  }),
  tasks: new Queue('tasks', {
    connection: queueRedis,
    defaultJobOptions,
  }),
  escalations: new Queue('escalations', {
    connection: queueRedis,
    defaultJobOptions: {
      ...defaultJobOptions,
      priority: 10, // Higher priority for escalations
    },
  }),
  reports: new Queue('reports', {
    connection: queueRedis,
    defaultJobOptions: {
      ...defaultJobOptions,
      removeOnComplete: 20, // Keep fewer report jobs
    },
  }),
  campaigns: new Queue('campaigns', {
    connection: queueRedis,
    defaultJobOptions,
  }),
};

// Note: QueueScheduler is deprecated in BullMQ v5+, delayed jobs are handled automatically

// Job types for type safety
export interface NotificationJobData {
  type: 'task_assigned' | 'task_reminder' | 'approval_request' | 'escalation' | 'campaign_update';
  recipientId: string;
  channel: 'email' | 'slack' | 'in-app' | 'sms';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  subject?: string;
  message: string;
  payload?: Record<string, any>;
  campaignId?: string;
  taskId?: string;
}

export interface TaskJobData {
  type: 'auto_assign' | 'deadline_check' | 'dependency_update' | 'status_sync';
  taskId: string;
  campaignId: string;
  assigneeId?: string;
  payload?: Record<string, any>;
}

export interface EscalationJobData {
  type: 'overdue_task' | 'blocked_campaign' | 'approval_timeout' | 'system_alert';
  entityType: 'task' | 'campaign' | 'approval';
  entityId: string;
  level: number;
  reason: string;
  payload?: Record<string, any>;
}

export interface ReportJobData {
  type: 'campaign_performance' | 'team_productivity' | 'system_health' | 'custom';
  reportId: string;
  parameters: Record<string, any>;
  recipientIds: string[];
  format: 'pdf' | 'csv' | 'json';
}

export interface CampaignJobData {
  type: 'timeline_generation' | 'readiness_calculation' | 'launch_preparation' | 'handoff';
  campaignId: string;
  action: string;
  payload?: Record<string, any>;
}

// Queue health monitoring
export async function getQueueHealth() {
  const health: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      health[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        healthy: true,
      };
    } catch (error) {
      health[name] = {
        healthy: false,
        error: (error as Error).message,
      };
    }
  }

  return health;
}

// Graceful shutdown for queues
export async function closeQueues() {
  logger.info('Closing queues...');

  try {
    // Close queues
    await Promise.all(Object.values(queues).map(queue => queue.close()));

    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error('Error closing queues', { error: (error as Error).message });
  }
}

// Queue event listeners for monitoring
Object.entries(queues).forEach(([name, queue]) => {
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error`, { error: error.message, queue: name });
  });
});