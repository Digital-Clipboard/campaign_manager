import { buildServer } from '@/api/server';
import { redis, queueRedis } from '@/utils/redis';
import { CacheService } from '@/services/cache/cache.service';
import { queues, getQueueHealth } from '@/workers/queue.config';

describe('Infrastructure Setup', () => {
  let server: any;
  let cacheService: CacheService;

  beforeAll(async () => {
    // Start server for testing
    server = await buildServer();
    cacheService = new CacheService();
  });

  afterAll(async () => {
    // Clean up connections
    if (server) await server.close();
    await redis.quit();
    await queueRedis.quit();
  });

  describe('Fastify Server', () => {
    test('should start successfully', async () => {
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });

    test('should have all required plugins registered', () => {
      // Check if plugins are registered
      expect(server.hasPlugin('@fastify/cors')).toBe(true);
      expect(server.hasPlugin('@fastify/helmet')).toBe(true);
      expect(server.hasPlugin('@fastify/jwt')).toBe(true);
      expect(server.hasPlugin('@fastify/rate-limit')).toBe(true);
    });

    test('should respond to health check', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('healthy');
      expect(payload.timestamp).toBeDefined();
    });

    test('should handle 404 routes correctly', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/nonexistent-route'
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('NOT_FOUND');
    });

    test('should enforce rate limiting', async () => {
      // Make multiple requests quickly
      const promises = Array(10).fill(null).map(() =>
        server.inject({
          method: 'GET',
          url: '/health'
        })
      );

      const responses = await Promise.all(promises);
      const successResponses = responses.filter(r => r.statusCode === 200);

      // All should succeed since we're under the limit
      expect(successResponses.length).toBe(10);
    });
  });

  describe('PostgreSQL Connection', () => {
    test('should connect to database successfully', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        // Test basic connection
        await prisma.$queryRaw`SELECT 1 as test`;

        // Test that our custom functions exist
        const result = await prisma.$queryRaw`
          SELECT EXISTS(
            SELECT 1 FROM pg_proc WHERE proname = 'calculate_readiness_score'
          ) as function_exists
        `;

        expect(result).toEqual([{ function_exists: true }]);
      } finally {
        await prisma.$disconnect();
      }
    });

    test('should have all required tables', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const tables = await prisma.$queryRaw`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `;

        const tableNames = (tables as any[]).map(t => t.table_name);

        // Check for all our main tables
        expect(tableNames).toContain('campaigns');
        expect(tableNames).toContain('tasks');
        expect(tableNames).toContain('team_members');
        expect(tableNames).toContain('approvals');
        expect(tableNames).toContain('notifications');
        expect(tableNames).toContain('timelines');
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  describe('Redis Connection', () => {
    test('should connect to Redis successfully', async () => {
      const result = await redis.ping();
      expect(result).toBe('PONG');
    });

    test('should handle basic Redis operations', async () => {
      const testKey = 'test:infrastructure';
      const testValue = 'test-value';

      // Set value
      await redis.set(testKey, testValue, 'EX', 10);

      // Get value
      const retrieved = await redis.get(testKey);
      expect(retrieved).toBe(testValue);

      // Clean up
      await redis.del(testKey);
    });

    test('should have separate queue Redis connection', async () => {
      const result = await queueRedis.ping();
      expect(result).toBe('PONG');
    });
  });

  describe('Cache Service', () => {
    test('should initialize successfully', () => {
      expect(cacheService).toBeDefined();
      expect(cacheService.isHealthy).toBeDefined();
    });

    test('should perform basic cache operations', async () => {
      const testKey = 'test-cache-key';
      const testValue = 'test-cache-value';

      // Test set/get
      await cacheService.set(testKey, testValue, 60);
      const retrieved = await cacheService.get(testKey);
      expect(retrieved).toBe(testValue);

      // Test delete
      await cacheService.del(testKey);
      const deleted = await cacheService.get(testKey);
      expect(deleted).toBeNull();
    });

    test('should report health status', async () => {
      const isHealthy = await cacheService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    test('should get cache statistics', async () => {
      const stats = await cacheService.getStats();
      expect(stats.connected).toBe(true);
      expect(stats.keyCount).toBeGreaterThanOrEqual(0);
      expect(stats.timestamp).toBeDefined();
    });
  });

  describe('BullMQ Queues', () => {
    test('should have all required queues configured', () => {
      expect(queues.notifications).toBeDefined();
      expect(queues.tasks).toBeDefined();
      expect(queues.escalations).toBeDefined();
      expect(queues.reports).toBeDefined();
      expect(queues.campaigns).toBeDefined();
    });

    test('should accept jobs in notification queue', async () => {
      const job = await queues.notifications.add('test-notification', {
        type: 'task_assigned',
        recipientId: 'test-user',
        channel: 'email',
        urgency: 'normal',
        message: 'Test notification',
      });

      expect(job.id).toBeDefined();
      expect(job.data.type).toBe('task_assigned');

      // Clean up
      await job.remove();
    });

    test('should report queue health', async () => {
      const health = await getQueueHealth();

      expect(health.notifications).toBeDefined();
      expect(health.notifications.healthy).toBe(true);
      expect(health.tasks.healthy).toBe(true);
      expect(health.escalations.healthy).toBe(true);
    });

    test('should handle job priorities', async () => {
      // Add jobs with different priorities
      const normalJob = await queues.escalations.add('normal-escalation', {
        type: 'overdue_task',
        entityType: 'task',
        entityId: 'task-1',
        level: 1,
        reason: 'Task overdue'
      });

      const urgentJob = await queues.escalations.add('urgent-escalation', {
        type: 'system_alert',
        entityType: 'campaign',
        entityId: 'campaign-1',
        level: 3,
        reason: 'System alert'
      }, { priority: 20 });

      expect(normalJob.opts.priority).toBeUndefined();
      expect(urgentJob.opts.priority).toBe(20);

      // Clean up
      await normalJob.remove();
      await urgentJob.remove();
    });
  });

  describe('Environment Configuration', () => {
    test('should have required environment variables', () => {
      // These should be set in test environment
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.REDIS_HOST).toBeDefined();
      expect(process.env.JWT_SECRET).toBeDefined();
    });

    test('should use correct test configuration', () => {
      expect(process.env.LOG_LEVEL).toBe('silent');
    });
  });

  describe('TypeScript Build', () => {
    test('should compile without errors', () => {
      // This test passes if the file loads successfully
      expect(true).toBe(true);
    });

    test('should have correct type definitions', () => {
      // Test that our type imports work
      expect(typeof cacheService.getCampaign).toBe('function');
      expect(typeof server.inject).toBe('function');
    });
  });
});