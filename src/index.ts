import dotenv from 'dotenv';
import { createServer } from './api/server-minimal';
import { logger } from './utils/logger';
import { CampaignSchedulerService } from './services/scheduling/campaign-scheduler.service';

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Global campaign scheduler instance
let campaignScheduler: CampaignSchedulerService | null = null;

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (campaignScheduler) {
    campaignScheduler.stopAllJobs();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (campaignScheduler) {
    campaignScheduler.stopAllJobs();
  }
  process.exit(0);
});

// Start the server
async function main() {
  try {
    const server = await createServer();
    const port = process.env.PORT || 3000;
    await server.listen({ port: Number(port), host: '0.0.0.0' });
    logger.info(`Campaign Manager server started on port ${port}`);

    // Initialize campaign scheduler for the Client Letter Automation campaign
    campaignScheduler = new CampaignSchedulerService();

    // Configure "Client Letter Automation" campaign with 3-phase rollout
    const campaignConfig = {
      campaignName: 'Client Letter Automation',
      rounds: [
        {
          roundNumber: 1,
          executionDay: 'friday',
          executionTime: '10:00 AM',
          targetCount: 1000,
          userRange: 'Users 1-1,000'
        },
        {
          roundNumber: 2,
          executionDay: 'tuesday',
          executionTime: '10:00 AM',
          targetCount: 1000,
          userRange: 'Users 1,001-2,000'
        },
        {
          roundNumber: 3,
          executionDay: 'thursday',
          executionTime: '10:00 AM',
          targetCount: 1000,
          userRange: 'Users 2,001-3,000'
        }
      ],
      channel: '#_traction'
    };

    // Schedule campaign notifications
    await campaignScheduler.scheduleCampaignNotifications(campaignConfig);

    logger.info('Campaign lifecycle notifications scheduled successfully', {
      campaignName: campaignConfig.campaignName,
      rounds: campaignConfig.rounds.length,
      channel: campaignConfig.channel
    });

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();