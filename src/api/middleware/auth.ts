import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';

// Authentication middleware for Fastify
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'AUTH_001',
          message: 'Authentication required',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = request.server.jwt.verify(token) as {
        sub: string;
        email: string;
        name: string;
        role: string;
      };

      // Add user info to request
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role
      };

      // logger.debug('User authenticated', {
      //   userId: request.user?.id,
      //   email: request.user?.email,
      //   requestId: request.id
      // });

    } catch (jwtError) {
      logger.warn('Invalid JWT token', {
        error: (jwtError as Error).message,
        requestId: request.id,
        ip: request.ip
      });

      return reply.status(401).send({
        error: {
          code: 'AUTH_002',
          message: 'Invalid or expired token',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      });
    }

  } catch (error) {
    logger.error('Authentication middleware error', {
      error: (error as Error).message,
      requestId: request.id
    });

    return reply.status(500).send({
      error: {
        code: 'AUTH_999',
        message: 'Authentication system error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        requestId: request.id
      }
    });
  }
}

// Role-based authorization middleware
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Ensure user is authenticated first
    await authMiddleware(request, reply);

    if (reply.sent) return; // Authentication failed

    const user = request.user;
    // @ts-ignore
    if (!user || !allowedRoles.includes(user.role)) {
      // logger.warn('Insufficient permissions', {
      //   userId: user?.id,
      //   userRole: user?.role,
      //   requiredRoles: allowedRoles,
      //   requestId: request.id
      // });

      return reply.status(403).send({
        error: {
          code: 'AUTH_003',
          message: 'Insufficient permissions',
          statusCode: 403,
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      });
    }
  };
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return; // No authentication provided, continue without user
  }

  try {
    const token = authHeader.substring(7);
    const decoded = request.server.jwt.verify(token) as {
      sub: string;
      email: string;
      name: string;
      role: string;
    };

    request.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role
    };
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug('Optional auth failed', {
      error: (error as Error).message,
      requestId: request.id
    });
  }
}