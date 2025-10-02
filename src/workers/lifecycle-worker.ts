/**
 * Lifecycle Worker
 * Background worker process for handling lifecycle queue jobs
 */

import { logger } from '../utils/logger';
import lifecycleQueue from '../queues/lifecycle-queue';

// The queue processors are loaded when the module is imported
// Bull will automatically start processing jobs

logger.info('[LifecycleWorker] Worker process started');
logger.info('[LifecycleWorker] Registered job processors:', {
  processors: ['prelaunch', 'preflight', 'launch-warning', 'launch', 'wrapup']
});

// Health check endpoint data
let isShuttingDown = false;

export const getWorkerHealth = () => ({
  status: isShuttingDown ? 'shutting_down' : 'healthy',
  uptime: process.uptime(),
  queue: {
    name: lifecycleQueue.name,
    processors: 5
  },
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString()
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`[LifecycleWorker] Received ${signal}, shutting down gracefully...`);
  isShuttingDown = true;

  try {
    // Stop accepting new jobs
    await lifecycleQueue.pause();
    logger.info('[LifecycleWorker] Queue paused, no new jobs accepted');

    // Wait for active jobs to complete (with timeout)
    const activeJobs = await lifecycleQueue.getActive();
    if (activeJobs.length > 0) {
      logger.info(`[LifecycleWorker] Waiting for ${activeJobs.length} active jobs to complete...`);

      const timeout = 30000; // 30 seconds
      const startTime = Date.now();

      while ((await lifecycleQueue.getActive()).length > 0) {
        if (Date.now() - startTime > timeout) {
          logger.warn('[LifecycleWorker] Timeout waiting for jobs, forcing shutdown');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Close the queue
    await lifecycleQueue.close();
    logger.info('[LifecycleWorker] Queue closed');

    logger.info('[LifecycleWorker] Shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error('[LifecycleWorker] Error during shutdown', { error });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
  logger.error('[LifecycleWorker] Uncaught exception', { error });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[LifecycleWorker] Unhandled rejection', { reason, promise });
});

// Keep the process running
logger.info('[LifecycleWorker] Worker is ready to process jobs');
