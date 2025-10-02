import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification/notification.service';
import { authMiddleware } from '@/api/middleware/auth';
import { logger } from '@/utils/logger';

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService(prisma);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /notifications - Get user's notifications
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      unreadOnly?: string;
      type?: string;
      urgency?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const {
        page = '1',
        pageSize = '20',
        unreadOnly = 'false',
        type,
        urgency
      } = request.query;

      const where: any = {
        recipientId: userId
      };

      if (unreadOnly === 'true') {
        where.readAt = null;
      }

      if (type) {
        where.type = type;
      }

      if (urgency) {
        where.urgency = urgency;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(pageSize),
          take: parseInt(pageSize),
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }),
        prisma.notification.count({ where })
      ]);

      reply.send({
        success: true,
        data: notifications,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pages: Math.ceil(total / parseInt(pageSize)),
          hasNext: parseInt(page) * parseInt(pageSize) < total,
          hasPrev: parseInt(page) > 1
        }
      });

    } catch (error) {
      logger.error('Failed to get notifications', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve notifications',
          statusCode: 500
        }
      });
    }
  });

  // GET /notifications/unread-count - Get unread notification count
  fastify.get('/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      const count = await prisma.notification.count({
        where: {
          recipientId: userId,
          readAt: null
        }
      });

      reply.send({
        success: true,
        data: { count }
      });

    } catch (error) {
      logger.error('Failed to get unread count', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get unread count',
          statusCode: 500
        }
      });
    }
  });

  // POST /notifications/:id/read - Mark notification as read
  fastify.post('/:id/read', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id: request.params.id,
          recipientId: userId
        }
      });

      if (!notification) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found',
            statusCode: 404
          }
        });
        return;
      }

      await notificationService.markAsRead(request.params.id);

      reply.send({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error: (error as Error).message,
        notificationId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark notification as read',
          statusCode: 500
        }
      });
    }
  });

  // POST /notifications/mark-all-read - Mark all notifications as read
  fastify.post('/mark-all-read', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      const result = await prisma.notification.updateMany({
        where: {
          recipientId: userId,
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      reply.send({
        success: true,
        data: { markedCount: result.count },
        message: `Marked ${result.count} notifications as read`
      });

    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark all notifications as read',
          statusCode: 500
        }
      });
    }
  });

  // DELETE /notifications/:id - Delete a notification
  fastify.delete('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id: request.params.id,
          recipientId: userId
        }
      });

      if (!notification) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found',
            statusCode: 404
          }
        });
        return;
      }

      await prisma.notification.delete({
        where: { id: request.params.id }
      });

      reply.send({
        success: true,
        message: 'Notification deleted'
      });

    } catch (error) {
      logger.error('Failed to delete notification', {
        error: (error as Error).message,
        notificationId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete notification',
          statusCode: 500
        }
      });
    }
  });

  // GET /notifications/preferences - Get notification preferences
  // TODO: Implement NotificationPreferences model
  /* Commented out - needs NotificationPreferences model
  fastify.get('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      const preferences = await prisma.notification.findFirst({
        where: { recipientId: userId }
      });

      if (!preferences) {
        // Return default preferences
        reply.send({
          success: true,
          data: {
            userId,
            email: {
              approvals: true,
              tasks: true,
              campaigns: true,
              digests: true
            },
            slack: {
              approvals: true,
              tasks: true,
              campaigns: false,
              digests: false
            },
            inApp: {
              approvals: true,
              tasks: true,
              campaigns: true,
              digests: false
            },
            digestFrequency: 'daily'
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: preferences
      });

    } catch (error) {
      logger.error('Failed to get notification preferences', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification preferences',
          statusCode: 500
        }
      });
    }
  });
  */

  // PUT /notifications/preferences - Update notification preferences
  /* Commented out - needs NotificationPreferences model
  fastify.put('/preferences', async (request: FastifyRequest<{
    Body: {
      email?: {
        approvals?: boolean;
        tasks?: boolean;
        campaigns?: boolean;
        digests?: boolean;
      };
      slack?: {
        approvals?: boolean;
        tasks?: boolean;
        campaigns?: boolean;
        digests?: boolean;
      };
      inApp?: {
        approvals?: boolean;
        tasks?: boolean;
        campaigns?: boolean;
        digests?: boolean;
      };
      digestFrequency?: 'daily' | 'weekly' | 'never';
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { email, slack, inApp, digestFrequency } = request.body;

      // Check if preferences exist
      const existing = await prisma.notification.findFirst({
        where: { userId }
      });

      let preferences;

      if (existing) {
        // Update existing preferences
        preferences = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            ...(email && { email }),
            ...(slack && { slack }),
            ...(inApp && { inApp }),
            ...(digestFrequency && { digestFrequency })
          }
        });
      } else {
        // Create new preferences
        preferences = await prisma.notification.create({
          data: {
            userId,
            email: email || {
              approvals: true,
              tasks: true,
              campaigns: true,
              digests: true
            },
            slack: slack || {
              approvals: true,
              tasks: true,
              campaigns: false,
              digests: false
            },
            inApp: inApp || {
              approvals: true,
              tasks: true,
              campaigns: true,
              digests: false
            },
            digestFrequency: digestFrequency || 'daily'
          }
        });
      }

      reply.send({
        success: true,
        data: preferences,
        message: 'Notification preferences updated'
      });

    } catch (error) {
      logger.error('Failed to update notification preferences', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update notification preferences',
          statusCode: 500
        }
      });
    }
  });
  */

  // POST /notifications/test - Send test notification
  fastify.post('/test', async (request: FastifyRequest<{
    Body: {
      channel: 'email' | 'slack' | 'in-app';
      type?: string;
      subject?: string;
      message?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { channel, type = 'test', subject = 'Test Notification', message = 'This is a test notification' } = request.body;

      await notificationService.sendNotification({
        type,
        recipientId: userId,
        subject,
        message,
        channels: [channel],
        urgency: 'low',
        payload: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });

      reply.send({
        success: true,
        message: `Test notification sent via ${channel}`
      });

    } catch (error) {
      logger.error('Failed to send test notification', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send test notification',
          statusCode: 500
        }
      });
    }
  });

  // POST /notifications/send-digest - Manually trigger digest
  fastify.post('/send-digest', async (request: FastifyRequest<{
    Body: {
      period: 'daily' | 'weekly';
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { period } = request.body;

      await notificationService.sendDigest(userId, period);

      reply.send({
        success: true,
        message: `${period} digest sent`
      });

    } catch (error) {
      logger.error('Failed to send digest', {
        error: (error as Error).message
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send digest',
          statusCode: 500
        }
      });
    }
  });

  // Cleanup on app close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}