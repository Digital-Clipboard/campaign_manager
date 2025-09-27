import { FastifyInstance } from 'fastify';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Placeholder - will be implemented in integration phase
  fastify.post('/slack', async (_request, reply) => {
    reply.status(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Webhook routes not yet implemented', statusCode: 501 } });
  });
}