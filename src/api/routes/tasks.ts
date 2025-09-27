import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TaskService } from '@/services/task/task.service';
import { CacheService } from '@/services/cache/cache.service';
import { authMiddleware } from '@/api/middleware/auth';
import {
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters
} from '@/types';
import { logger } from '@/utils/logger';

export async function taskRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const cache = new CacheService();
  const taskService = new TaskService(prisma, cache);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /tasks - List tasks with filtering and pagination
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      campaignId?: string;
      assigneeId?: string;
      status?: string;
      priority?: string;
      dueFrom?: string;
      dueTo?: string;
      overdue?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  }>, reply: FastifyReply) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        campaignId,
        assigneeId,
        status,
        priority,
        dueFrom,
        dueTo,
        overdue,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = request.query;

      const filters: TaskFilters = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        campaignId,
        assigneeId,
        status: status as any,
        priority: priority as any,
        dueFrom,
        dueTo,
        overdue: overdue === 'true',
        search,
        sortBy: sortBy as any,
        sortOrder
      };

      const result = await taskService.listTasks(filters);

      reply.send({
        success: true,
        data: result.tasks,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          pages: Math.ceil(result.total / result.pageSize),
          hasNext: result.page * result.pageSize < result.total,
          hasPrev: result.page > 1
        }
      });

    } catch (error) {
      logger.error('Failed to list tasks', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve tasks',
          statusCode: 500
        }
      });
    }
  });

  // POST /tasks - Create new task
  fastify.post('/', async (request: FastifyRequest<{
    Body: {
      campaignId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      dueDate: string;
      priority?: string;
      dependencies?: string[];
      estimatedHours?: number;
      tags?: string[];
      autoAssign?: boolean;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      if (!request.body.campaignId || !request.body.title || !request.body.dueDate) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'campaignId, title, and dueDate are required',
            statusCode: 400
          }
        });
        return;
      }

      const dueDate = new Date(request.body.dueDate);
      if (isNaN(dueDate.getTime())) {
        reply.status(400).send({
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid dueDate format',
            statusCode: 400
          }
        });
        return;
      }

      const taskData: CreateTaskRequest = {
        ...request.body,
        dueDate,
        priority: (request.body.priority as any) || 'medium'
      };

      const task = await taskService.createTask(taskData, userId);

      reply.status(201).send({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error('Failed to create task', { error: (error as Error).message });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'CAMPAIGN_NOT_FOUND' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /tasks/:id - Get single task
  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const task = await taskService.getTask(request.params.id);

      if (!task) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error('Failed to get task', {
        error: (error as Error).message,
        taskId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve task',
          statusCode: 500
        }
      });
    }
  });

  // PUT /tasks/:id - Update task
  fastify.put('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      priority?: string;
      status?: string;
      blockedReason?: string;
      actualHours?: number;
      tags?: string[];
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const updates: UpdateTaskRequest = {};

      // Copy all fields except dueDate
      if (request.body.title !== undefined) updates.title = request.body.title;
      if (request.body.description !== undefined) updates.description = request.body.description;
      if (request.body.assigneeId !== undefined) updates.assigneeId = request.body.assigneeId;
      if (request.body.priority !== undefined) updates.priority = request.body.priority as any;
      if (request.body.status !== undefined) updates.status = request.body.status as any;
      if (request.body.blockedReason !== undefined) updates.blockedReason = request.body.blockedReason;
      if (request.body.actualHours !== undefined) updates.actualHours = request.body.actualHours;
      if (request.body.tags !== undefined) updates.tags = request.body.tags;

      // Handle dueDate conversion
      if (request.body.dueDate) {
        const dueDate = new Date(request.body.dueDate);
        if (isNaN(dueDate.getTime())) {
          reply.status(400).send({
            error: {
              code: 'INVALID_DATE',
              message: 'Invalid dueDate format',
              statusCode: 400
            }
          });
          return;
        }
        updates.dueDate = dueDate;
      }

      const task = await taskService.updateTask(request.params.id, updates, userId);

      reply.send({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error('Failed to update task', {
        error: (error as Error).message,
        taskId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 :
                        (error as Error).message.includes('Invalid status transition') ? 400 :
                        (error as Error).message.includes('Cannot delete') ? 409 : 500;

      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' :
                statusCode === 400 ? 'INVALID_TRANSITION' :
                statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // POST /tasks/:id/assign - Assign task to team member
  fastify.post('/:id/assign', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { assigneeId: string }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { assigneeId } = request.body;

      if (!assigneeId) {
        reply.status(400).send({
          error: {
            code: 'MISSING_ASSIGNEE',
            message: 'assigneeId is required',
            statusCode: 400
          }
        });
        return;
      }

      const task = await taskService.assignTask(request.params.id, assigneeId, userId);

      reply.send({
        success: true,
        data: task,
        message: 'Task assigned successfully'
      });

    } catch (error) {
      logger.error('Failed to assign task', {
        error: (error as Error).message,
        taskId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 :
                        (error as Error).message.includes('inactive') ? 400 : 500;

      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' :
                statusCode === 400 ? 'INVALID_ASSIGNEE' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // POST /tasks/generate - Generate tasks from timeline
  fastify.post('/generate', async (request: FastifyRequest<{
    Body: {
      campaignId: string;
      timelineId: string;
      templateName: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { campaignId, timelineId, templateName } = request.body;

      if (!campaignId || !timelineId || !templateName) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'campaignId, timelineId, and templateName are required',
            statusCode: 400
          }
        });
        return;
      }

      const tasks = await taskService.generateTasksFromTimeline(
        campaignId,
        timelineId,
        templateName
      );

      reply.status(201).send({
        success: true,
        data: tasks,
        message: `Generated ${tasks.length} tasks from timeline`
      });

    } catch (error) {
      logger.error('Failed to generate tasks from timeline', {
        error: (error as Error).message,
        body: request.body
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'GENERATION_FAILED',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // Cleanup on app close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}