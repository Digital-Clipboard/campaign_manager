import IORedis from 'ioredis';
import { logger } from '@/utils/logger';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  commandTimeout: 5000,
  lazyConnect: true,
};

// Main Redis client for general caching
export const redis = new IORedis(redisConfig);

// Separate Redis client for BullMQ (recommended pattern)
export const queueRedis = new IORedis(redisConfig);

// Redis connection event handlers
redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error', { error: error.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

queueRedis.on('connect', () => {
  logger.info('Queue Redis connected successfully');
});

queueRedis.on('error', (error) => {
  logger.error('Queue Redis connection error', { error: error.message });
});

// Graceful shutdown
export async function closeRedisConnections() {
  try {
    await redis.quit();
    await queueRedis.quit();
    logger.info('Redis connections closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connections', { error: (error as Error).message });
  }
}