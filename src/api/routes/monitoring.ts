import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HealthMonitorService } from '@/services/monitoring/health-monitor.service';
import { AuditLogService } from '@/services/audit/audit-log.service';
import { logger } from '@/utils/logger';

const monitoring: FastifyPluginAsync = async (fastify) => {
  const healthMonitor = new HealthMonitorService();
  const auditService = new AuditLogService();

  // GET /monitoring/health - Get current system health
  fastify.get('/health', {
    schema: {
      summary: 'Get system health status',
      description: 'Retrieve current health status of all system components',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            overall: Type.Union([
              Type.Literal('healthy'),
              Type.Literal('unhealthy'),
              Type.Literal('degraded')
            ]),
            services: Type.Array(Type.Object({
              service: Type.String(),
              status: Type.Union([
                Type.Literal('healthy'),
                Type.Literal('unhealthy'),
                Type.Literal('degraded')
              ]),
              lastCheck: Type.String(),
              responseTime: Type.Number(),
              error: Type.Optional(Type.String()),
              metadata: Type.Optional(Type.Unknown())
            })),
            timestamp: Type.String(),
            uptime: Type.Number(),
            version: Type.String(),
            environment: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      // Try to get cached health status first
      let health = await healthMonitor.getCachedHealthStatus();

      if (!health) {
        // If no cached status, perform fresh health check
        health = await healthMonitor.performHealthCheck();
      }

      reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to get health status', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get health status'
      });
    }
  });

  // POST /monitoring/health/check - Force health check
  fastify.post('/health/check', {
    schema: {
      summary: 'Force health check',
      description: 'Perform immediate health check of all system components',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            overall: Type.Union([
              Type.Literal('healthy'),
              Type.Literal('unhealthy'),
              Type.Literal('degraded')
            ]),
            services: Type.Array(Type.Unknown()),
            timestamp: Type.String(),
            uptime: Type.Number(),
            version: Type.String(),
            environment: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const health = await healthMonitor.performHealthCheck();

      reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to perform health check', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to perform health check'
      });
    }
  });

  // GET /monitoring/metrics - Get current system metrics
  fastify.get('/metrics', {
    schema: {
      summary: 'Get system metrics',
      description: 'Retrieve current system performance metrics',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            memoryUsage: Type.Object({
              used: Type.Number(),
              total: Type.Number(),
              percentage: Type.Number()
            }),
            cpuUsage: Type.Number(),
            activeConnections: Type.Number(),
            requestsPerMinute: Type.Number(),
            errorRate: Type.Number(),
            averageResponseTime: Type.Number(),
            queueHealth: Type.Object({
              pending: Type.Number(),
              completed: Type.Number(),
              failed: Type.Number()
            })
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const metrics = await healthMonitor.updateMetrics();

      reply.send({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get metrics', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  });

  // GET /monitoring/health/history - Get health check history
  fastify.get('/health/history', {
    schema: {
      summary: 'Get health check history',
      description: 'Retrieve historical health check data',
      querystring: Type.Object({
        hours: Type.Optional(Type.Number({ minimum: 1, maximum: 168, default: 24 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Unknown())
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { hours = 24 } = request.query as any;
      const history = await healthMonitor.getHealthHistory(hours);

      reply.send({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get health history', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get health history'
      });
    }
  });

  // GET /monitoring/metrics/history - Get metrics history
  fastify.get('/metrics/history', {
    schema: {
      summary: 'Get metrics history',
      description: 'Retrieve historical metrics data',
      querystring: Type.Object({
        hours: Type.Optional(Type.Number({ minimum: 1, maximum: 168, default: 24 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Unknown())
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { hours = 24 } = request.query as any;
      const history = await healthMonitor.getMetricsHistory(hours);

      reply.send({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get metrics history', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get metrics history'
      });
    }
  });

  // GET /monitoring/alerts - Get alert history
  fastify.get('/alerts', {
    schema: {
      summary: 'Get alert history',
      description: 'Retrieve system alert history',
      querystring: Type.Object({
        hours: Type.Optional(Type.Number({ minimum: 1, maximum: 168, default: 24 })),
        severity: Type.Optional(Type.Union([
          Type.Literal('low'),
          Type.Literal('medium'),
          Type.Literal('high'),
          Type.Literal('critical')
        ]))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Unknown())
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { hours = 24, severity } = request.query as any;
      let alerts = await healthMonitor.getAlertHistory(hours);

      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      reply.send({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to get alert history', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get alert history'
      });
    }
  });

  // GET /monitoring/audit - Get audit logs
  fastify.get('/audit', {
    schema: {
      summary: 'Get audit logs',
      description: 'Retrieve system audit logs with filtering',
      querystring: Type.Object({
        entityType: Type.Optional(Type.String()),
        entityId: Type.Optional(Type.String()),
        action: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        userEmail: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            entries: Type.Array(Type.Object({
              id: Type.String(),
              entityType: Type.String(),
              entityId: Type.String(),
              action: Type.String(),
              userId: Type.String(),
              userEmail: Type.String(),
              timestamp: Type.String(),
              oldValues: Type.Optional(Type.Unknown()),
              newValues: Type.Optional(Type.Unknown()),
              metadata: Type.Optional(Type.Unknown()),
              ipAddress: Type.Optional(Type.String()),
              userAgent: Type.Optional(Type.String()),
              sessionId: Type.Optional(Type.String())
            })),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;

      // Convert string dates to Date objects
      const auditQuery = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      };

      const result = await auditService.getAuditLogs(auditQuery);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to get audit logs', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get audit logs'
      });
    }
  });

  // GET /monitoring/audit/:entityType/:entityId - Get audit trail for specific entity
  fastify.get('/audit/:entityType/:entityId', {
    schema: {
      summary: 'Get entity audit trail',
      description: 'Retrieve complete audit trail for a specific entity',
      params: Type.Object({
        entityType: Type.String(),
        entityId: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            entityType: Type.String(),
            entityId: Type.String(),
            action: Type.String(),
            userId: Type.String(),
            userEmail: Type.String(),
            timestamp: Type.String(),
            oldValues: Type.Optional(Type.Unknown()),
            newValues: Type.Optional(Type.Unknown()),
            metadata: Type.Optional(Type.Unknown()),
            ipAddress: Type.Optional(Type.String()),
            userAgent: Type.Optional(Type.String()),
            sessionId: Type.Optional(Type.String())
          }))
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const trail = await auditService.getAuditTrail(entityType, entityId);

      reply.send({
        success: true,
        data: trail
      });
    } catch (error) {
      logger.error('Failed to get audit trail', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get audit trail'
      });
    }
  });

  // GET /monitoring/audit/user/:userEmail - Get user activity
  fastify.get('/audit/user/:userEmail', {
    schema: {
      summary: 'Get user activity',
      description: 'Retrieve audit logs for a specific user',
      params: Type.Object({
        userEmail: Type.String()
      }),
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Unknown())
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { userEmail } = request.params as { userEmail: string };
      const { days = 30 } = request.query as any;

      const activity = await auditService.getUserActivity(userEmail, days);

      reply.send({
        success: true,
        data: activity
      });
    } catch (error) {
      logger.error('Failed to get user activity', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get user activity'
      });
    }
  });

  // GET /monitoring/audit/summary - Get audit summary
  fastify.get('/audit/summary', {
    schema: {
      summary: 'Get audit summary',
      description: 'Retrieve audit analytics and summary data',
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            totalActions: Type.Number(),
            actionsByType: Type.Record(Type.String(), Type.Number()),
            actionsByUser: Type.Record(Type.String(), Type.Number()),
            mostActiveUsers: Type.Array(Type.Object({
              userEmail: Type.String(),
              count: Type.Number()
            })),
            mostModifiedEntities: Type.Array(Type.Object({
              entityType: Type.String(),
              entityId: Type.String(),
              count: Type.Number()
            })),
            timelineData: Type.Array(Type.Object({
              date: Type.String(),
              count: Type.Number()
            }))
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { days = 30 } = request.query as any;
      const summary = await auditService.generateAuditSummary(days);

      reply.send({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get audit summary', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get audit summary'
      });
    }
  });

  // POST /monitoring/audit/export - Export audit logs
  fastify.post('/audit/export', {
    schema: {
      summary: 'Export audit logs',
      description: 'Export audit logs in specified format',
      body: Type.Object({
        entityType: Type.Optional(Type.String()),
        entityId: Type.Optional(Type.String()),
        action: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        userEmail: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        format: Type.Optional(Type.Union([
          Type.Literal('json'),
          Type.Literal('csv')
        ]))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            filename: Type.String(),
            content: Type.String(),
            mimeType: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { format = 'json', ...query } = request.body as any;

      // Convert string dates to Date objects
      const auditQuery = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      };

      const content = await auditService.exportAuditLogs(auditQuery, format);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `audit_logs_${timestamp}.${format}`;
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';

      reply.send({
        success: true,
        data: {
          filename,
          content,
          mimeType
        }
      });
    } catch (error) {
      logger.error('Failed to export audit logs', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to export audit logs'
      });
    }
  });

  // POST /monitoring/audit/cleanup - Cleanup old audit logs
  fastify.post('/audit/cleanup', {
    schema: {
      summary: 'Cleanup old audit logs',
      description: 'Remove audit logs older than specified days',
      body: Type.Object({
        olderThanDays: Type.Number({ minimum: 30, maximum: 3650, default: 365 })
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            deletedCount: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { olderThanDays = 365 } = request.body as any;
      const userId = request.user as string || 'system';
      const userEmail = 'system@example.com';

      // Log the cleanup operation
      await auditService.logSystemEvent(
        'audit_log_cleanup',
        userId,
        userEmail,
        { olderThanDays }
      );

      const deletedCount = await auditService.cleanupOldLogs(olderThanDays);

      reply.send({
        success: true,
        data: { deletedCount }
      });
    } catch (error) {
      logger.error('Failed to cleanup audit logs', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to cleanup audit logs'
      });
    }
  });

  // GET /monitoring/system/status - Get overall system status
  fastify.get('/system/status', {
    schema: {
      summary: 'Get system status',
      description: 'Get comprehensive system status including health, metrics, and recent alerts',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            health: Type.Unknown(),
            metrics: Type.Unknown(),
            recentAlerts: Type.Array(Type.Unknown()),
            uptime: Type.Number(),
            version: Type.String(),
            environment: Type.String(),
            timestamp: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const [health, metrics, recentAlerts] = await Promise.all([
        healthMonitor.getCachedHealthStatus() || healthMonitor.performHealthCheck(),
        healthMonitor.updateMetrics(),
        healthMonitor.getAlertHistory(1) // Last 1 hour
      ]);

      reply.send({
        success: true,
        data: {
          health,
          metrics,
          recentAlerts: recentAlerts.slice(0, 5), // Last 5 alerts
          uptime: Date.now() - (new Date()).getTime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get system status', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get system status'
      });
    }
  });
};

export default monitoring;