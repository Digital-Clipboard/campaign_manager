import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';

// Health check routes
export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV
    };
  });

  // Detailed health check with service dependencies
  fastify.get('/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const healthChecks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkQueues()
    ]);

    const [dbHealth, redisHealth, queueHealth] = healthChecks.map(result =>
      result.status === 'fulfilled' ? result.value : { healthy: false, error: (result.reason as Error).message }
    );

    const overallHealth = dbHealth.healthy && redisHealth.healthy && queueHealth.healthy;

    const response = {
      status: overallHealth ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      services: {
        database: dbHealth,
        redis: redisHealth,
        queues: queueHealth,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };

    reply.status(overallHealth ? 200 : 503).send(response);
  });

  // Liveness probe (for Kubernetes)
  fastify.get('/live', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return { status: 'alive', timestamp: new Date().toISOString() };
  });

  // Readiness probe (for Kubernetes)
  fastify.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if essential services are ready
      const dbReady = await checkDatabase();
      const redisReady = await checkRedis();

      if (dbReady.healthy && redisReady.healthy) {
        return { status: 'ready', timestamp: new Date().toISOString() };
      } else {
        return reply.status(503).send({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          issues: [
            ...(dbReady.healthy ? [] : ['database']),
            ...(redisReady.healthy ? [] : ['redis'])
          ]
        });
      }
    } catch (error) {
      logger.error('Readiness check failed', { error: (error as Error).message });
      return reply.status(503).send({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });
}

// Health check functions
async function checkDatabase(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();

    // Dynamic import to avoid circular dependency
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Database health check failed', { error: (error as Error).message });
    return { healthy: false, error: (error as Error).message };
  }
}

async function checkRedis(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();

    // Dynamic import to avoid circular dependency
    const { default: IORedis } = await import('ioredis');
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true
    });

    await redis.ping();
    await redis.disconnect();

    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Redis health check failed', { error: (error as Error).message });
    return { healthy: false, error: (error as Error).message };
  }
}

async function checkQueues(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // This is a simplified check - in production you might want to check queue sizes,
    // processing rates, etc.
    return { healthy: true };
  } catch (error) {
    logger.error('Queue health check failed', { error: (error as Error).message });
    return { healthy: false, error: (error as Error).message };
  }
}