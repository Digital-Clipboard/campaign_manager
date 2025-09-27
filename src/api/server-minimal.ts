import fastify from 'fastify';
import { logger } from '@/utils/logger';

export async function createServer() {
  const server = fastify({
    logger: false,
  });

  // Register basic plugins
  await server.register(require('@fastify/cors'), {
    origin: true,
  });

  await server.register(require('@fastify/helmet'));

  // Basic health check route
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'campaign-manager',
      version: '1.0.0'
    };
  });

  // Basic root route
  server.get('/', async (request, reply) => {
    return {
      service: 'Campaign Manager',
      version: '1.0.0',
      status: 'running',
      documentation: '/api/docs'
    };
  });

  return server;
}