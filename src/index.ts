import dotenv from 'dotenv';
import { createServer } from './api/server-minimal';
import { logger } from './utils/logger';

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
async function main() {
  try {
    const server = await createServer();
    const port = process.env.PORT || 3000;
    await server.listen({ port: Number(port), host: '0.0.0.0' });
    logger.info(`Campaign Manager server started on port ${port}`);

    // Campaign scheduling is now handled via the Lifecycle API
    // Use POST /api/lifecycle/campaigns to create and schedule campaigns
    // The simple scheduler has been removed to avoid conflicts with the comprehensive lifecycle system

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();