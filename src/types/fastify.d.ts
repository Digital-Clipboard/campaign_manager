// Fastify type augmentation for Campaign Manager
import { FastifyRequest, FastifyReply } from 'fastify';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}