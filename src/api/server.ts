import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { logger } from '@/utils/logger';
import { authMiddleware } from '@/api/middleware/auth';
import { campaignRoutes } from '@/api/routes/campaigns';
import { timelineRoutes } from '@/api/routes/timelines';
import { taskRoutes } from '@/api/routes/tasks';
import { teamRoutes } from '@/api/routes/teams';
import { approvalRoutes } from '@/api/routes/approvals';
import { notificationRoutes } from '@/api/routes/notifications';
import { dashboardRoutes } from '@/api/routes/dashboard';
import { webhookRoutes } from '@/api/routes/webhooks';
import { healthRoutes } from '@/api/routes/health';
import { authRoutes } from '@/api/routes/auth';
import templateRoutes from '@/api/routes/templates';
import bulkRoutes from '@/api/routes/bulk';
import searchRoutes from '@/api/routes/search';
import monitoringRoutes from '@/api/routes/monitoring';
import { MCPServerAdapter } from '@/adapters/mcp-server.adapter';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    },
    bodyLimit: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10MB
    trustProxy: true,
    disableRequestLogging: process.env.NODE_ENV === 'test'
  });

  // Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: process.env.HELMET_CSP_ENABLED === 'true' ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      }
    } : false
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?
      process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) :
      true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });

  await server.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    skipOnError: true,
    errorResponseBuilder: (_request, context) => ({
      code: 'RATE_001',
      error: 'Rate limit exceeded',
      message: `Too many requests, retry after ${Math.round(context.ttl / 1000)} seconds`,
      statusCode: 429,
      retryAfter: Math.round(context.ttl / 1000)
    })
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  });

  await server.register(websocket);

  // Global error handler
  server.setErrorHandler(async (error, request, reply) => {
    const { statusCode = 500, message } = error;

    logger.error('Request error', {
      error: error.message,
      stack: error.stack
    });

    const errorResponse = {
      error: {
        code: (error as any).code || `SRV_${statusCode}`,
        message: statusCode === 500 ? 'Internal server error' : message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId: request.id
      }
    };

    reply.status(statusCode).send(errorResponse);
  });

  // Request logging middleware
  if (process.env.NODE_ENV !== 'test') {
    server.addHook('onRequest', async (request, _reply) => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id
      });
    });
  }

  // Authentication decorator
  server.decorate('authenticate', authMiddleware);

  // Register routes
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(campaignRoutes, { prefix: '/api/v1/campaigns' });
  await server.register(timelineRoutes, { prefix: '/api/v1/timelines' });
  await server.register(taskRoutes, { prefix: '/api/v1/tasks' });
  await server.register(teamRoutes, { prefix: '/api/v1/team' });
  await server.register(approvalRoutes, { prefix: '/api/v1/approvals' });
  await server.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await server.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await server.register(templateRoutes, { prefix: '/api/v1/templates' });
  await server.register(bulkRoutes, { prefix: '/api/v1/bulk' });
  await server.register(searchRoutes, { prefix: '/api/v1/search' });
  await server.register(monitoringRoutes, { prefix: '/api/v1/monitoring' });
  await server.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // Register MCP endpoint
  const mcpAdapter = new MCPServerAdapter();
  mcpAdapter.registerMCPEndpoint(server);

  // 404 handler
  server.setNotFoundHandler(async (_request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        statusCode: 404,
        timestamp: new Date().toISOString(),
        requestId: 'unknown'
      }
    });
  });

  return server;
}

export async function startServer(): Promise<FastifyInstance> {
  const server = await buildServer();

  try {
    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3001');

    await server.listen({ host, port });

    logger.info(`Campaign Manager server started`, {
      host,
      port,
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}