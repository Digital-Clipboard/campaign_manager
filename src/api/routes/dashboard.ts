import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { DashboardService } from '@/services/dashboard/dashboard.service';
import { AnalyticsService } from '@/services/dashboard/analytics.service';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  DashboardFilters,
  DateRange,
  ExportOptions,
  AnalyticsQuery
} from '@/types/dashboard.types';
import { z } from 'zod';

// Schema validators
const dateRangeSchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

const dashboardFiltersSchema = z.object({
  dateRange: dateRangeSchema.optional(),
  campaignTypes: z.array(z.string()).optional(),
  priorities: z.array(z.string()).optional(),
  teamMembers: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});

const exportOptionsSchema = z.object({
  format: z.enum(['json', 'csv', 'pdf', 'excel']),
  includeCharts: z.boolean(),
  sections: z.array(z.string()),
  dateRange: dateRangeSchema
});

const analyticsQuerySchema = z.object({
  metrics: z.array(z.string()),
  groupBy: z.array(z.string()).optional(),
  filters: dashboardFiltersSchema.optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional()
});

export async function dashboardRoutes(fastify: FastifyInstance) {
  const cacheService = new CacheService();
  const dashboardService = new DashboardService(prisma, cacheService);
  const analyticsService = new AnalyticsService(prisma, cacheService);

  // Main dashboard overview
  fastify.post('/overview', {
    schema: {
      body: dashboardFiltersSchema.optional(),
      response: {
        200: {
          type: 'object',
          description: 'Dashboard overview metrics'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body?: DashboardFilters }>, reply: FastifyReply) => {
    try {
      const filters = request.body;
      const metrics = await dashboardService.getOverviewMetrics(filters);
      return reply.status(200).send(metrics);
    } catch (error) {
      logger.error('Error fetching dashboard overview', error);
      return reply.status(500).send({
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Failed to fetch dashboard overview',
          statusCode: 500
        }
      });
    }
  });

  // Campaign analytics
  fastify.get('/campaigns/:campaignId', {
    schema: {
      params: z.object({
        campaignId: z.string()
      }),
      response: {
        200: {
          type: 'object',
          description: 'Campaign analytics data'
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply) => {
    try {
      const { campaignId } = request.params;
      const analytics = await dashboardService.getCampaignAnalytics(campaignId);
      return reply.status(200).send(analytics);
    } catch (error) {
      logger.error('Error fetching campaign analytics', { campaignId: request.params.campaignId, error });
      return reply.status(500).send({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch campaign analytics',
          statusCode: 500
        }
      });
    }
  });

  // Campaign performance metrics
  fastify.get('/campaigns', {
    schema: {
      querystring: dashboardFiltersSchema.optional(),
      response: {
        200: {
          type: 'object',
          description: 'Campaign performance metrics'
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring?: DashboardFilters }>, reply: FastifyReply) => {
    try {
      const filters = request.query as DashboardFilters;
      const query: AnalyticsQuery = {
        metrics: ['campaign_count', 'campaign_completion_rate', 'campaign_success_rate'],
        filters
      };
      const metrics = await analyticsService.queryMetrics(query);
      return reply.status(200).send(metrics);
    } catch (error) {
      logger.error('Error fetching campaign metrics', error);
      return reply.status(500).send({
        error: {
          code: 'METRICS_ERROR',
          message: 'Failed to fetch campaign metrics',
          statusCode: 500
        }
      });
    }
  });

  // Task analytics
  fastify.get('/tasks', {
    schema: {
      querystring: dashboardFiltersSchema.optional(),
      response: {
        200: {
          type: 'object',
          description: 'Task analytics data'
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring?: DashboardFilters }>, reply: FastifyReply) => {
    try {
      const filters = request.query as DashboardFilters;
      const query: AnalyticsQuery = {
        metrics: ['task_count', 'task_completion_rate', 'task_overdue_rate'],
        filters
      };
      const metrics = await analyticsService.queryMetrics(query);
      return reply.status(200).send(metrics);
    } catch (error) {
      logger.error('Error fetching task analytics', error);
      return reply.status(500).send({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch task analytics',
          statusCode: 500
        }
      });
    }
  });

  // Team performance
  fastify.post('/team', {
    schema: {
      body: z.object({
        period: dateRangeSchema
      }),
      response: {
        200: {
          type: 'object',
          description: 'Team performance metrics'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { period: DateRange } }>, reply: FastifyReply) => {
    try {
      const { period } = request.body;
      const performance = await dashboardService.getTeamPerformance(period);
      return reply.status(200).send(performance);
    } catch (error) {
      logger.error('Error fetching team performance', error);
      return reply.status(500).send({
        error: {
          code: 'PERFORMANCE_ERROR',
          message: 'Failed to fetch team performance',
          statusCode: 500
        }
      });
    }
  });

  // Trend analysis
  fastify.get('/trends', {
    schema: {
      querystring: z.object({
        metric: z.string(),
        startDate: z.string(),
        endDate: z.string()
      }),
      response: {
        200: {
          type: 'object',
          description: 'Trend analysis data'
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { metric: string; startDate: string; endDate: string } }>, reply: FastifyReply) => {
    try {
      const { metric, startDate, endDate } = request.query as any;
      const period: DateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
      const trends = await dashboardService.getTrendAnalysis(metric, period);
      return reply.status(200).send(trends);
    } catch (error) {
      logger.error('Error fetching trend analysis', error);
      return reply.status(500).send({
        error: {
          code: 'TRENDS_ERROR',
          message: 'Failed to fetch trend analysis',
          statusCode: 500
        }
      });
    }
  });

  // Risk assessment
  fastify.get('/risks', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object'
          },
          description: 'Risk indicators'
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const risks = await dashboardService.getRiskAssessment();
      return reply.status(200).send(risks);
    } catch (error) {
      logger.error('Error fetching risk assessment', error);
      return reply.status(500).send({
        error: {
          code: 'RISKS_ERROR',
          message: 'Failed to fetch risk assessment',
          statusCode: 500
        }
      });
    }
  });

  // Export dashboard data
  fastify.post('/export', {
    schema: {
      body: exportOptionsSchema,
      response: {
        200: {
          type: 'object',
          description: 'Export data'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: ExportOptions }>, reply: FastifyReply) => {
    try {
      const options = request.body;
      const exportData = await analyticsService.exportDashboard(options);

      reply.header('Content-Type', exportData.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      return reply.status(200).send(exportData.data);
    } catch (error) {
      logger.error('Error exporting dashboard', error);
      return reply.status(500).send({
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export dashboard data',
          statusCode: 500
        }
      });
    }
  });

  // Custom analytics query
  fastify.post('/analytics/query', {
    schema: {
      body: analyticsQuerySchema,
      response: {
        200: {
          type: 'object',
          description: 'Analytics query results'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: AnalyticsQuery }>, reply: FastifyReply) => {
    try {
      const query = request.body;
      const results = await analyticsService.queryMetrics(query);
      return reply.status(200).send(results);
    } catch (error) {
      logger.error('Error executing analytics query', error);
      return reply.status(500).send({
        error: {
          code: 'QUERY_ERROR',
          message: 'Failed to execute analytics query',
          statusCode: 500
        }
      });
    }
  });

  // Comparative analytics
  fastify.post('/analytics/compare', {
    schema: {
      body: z.object({
        metric: z.string(),
        periods: z.array(dateRangeSchema)
      }),
      response: {
        200: {
          type: 'object',
          description: 'Comparative analytics results'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { metric: string; periods: DateRange[] } }>, reply: FastifyReply) => {
    try {
      const { metric, periods } = request.body;
      const comparison = await analyticsService.getComparativeAnalytics(metric, periods);
      return reply.status(200).send(comparison);
    } catch (error) {
      logger.error('Error generating comparative analytics', error);
      return reply.status(500).send({
        error: {
          code: 'COMPARISON_ERROR',
          message: 'Failed to generate comparative analytics',
          statusCode: 500
        }
      });
    }
  });

  // Funnel analytics
  fastify.post('/analytics/funnel', {
    schema: {
      body: z.object({
        stages: z.array(z.string())
      }),
      response: {
        200: {
          type: 'object',
          description: 'Funnel analytics results'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { stages: string[] } }>, reply: FastifyReply) => {
    try {
      const { stages } = request.body;
      const funnel = await analyticsService.getFunnelAnalytics(stages);
      return reply.status(200).send(funnel);
    } catch (error) {
      logger.error('Error generating funnel analytics', error);
      return reply.status(500).send({
        error: {
          code: 'FUNNEL_ERROR',
          message: 'Failed to generate funnel analytics',
          statusCode: 500
        }
      });
    }
  });

  // Cohort analysis
  fastify.post('/analytics/cohort', {
    schema: {
      body: z.object({
        cohortField: z.string(),
        metricField: z.string(),
        periods: z.number().optional()
      }),
      response: {
        200: {
          type: 'object',
          description: 'Cohort analysis results'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { cohortField: string; metricField: string; periods?: number } }>, reply: FastifyReply) => {
    try {
      const { cohortField, metricField, periods } = request.body;
      const cohorts = await analyticsService.getCohortAnalysis(cohortField, metricField, periods);
      return reply.status(200).send(cohorts);
    } catch (error) {
      logger.error('Error generating cohort analysis', error);
      return reply.status(500).send({
        error: {
          code: 'COHORT_ERROR',
          message: 'Failed to generate cohort analysis',
          statusCode: 500
        }
      });
    }
  });

  // Real-time dashboard WebSocket endpoint
  fastify.get('/real-time', { websocket: true }, (connection, _req) => {
    logger.info('WebSocket connection established for real-time dashboard');

    // Send initial data
    connection.socket.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date()
    }));

    // Set up real-time updates
    const interval = setInterval(async () => {
      try {
        // Send periodic updates
        const update = {
          type: 'update',
          timestamp: new Date(),
          data: {
            // Simplified - would fetch actual real-time metrics
            activeCampaigns: await prisma.campaign.count({
              where: { status: { in: ['live', 'scheduled'] } }
            }),
            pendingTasks: await prisma.task.count({
              where: { status: 'pending' }
            })
          }
        };
        connection.socket.send(JSON.stringify(update));
      } catch (error) {
        logger.error('Error sending real-time update', error);
      }
    }, 30000); // Update every 30 seconds

    // Handle client messages
    connection.socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        logger.info('Received WebSocket message', { data });

        // Handle specific message types
        if (data.type === 'subscribe') {
          // Subscribe to specific metrics
          connection.socket.send(JSON.stringify({
            type: 'subscribed',
            metrics: data.metrics,
            timestamp: new Date()
          }));
        }
      } catch (error) {
        logger.error('Error processing WebSocket message', error);
      }
    });

    // Clean up on disconnect
    connection.socket.on('close', () => {
      logger.info('WebSocket connection closed');
      clearInterval(interval);
    });
  });

  logger.info('Dashboard routes registered');
}