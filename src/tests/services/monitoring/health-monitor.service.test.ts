import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { HealthMonitorService } from '@/services/monitoring/health-monitor.service';
import { NotificationService } from '@/services/notification.service';
import { SlackManagerClient } from '@/integrations/mcp-clients/slack-manager-client';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('ioredis');
vi.mock('@/services/notification.service');
vi.mock('@/integrations/mcp-clients/slack-manager-client');

const mockPrisma = {
  $queryRaw: vi.fn(),
  systemAlert: {
    create: vi.fn()
  }
};

const mockRedis = {
  ping: vi.fn(),
  setex: vi.fn(),
  get: vi.fn()
};

const mockNotificationService = {
  createNotification: vi.fn()
};

const mockSlackClient = {
  testConnection: vi.fn(),
  sendAlert: vi.fn()
};

// Mock filesystem operations
const mockFs = {
  writeFile: vi.fn(),
  unlink: vi.fn()
};

vi.mock('fs', () => ({
  promises: mockFs
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

describe('HealthMonitorService', () => {
  let healthMonitor: HealthMonitorService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (PrismaClient as any).mockImplementation(() => mockPrisma);
    (Redis as any).mockImplementation(() => mockRedis);
    (NotificationService as any).mockImplementation(() => mockNotificationService);
    (SlackManagerClient as any).mockImplementation(() => mockSlackClient);

    // Mock successful operations by default
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');
    mockSlackClient.testConnection.mockResolvedValue(true);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    healthMonitor = new HealthMonitorService();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('performHealthCheck', () => {
    it('should perform comprehensive health check with all services healthy', async () => {
      const result = await healthMonitor.performHealthCheck();

      expect(result.overall).toBe('healthy');
      expect(result.services).toHaveLength(6);
      expect(result.services.every(service => service.status === 'healthy')).toBe(true);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
    });

    it('should detect database issues', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection timeout'));

      const result = await healthMonitor.performHealthCheck();

      expect(result.overall).toBe('unhealthy');

      const dbCheck = result.services.find(s => s.service === 'database');
      expect(dbCheck?.status).toBe('unhealthy');
      expect(dbCheck?.error).toBe('Connection timeout');
    });

    it('should detect Redis issues', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));

      const result = await healthMonitor.performHealthCheck();

      expect(result.overall).toBe('unhealthy');

      const redisCheck = result.services.find(s => s.service === 'redis');
      expect(redisCheck?.status).toBe('unhealthy');
      expect(redisCheck?.error).toBe('Redis unavailable');
    });

    it('should detect slow response times as degraded', async () => {
      // Make database respond slowly
      mockPrisma.$queryRaw.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([{ '1': 1 }]), 1500))
      );

      const result = await healthMonitor.performHealthCheck();

      const dbCheck = result.services.find(s => s.service === 'database');
      expect(dbCheck?.status).toBe('degraded');
      expect(dbCheck?.responseTime).toBeGreaterThan(1000);
    });

    it('should assess overall status based on individual services', async () => {
      // Make one service degraded
      mockRedis.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('PONG'), 600))
      );

      const result = await healthMonitor.performHealthCheck();

      expect(result.overall).toBe('degraded');
    });

    it('should check external services health', async () => {
      mockSlackClient.testConnection.mockResolvedValue(false);

      const result = await healthMonitor.performHealthCheck();

      const externalCheck = result.services.find(s => s.service === 'external-services');
      expect(externalCheck?.status).toBe('unhealthy');
      expect(externalCheck?.metadata).toMatchObject({
        healthy: 0,
        total: 1,
        percentage: 0
      });
    });

    it('should check filesystem health', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const result = await healthMonitor.performHealthCheck();

      const fsCheck = result.services.find(s => s.service === 'filesystem');
      expect(fsCheck?.status).toBe('unhealthy');
      expect(fsCheck?.error).toBe('Permission denied');
    });

    it('should check memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (90% usage)
        external: 0,
        arrayBuffers: 0,
        rss: 0
      });

      const result = await healthMonitor.performHealthCheck();

      const memoryCheck = result.services.find(s => s.service === 'memory');
      expect(memoryCheck?.status).toBe('degraded');
      expect(memoryCheck?.metadata?.percentage).toBe(90);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('updateMetrics', () => {
    it('should update system metrics', async () => {
      mockRedis.get
        .mockResolvedValueOnce('100') // requests per minute
        .mockResolvedValueOnce('5')   // errors per minute
        .mockResolvedValueOnce('100') // requests (for error rate)
        .mockResolvedValueOnce('250'); // response time

      const metrics = await healthMonitor.updateMetrics();

      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('requestsPerMinute');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('queueHealth');

      expect(metrics.requestsPerMinute).toBe(100);
      expect(metrics.errorRate).toBe(5); // 5/100 * 100 = 5%
      expect(metrics.averageResponseTime).toBe(250);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'system:metrics',
        60,
        JSON.stringify(metrics)
      );
    });

    it('should handle missing Redis data gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      const metrics = await healthMonitor.updateMetrics();

      expect(metrics.requestsPerMinute).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('alert evaluation', () => {
    it('should trigger high memory alert when threshold exceeded', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (90% usage)
        external: 0,
        arrayBuffers: 0,
        rss: 0
      });

      // Mock Redis responses for metrics
      mockRedis.get.mockResolvedValue('0');

      // Mock alert storage
      mockPrisma.systemAlert.create.mockResolvedValue({ id: 'alert-1' });

      const result = await healthMonitor.performHealthCheck();

      // Should trigger high memory alert (threshold: 85%)
      expect(mockSlackClient.sendAlert).toHaveBeenCalled();
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
      expect(mockPrisma.systemAlert.create).toHaveBeenCalled();

      process.memoryUsage = originalMemoryUsage;
    });

    it('should respect alert cooldown periods', async () => {
      // Mock high error rate
      mockRedis.get
        .mockResolvedValueOnce('100') // requests
        .mockResolvedValueOnce('20')  // errors (20% error rate)
        .mockResolvedValueOnce('100') // requests for calculation
        .mockResolvedValueOnce('0');  // response time

      mockPrisma.systemAlert.create.mockResolvedValue({ id: 'alert-1' });

      // First health check should trigger alert
      await healthMonitor.performHealthCheck();

      expect(mockSlackClient.sendAlert).toHaveBeenCalledTimes(1);

      // Second health check within cooldown period should not trigger
      await healthMonitor.performHealthCheck();

      expect(mockSlackClient.sendAlert).toHaveBeenCalledTimes(1);
    });

    it('should trigger database unavailable alert', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database down'));
      mockPrisma.systemAlert.create.mockResolvedValue({ id: 'alert-1' });

      await healthMonitor.performHealthCheck();

      expect(mockSlackClient.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('Database Unavailable'),
        'critical'
      );
    });
  });

  describe('caching', () => {
    it('should cache health status', async () => {
      await healthMonitor.performHealthCheck();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'system:health',
        300,
        expect.any(String)
      );
    });

    it('should retrieve cached health status', async () => {
      const cachedHealth = {
        overall: 'healthy',
        services: [],
        timestamp: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedHealth));

      const result = await healthMonitor.getCachedHealthStatus();

      expect(result).toEqual(cachedHealth);
      expect(mockRedis.get).toHaveBeenCalledWith('system:health');
    });

    it('should return null for missing cached data', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await healthMonitor.getCachedHealthStatus();

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await healthMonitor.getCachedHealthStatus();

      expect(result).toBeNull();
    });
  });

  describe('alert rules', () => {
    it('should initialize default alert rules', () => {
      // Access private property for testing
      const alertRules = (healthMonitor as any).alertRules;

      expect(alertRules).toHaveLength(4);
      expect(alertRules.map((rule: any) => rule.name)).toContain('High Memory Usage');
      expect(alertRules.map((rule: any) => rule.name)).toContain('High Error Rate');
      expect(alertRules.map((rule: any) => rule.name)).toContain('Database Unavailable');
      expect(alertRules.map((rule: any) => rule.name)).toContain('Slow Response Time');
    });

    it('should evaluate threshold rules correctly', async () => {
      // Mock high error rate to trigger alert
      mockRedis.get
        .mockResolvedValueOnce('100') // requests
        .mockResolvedValueOnce('15')  // errors (15% error rate)
        .mockResolvedValueOnce('100') // requests for calculation
        .mockResolvedValueOnce('0');  // response time

      mockPrisma.systemAlert.create.mockResolvedValue({ id: 'alert-1' });

      await healthMonitor.performHealthCheck();

      // Should trigger high error rate alert (threshold: 10%)
      expect(mockSlackClient.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('High Error Rate'),
        'critical'
      );
    });
  });

  describe('alert message formatting', () => {
    it('should format alert messages correctly', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database timeout'));
      mockPrisma.systemAlert.create.mockResolvedValue({ id: 'alert-1' });

      await healthMonitor.performHealthCheck();

      expect(mockSlackClient.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('🚨 **Database Unavailable** (CRITICAL)'),
        'critical'
      );

      expect(mockSlackClient.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('**Environment:**'),
        'critical'
      );

      expect(mockSlackClient.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('**System Services Status:**'),
        'critical'
      );
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start periodic health checks', () => {
      const performHealthCheckSpy = vi.spyOn(healthMonitor, 'performHealthCheck');
      const updateMetricsSpy = vi.spyOn(healthMonitor, 'updateMetrics');

      // Create new instance to trigger interval setup
      new HealthMonitorService();

      // Fast-forward 5 minutes for health check
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Fast-forward 1 minute for metrics update
      vi.advanceTimersByTime(60 * 1000);

      expect(performHealthCheckSpy).toHaveBeenCalled();
      expect(updateMetricsSpy).toHaveBeenCalled();
    });
  });

  describe('alert history', () => {
    it('should retrieve alert history', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          ruleId: 'high-memory',
          severity: 'high',
          createdAt: new Date()
        }
      ];

      mockPrisma.systemAlert.findMany.mockResolvedValue(mockAlerts);

      const result = await healthMonitor.getAlertHistory(24);

      expect(mockPrisma.systemAlert.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) }
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toEqual(mockAlerts);
    });

    it('should handle database errors in alert history', async () => {
      mockPrisma.systemAlert.findMany.mockRejectedValue(new Error('Database error'));

      const result = await healthMonitor.getAlertHistory(24);

      expect(result).toEqual([]);
    });
  });
});