import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  TeamMember,
  CreateTeamMemberRequest,
  UpdateTeamMemberRequest,
  TeamMemberFilters,
  TeamMemberWithWorkload,
  TeamAvailabilityResponse,
  TeamPerformanceMetrics,
  WeeklySchedule
} from '@/types';

export class TeamService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  async createTeamMember(data: CreateTeamMemberRequest, createdBy: string): Promise<TeamMember> {
    try {
      logger.info('Creating team member', {
        email: data.email,
        name: data.name,
        role: data.role,
        createdBy
      });

      // Check if email already exists
      const existingMember = await this.prisma.teamMember.findUnique({
        where: { email: data.email }
      });

      if (existingMember) {
        throw new Error('Team member with this email already exists');
      }

      const teamMember = await this.prisma.teamMember.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          skills: data.skills || [],
          timezone: data.timezone || 'UTC',
          slackUserId: data.slackUserId,
          availability: (data.availability || this.getDefaultAvailability()) as any,
          maxConcurrent: data.maxConcurrent || 3,
          isActive: true
        }
      });

      // Invalidate team cache
      await this.cache.invalidatePattern('team:*');

      logger.info('Team member created successfully', {
        memberId: teamMember.id,
        email: teamMember.email,
        name: teamMember.name
      });

      return teamMember as any;

    } catch (error) {
      logger.error('Failed to create team member', {
        error: (error as Error).message,
        data,
        createdBy
      });
      throw error;
    }
  }

  async getTeamMember(id: string): Promise<TeamMemberWithWorkload | null> {
    try {
      // Try cache first
      const cached = await this.cache.getTeamMember(id);
      if (cached) {
        logger.debug('Team member retrieved from cache', { memberId: id });

        // Add workload data
        const workload = await this.getTeamMemberWorkload(id);
        return { ...cached, workload } as any;
      }

      // Fetch from database
      const teamMember = await this.prisma.teamMember.findUnique({
        where: { id },
        include: {
          tasks: {
            where: {
              status: { in: ['assigned', 'in_progress'] }
            },
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  priority: true
                }
              }
            },
            orderBy: { dueDate: 'asc' }
          },
          campaigns: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  priority: true
                }
              }
            }
          }
        }
      });

      if (teamMember) {
        await this.cache.setTeamMember(teamMember as any);

        // Calculate workload
        const workload = this.calculateWorkloadMetrics(teamMember);

        logger.debug('Team member retrieved from database', { memberId: id });
        return { ...teamMember, workload } as any;
      }

      return null;

    } catch (error) {
      logger.error('Failed to get team member', {
        error: (error as Error).message,
        memberId: id
      });
      throw error;
    }
  }

  async updateTeamMember(
    id: string,
    data: UpdateTeamMemberRequest,
    updatedBy: string
  ): Promise<TeamMember> {
    try {
      logger.info('Updating team member', { memberId: id, updatedBy });

      const teamMember = await this.prisma.teamMember.update({
        where: { id },
        data: {
          ...data,
          availability: data.availability as any
        }
      });

      // Invalidate caches
      await this.cache.invalidatePattern('team:*');
      await this.cache.invalidatePattern('dashboard:*');

      // Log activity
      await this.logTeamActivity(id, 'team_member_updated', updatedBy, {
        changes: data
      });

      logger.info('Team member updated successfully', { memberId: id });

      return teamMember as any;

    } catch (error) {
      logger.error('Failed to update team member', {
        error: (error as Error).message,
        memberId: id,
        updatedBy
      });
      throw error;
    }
  }

  async deactivateTeamMember(id: string, deactivatedBy: string): Promise<void> {
    try {
      logger.info('Deactivating team member', { memberId: id, deactivatedBy });

      // Check for active task assignments
      const activeTasks = await this.prisma.task.count({
        where: {
          assigneeId: id,
          status: { in: ['assigned', 'in_progress'] }
        }
      });

      if (activeTasks > 0) {
        throw new Error(`Cannot deactivate team member with ${activeTasks} active task(s). Please reassign tasks first.`);
      }

      await this.prisma.teamMember.update({
        where: { id },
        data: {
          isActive: false
        }
      });

      // Invalidate caches
      await this.cache.invalidatePattern('team:*');

      logger.info('Team member deactivated successfully', { memberId: id });

    } catch (error) {
      logger.error('Failed to deactivate team member', {
        error: (error as Error).message,
        memberId: id,
        deactivatedBy
      });
      throw error;
    }
  }

  async listTeamMembers(filters: TeamMemberFilters = {}): Promise<{
    members: TeamMemberWithWorkload[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        role,
        skills,
        isActive,
        search,
        sortBy = 'name',
        sortOrder = 'asc'
      } = filters;

      const skip = (page - 1) * pageSize;
      const where: any = {};
      const orderBy: any = { [sortBy]: sortOrder };

      // Apply filters
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;
      if (skills && skills.length > 0) {
        where.skills = { hasSome: skills };
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [members, total] = await Promise.all([
        this.prisma.teamMember.findMany({
          where,
          include: {
            tasks: {
              where: {
                status: { in: ['assigned', 'in_progress'] }
              },
              include: {
                campaign: {
                  select: {
                    id: true,
                    name: true,
                    priority: true
                  }
                }
              }
            },
            campaigns: {
              include: {
                campaign: {
                  select: {
                    id: true,
                    name: true,
                    status: true
                  }
                }
              }
            }
          },
          orderBy,
          skip,
          take: pageSize
        }),
        this.prisma.teamMember.count({ where })
      ]);

      // Calculate workload for each member
      const membersWithWorkload = members.map(member => ({
        ...member,
        workload: this.calculateWorkloadMetrics(member)
      }));

      logger.debug('Team members listed', {
        count: members.length,
        total,
        page,
        pageSize,
        filters
      });

      return {
        members: membersWithWorkload as any,
        total,
        page,
        pageSize
      };

    } catch (error) {
      logger.error('Failed to list team members', {
        error: (error as Error).message,
        filters
      });
      throw error;
    }
  }

  async getTeamAvailability(
    startDate: Date,
    endDate: Date,
    skills?: string[]
  ): Promise<TeamAvailabilityResponse> {
    try {
      logger.info('Getting team availability', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        skills
      });

      const where: any = { isActive: true };
      if (skills && skills.length > 0) {
        where.skills = { hasSome: skills };
      }

      const teamMembers = await this.prisma.teamMember.findMany({
        where,
        include: {
          tasks: {
            where: {
              status: { in: ['assigned', 'in_progress'] },
              dueDate: {
                gte: startDate,
                lte: endDate
              }
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              estimatedHours: true,
              priority: true,
              campaign: {
                select: {
                  id: true,
                  name: true,
                  priority: true
                }
              }
            }
          }
        }
      });

      const availability = teamMembers.map(member => {
        const totalTaskHours = member.tasks.reduce(
          (sum, task) => sum + task.estimatedHours,
          0
        );

        // Calculate available hours based on schedule
        const availableHours = this.calculateAvailableHours(
          member.availability as any,
          startDate,
          endDate
        );

        const utilizationRate = availableHours > 0 ?
          Math.min((totalTaskHours / availableHours) * 100, 100) : 0;

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          skills: member.skills,
          currentTasks: member.tasks.length,
          maxConcurrent: member.maxConcurrent,
          utilization: utilizationRate,
          capacityHours: availableHours,
          usedHours: totalTaskHours,
          availability: member.availability as any,
          overloadedBy: totalTaskHours > availableHours ? totalTaskHours - availableHours : undefined
        };
      });

      const summary = {
        totalMembers: teamMembers.length,
        availableMembers: availability.filter(a => a.utilization < 90).length,
        averageUtilization: availability.reduce((sum, a) => sum + a.utilization, 0) / availability.length || 0,
        totalCapacityHours: availability.reduce((sum, a) => sum + a.capacityHours, 0),
        totalUsedHours: availability.reduce((sum, a) => sum + a.usedHours, 0)
      };

      logger.debug('Team availability calculated', {
        totalMembers: summary.totalMembers,
        averageUtilization: summary.averageUtilization
      });

      return {
        available: availability.filter(a => !a.overloadedBy && a.utilization < 90),
        unavailable: availability.filter(a => a.currentTasks >= a.maxConcurrent),
        partiallyAvailable: availability.filter(a => a.currentTasks < a.maxConcurrent && a.utilization >= 90 && !a.overloadedBy),
        overloaded: availability.filter(a => a.overloadedBy !== undefined),
        summary
      };

    } catch (error) {
      logger.error('Failed to get team availability', {
        error: (error as Error).message,
        startDate,
        endDate,
        skills
      });
      throw error;
    }
  }

  async getTeamPerformanceMetrics(
    teamMemberIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<TeamPerformanceMetrics> {
    try {
      logger.info('Getting team performance metrics', {
        teamMemberIds,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });

      const where: any = {};
      if (teamMemberIds && teamMemberIds.length > 0) {
        where.assigneeId = { in: teamMemberIds };
      }
      if (startDate || endDate) {
        where.completedAt = {};
        if (startDate) where.completedAt.gte = startDate;
        if (endDate) where.completedAt.lte = endDate;
      }

      const completedTasks = await this.prisma.task.findMany({
        where: {
          ...where,
          status: 'completed',
          completedAt: { not: null }
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          campaign: {
            select: {
              id: true,
              name: true,
              priority: true
            }
          }
        }
      });

      // Group metrics by team member
      const memberMetrics = new Map<string, any>();

      completedTasks.forEach(task => {
        if (!task.assignee) return;

        const memberId = task.assignee.id;
        if (!memberMetrics.has(memberId)) {
          memberMetrics.set(memberId, {
            memberId,
            memberName: task.assignee.name,
            role: task.assignee.role,
            tasksCompleted: 0,
            totalEstimatedHours: 0,
            totalActualHours: 0,
            onTimeCompletions: 0,
            averageCompletionTime: 0,
            efficiencyRatio: 0,
            completedTasks: []
          });
        }

        const metrics = memberMetrics.get(memberId);
        metrics.tasksCompleted++;
        metrics.totalEstimatedHours += task.estimatedHours;
        metrics.totalActualHours += task.actualHours;

        // Check if completed on time
        if (task.completedAt && task.completedAt <= task.dueDate) {
          metrics.onTimeCompletions++;
        }

        metrics.completedTasks.push({
          taskId: task.id,
          title: task.title,
          campaignName: task.campaign.name,
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours,
          dueDate: task.dueDate,
          completedAt: task.completedAt
        });
      });

      // Calculate final metrics
      const memberPerformance = Array.from(memberMetrics.values()).map(metrics => {
        metrics.efficiencyRatio = metrics.totalEstimatedHours > 0 ?
          metrics.totalEstimatedHours / metrics.totalActualHours : 0;

        metrics.onTimeRate = metrics.tasksCompleted > 0 ?
          (metrics.onTimeCompletions / metrics.tasksCompleted) * 100 : 0;

        return metrics;
      });

      // Calculate overall team metrics
      const totalMembers = await this.prisma.teamMember.count({
        where: { isActive: true }
      });

      const overallMetrics = {
        totalMembers,
        activeMembers: totalMembers,
        averageUtilization: memberPerformance.reduce((sum, m) => sum + m.utilizationRate, 0) / memberPerformance.length || 0,
        totalTasksCompleted: completedTasks.length,
        averageTaskCompletionTime: completedTasks.reduce((sum, task) => sum + task.actualHours, 0) / completedTasks.length || 0,
        onTimeDeliveryRate: memberPerformance.reduce((sum, m) => sum + m.onTimeRate, 0) / memberPerformance.length || 0
      };

      logger.debug('Team performance metrics calculated', {
        totalTasksCompleted: overallMetrics.totalTasksCompleted,
        averageUtilization: overallMetrics.averageUtilization
      });

      return {
        overall: overallMetrics,
        members: memberPerformance,
        trends: {
          utilizationTrend: 0, // TODO: Calculate trends
          completionTimeTrend: 0,
          onTimeDeliveryTrend: 0
        }
      };

    } catch (error) {
      logger.error('Failed to get team performance metrics', {
        error: (error as Error).message,
        teamMemberIds,
        startDate,
        endDate
      });
      throw error;
    }
  }

  async updateTeamMemberSkills(
    id: string,
    skills: string[],
    updatedBy: string
  ): Promise<TeamMember> {
    try {
      logger.info('Updating team member skills', {
        memberId: id,
        skills,
        updatedBy
      });

      const teamMember = await this.updateTeamMember(id, { skills }, updatedBy);

      logger.info('Team member skills updated successfully', {
        memberId: id,
        skillCount: skills.length
      });

      return teamMember;

    } catch (error) {
      logger.error('Failed to update team member skills', {
        error: (error as Error).message,
        memberId: id,
        skills,
        updatedBy
      });
      throw error;
    }
  }

  async bulkUpdateAvailability(
    updates: Array<{
      memberId: string;
      availability: WeeklySchedule;
    }>,
    updatedBy: string
  ): Promise<void> {
    try {
      logger.info('Bulk updating team availability', {
        updateCount: updates.length,
        updatedBy
      });

      await Promise.all(
        updates.map(update =>
          this.updateTeamMember(
            update.memberId,
            { availability: update.availability },
            updatedBy
          )
        )
      );

      logger.info('Bulk availability update completed', {
        updateCount: updates.length
      });

    } catch (error) {
      logger.error('Failed to bulk update availability', {
        error: (error as Error).message,
        updateCount: updates.length,
        updatedBy
      });
      throw error;
    }
  }

  private async getTeamMemberWorkload(memberId: string): Promise<any> {
    const activeTasks = await this.prisma.task.count({
      where: {
        assigneeId: memberId,
        status: { in: ['assigned', 'in_progress'] }
      }
    });

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { maxConcurrent: true }
    });

    return {
      activeTasks,
      maxConcurrent: member?.maxConcurrent || 3,
      utilizationRate: member ? (activeTasks / member.maxConcurrent) * 100 : 0,
      isAtCapacity: member ? activeTasks >= member.maxConcurrent : false
    };
  }

  private calculateWorkloadMetrics(member: any): any {
    const activeTasks = member.tasks?.length || 0;
    const utilizationRate = (activeTasks / member.maxConcurrent) * 100;

    return {
      activeTasks,
      maxConcurrent: member.maxConcurrent,
      utilizationRate,
      isAtCapacity: activeTasks >= member.maxConcurrent,
      isOverloaded: activeTasks > member.maxConcurrent,
      availableCapacity: Math.max(0, member.maxConcurrent - activeTasks)
    };
  }

  private calculateAvailableHours(
    _availability: WeeklySchedule,
    startDate: Date,
    endDate: Date
  ): number {
    // Simplified calculation - in a real implementation, this would be more sophisticated
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const workDays = Math.floor(days * 5 / 7); // Assuming 5 work days per week
    return workDays * 8; // Assuming 8 hours per work day
  }

  private getDefaultAvailability(): WeeklySchedule {
    const defaultDay = {
      available: true,
      startTime: '09:00',
      endTime: '17:00',
      timeZone: 'UTC'
    };

    return {
      monday: defaultDay,
      tuesday: defaultDay,
      wednesday: defaultDay,
      thursday: defaultDay,
      friday: defaultDay,
      saturday: { available: false, timeZone: 'UTC' },
      sunday: { available: false, timeZone: 'UTC' }
    };
  }

  private async logTeamActivity(
    memberId: string,
    activityType: string,
    performedBy: string,
    details: any
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          type: activityType,
          entityType: 'team_member',
          entityId: memberId,
          performedBy,
          details
        }
      });
    } catch (error) {
      logger.warn('Failed to log team activity', {
        error: (error as Error).message,
        memberId,
        activityType
      });
    }
  }
}