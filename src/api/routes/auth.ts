import { FastifyInstance } from 'fastify';

export async function authRoutes(fastify: FastifyInstance) {
  // Placeholder for authentication routes
  // These will be implemented in the next phase

  fastify.post('/login', async (_request, reply) => {
    reply.status(501).send({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Authentication not yet implemented',
        statusCode: 501
      }
    });
  });

  fastify.post('/refresh', async (_request, reply) => {
    reply.status(501).send({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Token refresh not yet implemented',
        statusCode: 501
      }
    });
  });
}