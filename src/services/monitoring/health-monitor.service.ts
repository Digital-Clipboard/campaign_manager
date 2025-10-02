import { prisma } from '@/lib/prisma';
import { Redis } from 'ioredis';
import { logger } from '@/utils/logger';
import { NotificationService } from '@/services/notification.service';
import { SlackManagerClient } from '@/integrations/mcp-clients/slack-manager-client';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheck[];
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  averageResponseTime: number;
  queueHealth: {
    pending: number;
    completed: number;
    failed: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  type: 'threshold' | 'anomaly' | 'availability';
  metric: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
  cooldownMinutes: number;
  lastTriggered?: Date;
}

export class HealthMonitorService {
  private redis: Redis;
  private notificationService: NotificationService;
  private slackClient: SlackManagerClient;
  private startTime: Date;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metrics: SystemMetrics;
  private alertRules: AlertRule[] = [];

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.notificationService = new NotificationService();
    this.slackClient = new SlackManagerClient();
    this.startTime = new Date();

    this.metrics = {
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      cpuUsage: 0,
      activeConnections: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      averageResponseTime: 0,
      queueHealth: { pending: 0, completed: 0, failed: 0 }
    };

    this.initializeDefaultAlertRules();
    this.startHealthChecks();
  }

  // Health Check Methods
  async performHealthCheck(): Promise<SystemHealth> {
    logger.info('Performing comprehensive health check');

    const services = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
      this.checkFileSystem(),
      this.checkMemory(),
      this.checkQueue()
    ]);

    const healthChecks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    services.forEach((result, index) => {
      const serviceNames = ['database', 'redis', 'external-services', 'filesystem', 'memory', 'queue'];
      const serviceName = serviceNames[index];

      if (result.status === 'fulfilled') {
        healthChecks.push(result.value);
        this.healthChecks.set(serviceName, result.value);

        if (result.value.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.value.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } else {
        const errorCheck: HealthCheck = {
          service: serviceName,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          error: result.reason.message
        };
        healthChecks.push(errorCheck);
        this.healthChecks.set(serviceName, errorCheck);
        overallStatus = 'unhealthy';
      }
    });

    const systemHealth: SystemHealth = {
      overall: overallStatus,
      services: healthChecks,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Cache health status
    await this.cacheHealthStatus(systemHealth);

    // Check alert rules
    await this.evaluateAlertRules(systemHealth);

    return systemHealth;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        metadata: { type: 'postgresql' }
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const responseTime = Date.now() - start;

      return {
        service: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        metadata: { type: 'redis' }
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Check MCP services
      const [slackHealth, marketingHealth, mailjetHealth] = await Promise.allSettled([
        this.slackClient.testConnection(),
        // Add other MCP service health checks
      ]);

      const healthyServices = [slackHealth].filter(result =>
        result.status === 'fulfilled' && result.value
      ).length;

      const totalServices = 1; // Update when adding more services
      const healthPercentage = healthyServices / totalServices;

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (healthPercentage === 1) status = 'healthy';
      else if (healthPercentage >= 0.5) status = 'degraded';
      else status = 'unhealthy';

      return {
        service: 'external-services',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        metadata: {
          healthy: healthyServices,
          total: totalServices,
          percentage: Math.round(healthPercentage * 100)
        }
      };
    } catch (error) {
      return {
        service: 'external-services',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkFileSystem(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Check if we can write to temp directory
      const tempFile = path.join('/tmp', `health-check-${Date.now()}.tmp`);
      await fs.writeFile(tempFile, 'health check');
      await fs.unlink(tempFile);

      return {
        service: 'filesystem',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        service: 'filesystem',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (memoryPercentage < 70) status = 'healthy';
      else if (memoryPercentage < 90) status = 'degraded';
      else status = 'unhealthy';

      return {
        service: 'memory',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        metadata: {
          used: Math.round(usedMemory / 1024 / 1024),
          total: Math.round(totalMemory / 1024 / 1024),
          percentage: Math.round(memoryPercentage)
        }
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkQueue(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // This would integrate with your queue system (BullMQ, etc.)
      // For now, we'll simulate queue health
      const queueStats = {
        pending: 0,
        completed: 0,
        failed: 0
      };

      const failureRate = queueStats.failed / (queueStats.completed + queueStats.failed + 1) * 100;

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (failureRate < 5) status = 'healthy';
      else if (failureRate < 15) status = 'degraded';
      else status = 'unhealthy';

      return {
        service: 'queue',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        metadata: queueStats
      };
    } catch (error) {
      return {
        service: 'queue',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Metrics Collection
  async updateMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();

    this.metrics = {
      memoryUsage: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpuUsage: await this.getCPUUsage(),
      activeConnections: await this.getActiveConnections(),
      requestsPerMinute: await this.getRequestsPerMinute(),
      errorRate: await this.getErrorRate(),
      averageResponseTime: await this.getAverageResponseTime(),
      queueHealth: {
        pending: 0, // Would get from actual queue
        completed: 0,
        failed: 0
      }
    };

    // Cache metrics
    await this.redis.setex('system:metrics', 60, JSON.stringify(this.metrics));

    return this.metrics;
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    return Math.random() * 100; // Replace with actual CPU monitoring
  }

  private async getActiveConnections(): Promise<number> {
    // Get from your connection pool or server
    return 0; // Replace with actual connection count
  }

  private async getRequestsPerMinute(): Promise<number> {
    try {
      const count = await this.redis.get('metrics:requests:current_minute');
      return parseInt(count || '0');
    } catch {
      return 0;
    }
  }

  private async getErrorRate(): Promise<number> {
    try {
      const errors = await this.redis.get('metrics:errors:current_minute');
      const requests = await this.redis.get('metrics:requests:current_minute');

      const errorCount = parseInt(errors || '0');
      const requestCount = parseInt(requests || '0');

      return requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    } catch {
      return 0;
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    try {
      const responseTime = await this.redis.get('metrics:response_time:average');
      return parseInt(responseTime || '0');
    } catch {
      return 0;
    }
  }

  // Alert Management
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-memory',
        name: 'High Memory Usage',
        type: 'threshold',
        metric: 'memory.percentage',
        condition: 'greater_than',
        threshold: 85,
        severity: 'high',
        enabled: true,
        notificationChannels: ['slack', 'email'],
        cooldownMinutes: 15
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'threshold',
        metric: 'error_rate',
        condition: 'greater_than',
        threshold: 10,
        severity: 'critical',
        enabled: true,
        notificationChannels: ['slack', 'email', 'sms'],
        cooldownMinutes: 5
      },
      {
        id: 'database-down',
        name: 'Database Unavailable',
        type: 'availability',
        metric: 'database.status',
        condition: 'equals',
        threshold: 0, // 0 = unhealthy
        severity: 'critical',
        enabled: true,
        notificationChannels: ['slack', 'email', 'sms'],
        cooldownMinutes: 1
      },
      {
        id: 'slow-response',
        name: 'Slow Response Time',
        type: 'threshold',
        metric: 'response_time',
        condition: 'greater_than',
        threshold: 2000,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['slack'],
        cooldownMinutes: 10
      }
    ];
  }

  private async evaluateAlertRules(health: SystemHealth): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const shouldAlert = await this.evaluateRule(rule, health);

      if (shouldAlert && this.shouldTriggerAlert(rule)) {
        await this.triggerAlert(rule, health);
        rule.lastTriggered = new Date();
      }
    }
  }

  private async evaluateRule(rule: AlertRule, health: SystemHealth): Promise<boolean> {
    let currentValue: number;

    switch (rule.metric) {
      case 'memory.percentage':
        currentValue = this.metrics.memoryUsage.percentage;
        break;
      case 'error_rate':
        currentValue = this.metrics.errorRate;
        break;
      case 'response_time':
        currentValue = this.metrics.averageResponseTime;
        break;
      case 'database.status':
        const dbHealth = health.services.find(s => s.service === 'database');
        currentValue = dbHealth?.status === 'unhealthy' ? 0 : 1;
        break;
      default:
        return false;
    }

    switch (rule.condition) {
      case 'greater_than':
        return currentValue > rule.threshold;
      case 'less_than':
        return currentValue < rule.threshold;
      case 'equals':
        return currentValue === rule.threshold;
      default:
        return false;
    }
  }

  private shouldTriggerAlert(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return true;

    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const timeSinceLastAlert = Date.now() - rule.lastTriggered.getTime();

    return timeSinceLastAlert >= cooldownMs;
  }

  private async triggerAlert(rule: AlertRule, health: SystemHealth): Promise<void> {
    logger.warn('Triggering alert', { rule: rule.name, severity: rule.severity });

    const alertMessage = this.formatAlertMessage(rule, health);

    // Send notifications through configured channels
    for (const channel of rule.notificationChannels) {
      try {
        switch (channel) {
          case 'slack':
            await this.slackClient.sendAlert(alertMessage, rule.severity);
            break;
          case 'email':
            await this.notificationService.createNotification({
              type: 'system_alert',
              title: `System Alert: ${rule.name}`,
              message: alertMessage,
              recipientEmail: 'admin@example.com', // Configure admin email
              metadata: { rule, health, severity: rule.severity }
            });
            break;
          case 'sms':
            // Implement SMS notifications if needed
            break;
        }
      } catch (error) {
        logger.error('Failed to send alert notification', { channel, rule: rule.name, error });
      }
    }

    // Store alert in database
    await this.storeAlert(rule, health);
  }

  private formatAlertMessage(rule: AlertRule, health: SystemHealth): string {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'development';

    return `🚨 **${rule.name}** (${rule.severity.toUpperCase()})

**Environment:** ${environment}
**Time:** ${timestamp}
**Overall System Status:** ${health.overall}

**Alert Details:**
- Metric: ${rule.metric}
- Condition: ${rule.condition} ${rule.threshold}
- Severity: ${rule.severity}

**System Services Status:**
${health.services.map(s => `- ${s.service}: ${s.status} (${s.responseTime}ms)`).join('\n')}

**Current Metrics:**
- Memory Usage: ${this.metrics.memoryUsage.percentage}%
- Error Rate: ${this.metrics.errorRate.toFixed(2)}%
- Avg Response Time: ${this.metrics.averageResponseTime}ms
- Active Connections: ${this.metrics.activeConnections}`;
  }

  private async storeAlert(rule: AlertRule, health: SystemHealth): Promise<void> {
    try {
      await prisma.systemAlert.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          metric: rule.metric,
          threshold: rule.threshold,
          currentValue: 0, // Would calculate based on metric
          message: this.formatAlertMessage(rule, health),
          systemHealth: JSON.stringify(health),
          resolved: false,
          createdAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to store alert in database', { rule: rule.name, error });
    }
  }

  // Caching and Storage
  private async cacheHealthStatus(health: SystemHealth): Promise<void> {
    try {
      await this.redis.setex('system:health', 300, JSON.stringify(health)); // 5 minute cache
    } catch (error) {
      logger.error('Failed to cache health status', error);
    }
  }

  async getCachedHealthStatus(): Promise<SystemHealth | null> {
    try {
      const cached = await this.redis.get('system:health');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  // Monitoring Lifecycle
  private startHealthChecks(): void {
    // Perform health check every 5 minutes
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, 5 * 60 * 1000);

    // Update metrics every minute
    setInterval(async () => {
      try {
        await this.updateMetrics();
      } catch (error) {
        logger.error('Metrics update failed', error);
      }
    }, 60 * 1000);
  }

  async getHealthHistory(hours: number = 24): Promise<SystemHealth[]> {
    // This would query stored health check results
    // For now, return empty array
    return [];
  }

  async getMetricsHistory(hours: number = 24): Promise<SystemMetrics[]> {
    // This would query stored metrics
    // For now, return empty array
    return [];
  }

  async getAlertHistory(hours: number = 24): Promise<any[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await prisma.systemAlert.findMany({
        where: {
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Failed to get alert history', error);
      return [];
    }
  }
}