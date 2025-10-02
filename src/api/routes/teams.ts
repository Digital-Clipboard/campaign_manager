import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { TeamService } from '@/services/team/team.service';
import { CacheService } from '@/services/cache/cache.service';
import { authMiddleware } from '@/api/middleware/auth';
import {
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest,
  TeamMemberFilters,
  BulkUpdateTeamAvailabilityRequest,
  WeeklySchedule
} from '@/types';
import { logger } from '@/utils/logger';

export async function teamRoutes(fastify: FastifyInstance) {
  const cache = new CacheService();
  const teamService = new TeamService(prisma, cache);

  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /teams - List team members with filtering and pagination
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      role?: string;
      skills?: string;
      isActive?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  }>, reply: FastifyReply) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        role,
        skills,
        isActive,
        search,
        sortBy = 'name',
        sortOrder = 'asc'
      } = request.query;

      const filters: TeamMemberFilters = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        role,
        skills: skills ? skills.split(',') : undefined,
        isActive: isActive ? isActive === 'true' : undefined,
        search,
        sortBy: sortBy as any,
        sortOrder
      };

      const result = await teamService.listTeamMembers(filters);

      reply.send({
        success: true,
        data: result.members,
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
      logger.error('Failed to list team members', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve team members',
          statusCode: 500
        }
      });
    }
  });

  // POST /teams - Create new team member
  fastify.post('/', async (request: FastifyRequest<{
    Body: {
      email: string;
      name: string;
      role: string;
      skills?: string[];
      timezone?: string;
      slackUserId?: string;
      availability?: WeeklySchedule;
      maxConcurrent?: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;

      if (!request.body.email || !request.body.name || !request.body.role) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'email, name, and role are required',
            statusCode: 400
          }
        });
        return;
      }

      const memberData: CreateTeamMemberRequest = {
        ...request.body,
        skills: request.body.skills || [],
        timezone: request.body.timezone || 'UTC',
        maxConcurrent: request.body.maxConcurrent || 5
      };

      const member = await teamService.createTeamMember(memberData, userId);

      reply.status(201).send({
        success: true,
        data: member
      });

    } catch (error) {
      logger.error('Failed to create team member', { error: (error as Error).message });

      const statusCode = (error as Error).message.includes('already exists') ? 409 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 409 ? 'MEMBER_EXISTS' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /teams/:id - Get single team member
  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const member = await teamService.getTeamMember(request.params.id);

      if (!member) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Team member not found',
            statusCode: 404
          }
        });
        return;
      }

      reply.send({
        success: true,
        data: member
      });

    } catch (error) {
      logger.error('Failed to get team member', {
        error: (error as Error).message,
        memberId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve team member',
          statusCode: 500
        }
      });
    }
  });

  // PUT /teams/:id - Update team member
  fastify.put('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name?: string;
      role?: string;
      skills?: string[];
      timezone?: string;
      slackUserId?: string;
      availability?: WeeklySchedule;
      maxConcurrent?: number;
      isActive?: boolean;
    }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const updates: UpdateTeamMemberRequest = request.body;

      const member = await teamService.updateTeamMember(request.params.id, updates, userId);

      reply.send({
        success: true,
        data: member
      });

    } catch (error) {
      logger.error('Failed to update team member', {
        error: (error as Error).message,
        memberId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // DELETE /teams/:id - Deactivate team member
  fastify.delete('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      await teamService.deactivateTeamMember(request.params.id, userId);

      reply.send({
        success: true,
        message: 'Team member deactivated successfully'
      });

    } catch (error) {
      logger.error('Failed to deactivate team member', {
        error: (error as Error).message,
        memberId: request.params.id
      });

      const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: (error as Error).message,
          statusCode
        }
      });
    }
  });

  // GET /teams/availability - Get team availability for date range
  fastify.get('/availability', async (request: FastifyRequest<{
    Querystring: {
      startDate: string;
      endDate: string;
      skills?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, skills } = request.query;

      if (!startDate || !endDate) {
        reply.status(400).send({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'startDate and endDate are required',
            statusCode: 400
          }
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        reply.status(400).send({
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid date format',
            statusCode: 400
          }
        });
        return;
      }

      const availability = await teamService.getTeamAvailability(
        start,
        end,
        skills ? skills.split(',') : undefined
      );

      reply.send({
        success: true,
        data: availability
      });

    } catch (error) {
      logger.error('Failed to get team availability', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve team availability',
          statusCode: 500
        }
      });
    }
  });

  // GET /teams/performance - Get team performance metrics
  fastify.get('/performance', async (request: FastifyRequest<{
    Querystring: {
      startDate?: string;
      endDate?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = request.query;

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate);
        if (isNaN(start.getTime())) {
          reply.status(400).send({
            error: {
              code: 'INVALID_DATE',
              message: 'Invalid startDate format',
              statusCode: 400
            }
          });
          return;
        }
      }

      if (endDate) {
        end = new Date(endDate);
        if (isNaN(end.getTime())) {
          reply.status(400).send({
            error: {
              code: 'INVALID_DATE',
              message: 'Invalid endDate format',
              statusCode: 400
            }
          });
          return;
        }
      }

      const metrics = await teamService.getTeamPerformanceMetrics(undefined, start, end);

      reply.send({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get team performance metrics', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve team performance metrics',
          statusCode: 500
        }
      });
    }
  });

  // GET /teams/:id/workload - Get team member workload distribution
  fastify.get('/:id/workload', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const member = await teamService.getTeamMember(request.params.id);

      if (!member) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Team member not found',
            statusCode: 404
          }
        });
        return;
      }

      // Return the member data which includes workload information
      reply.send({
        success: true,
        data: member
      });

    } catch (error) {
      logger.error('Failed to get team member workload', {
        error: (error as Error).message,
        memberId: request.params.id
      });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve team member workload',
          statusCode: 500
        }
      });
    }
  });

  // PUT /teams/availability/bulk - Bulk update team availability
  fastify.put('/availability/bulk', async (request: FastifyRequest<{
    Body: BulkUpdateTeamAvailabilityRequest
  }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { updates } = request.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'updates array is required and cannot be empty',
            statusCode: 400
          }
        });
        return;
      }

      await teamService.bulkUpdateAvailability(updates, userId);

      reply.send({
        success: true,
        message: `Updated availability for ${updates.length} team members`
      });

    } catch (error) {
      logger.error('Failed to bulk update team availability', { error: (error as Error).message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update team availability',
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