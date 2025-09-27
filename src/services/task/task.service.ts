import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters,
  TaskWithRelations,
  TaskAssignmentResult,
  TimelineTemplate
} from '@/types';

export class TaskService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  async createTask(data: CreateTaskRequest, createdBy: string): Promise<TaskWithRelations> {
    try {
      logger.info('Creating task', {
        title: data.title,
        campaignId: data.campaignId,
        createdBy
      });

      // Validate campaign exists
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true, status: true }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Calculate auto-assignment if no assignee specified
      let assigneeId = data.assigneeId;
      if (!assigneeId && data.autoAssign) {
        const assignment = await this.findBestAssignee(data);
        assigneeId = assignment?.assigneeId;
      }

      const task = await this.prisma.task.create({
        data: {
          campaignId: data.campaignId,
          title: data.title,
          description: data.description,
          assigneeId,
          dueDate: data.dueDate,
          priority: data.priority || 'medium',
          status: assigneeId ? 'assigned' : 'pending',
          dependencies: data.dependencies || [],
          estimatedHours: data.estimatedHours || 0,
          actualHours: 0,
          tags: data.tags || [],
          createdBy,
          updatedBy: createdBy,
          ...(data.milestoneId && { milestoneId: data.milestoneId }),
          ...(data.templateTaskId && { templateTaskId: data.templateTaskId })
        },
        include: {
          assignee: true,
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true
            }
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          attachments: true
        }
      });

      // Invalidate related caches
      await this.cache.invalidateTask(task.id);
      await this.cache.invalidateCampaign(data.campaignId);

      // Trigger task assignment notification if assigned
      if (assigneeId) {
        await this.triggerTaskAssignmentNotification(task.id, assigneeId, createdBy);
      }

      logger.info('Task created successfully', {
        taskId: task.id,
        title: task.title,
        assigneeId: task.assigneeId
      });

      return task as any;

    } catch (error) {
      logger.error('Failed to create task', {
        error: (error as Error).message,
        data,
        createdBy
      });
      throw error;
    }
  }

  async getTask(id: string): Promise<TaskWithRelations | null> {
    try {
      // Try cache first
      const cached = await this.cache.getTask(id);
      if (cached) {
        logger.debug('Task retrieved from cache', { taskId: id });
        return cached as any;
      }

      // Fetch from database
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: {
          assignee: true,
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              targetDate: true
            }
          },
          comments: {
            orderBy: { createdAt: 'desc' }
          },
          attachments: true,
          // Dependencies - this would need a join table in real implementation
          // For now, we'll handle this in the service layer
        }
      });

      if (task) {
        await this.cache.setTask(task as any);
        logger.debug('Task retrieved from database', { taskId: id });
      }

      return task as any;

    } catch (error) {
      logger.error('Failed to get task', {
        error: (error as Error).message,
        taskId: id
      });
      throw error;
    }
  }

  async updateTask(
    id: string,
    data: UpdateTaskRequest,
    updatedBy: string
  ): Promise<TaskWithRelations> {
    try {
      logger.info('Updating task', { taskId: id, updatedBy });

      // Get current task for comparison
      const currentTask = await this.prisma.task.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          assigneeId: true,
          priority: true,
          dueDate: true
        }
      });

      if (!currentTask) {
        throw new Error('Task not found');
      }

      // Handle status transitions
      if (data.status && data.status !== currentTask.status) {
        await this.validateStatusTransition(currentTask.status, data.status);
      }

      // Handle assignment changes
      if (data.assigneeId && data.assigneeId !== currentTask.assigneeId) {
        await this.handleAssignmentChange(id, currentTask.assigneeId, data.assigneeId, updatedBy);
      }

      const task = await this.prisma.task.update({
        where: { id },
        data: {
          ...data,
          updatedBy,
          ...(data.status === 'completed' && currentTask.status !== 'completed' && { completedAt: new Date() })
        },
        include: {
          assignee: true,
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true
            }
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          attachments: true
        }
      });

      // Invalidate caches
      await this.cache.invalidateTask(id);
      await this.cache.invalidateCampaign(task.campaignId);

      // Log activity
      await this.logTaskActivity(id, 'task_updated', updatedBy, {
        changes: data,
        previousValues: {
          status: currentTask.status,
          assigneeId: currentTask.assigneeId,
          priority: currentTask.priority,
          dueDate: currentTask.dueDate
        }
      });

      logger.info('Task updated successfully', { taskId: id });

      return task as any;

    } catch (error) {
      logger.error('Failed to update task', {
        error: (error as Error).message,
        taskId: id,
        updatedBy
      });
      throw error;
    }
  }

  async deleteTask(id: string, deletedBy: string): Promise<void> {
    try {
      logger.info('Deleting task', { taskId: id, deletedBy });

      const task = await this.prisma.task.findUnique({
        where: { id },
        select: { id: true, campaignId: true, status: true }
      });

      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status === 'in_progress') {
        throw new Error('Cannot delete task that is in progress');
      }

      await this.prisma.task.delete({
        where: { id }
      });

      // Invalidate caches
      await this.cache.invalidateTask(id);
      await this.cache.invalidateCampaign(task.campaignId);

      logger.info('Task deleted successfully', { taskId: id });

    } catch (error) {
      logger.error('Failed to delete task', {
        error: (error as Error).message,
        taskId: id,
        deletedBy
      });
      throw error;
    }
  }

  async listTasks(filters: TaskFilters = {}): Promise<{
    tasks: TaskWithRelations[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        page = 1,
        pageSize = 20,
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
      } = filters;

      const skip = (page - 1) * pageSize;
      const where: any = {};
      const orderBy: any = { [sortBy]: sortOrder };

      // Apply filters
      if (campaignId) where.campaignId = campaignId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (status) where.status = status;
      if (priority) where.priority = priority;

      if (dueFrom || dueTo) {
        where.dueDate = {};
        if (dueFrom) where.dueDate.gte = new Date(dueFrom);
        if (dueTo) where.dueDate.lte = new Date(dueTo);
      }

      if (overdue) {
        where.dueDate = {
          ...where.dueDate,
          lt: new Date()
        };
        where.status = {
          not: 'completed'
        };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: {
            assignee: true,
            campaign: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true
              }
            },
            _count: {
              select: {
                comments: true,
                attachments: true
              }
            }
          },
          orderBy,
          skip,
          take: pageSize
        }),
        this.prisma.task.count({ where })
      ]);

      logger.debug('Tasks listed', {
        count: tasks.length,
        total,
        page,
        pageSize,
        filters
      });

      return {
        tasks: tasks as any,
        total,
        page,
        pageSize
      };

    } catch (error) {
      logger.error('Failed to list tasks', {
        error: (error as Error).message,
        filters
      });
      throw error;
    }
  }

  async assignTask(
    taskId: string,
    assigneeId: string,
    assignedBy: string
  ): Promise<TaskWithRelations> {
    try {
      logger.info('Assigning task', { taskId, assigneeId, assignedBy });

      // Validate assignee exists and is available
      const assignee = await this.prisma.teamMember.findUnique({
        where: { id: assigneeId },
        select: { id: true, name: true, isActive: true, maxConcurrent: true }
      });

      if (!assignee || !assignee.isActive) {
        throw new Error('Assignee not found or inactive');
      }

      // Check assignee workload
      const currentTasks = await this.prisma.task.count({
        where: {
          assigneeId,
          status: { in: ['assigned', 'in_progress'] }
        }
      });

      if (currentTasks >= assignee.maxConcurrent) {
        logger.warn('Assignee at capacity', {
          assigneeId,
          currentTasks,
          maxConcurrent: assignee.maxConcurrent
        });
      }

      const task = await this.updateTask(taskId, {
        assigneeId,
        status: 'assigned'
      }, assignedBy);

      // Trigger assignment notification
      await this.triggerTaskAssignmentNotification(taskId, assigneeId, assignedBy);

      logger.info('Task assigned successfully', {
        taskId,
        assigneeId,
        assigneeName: assignee.name
      });

      return task;

    } catch (error) {
      logger.error('Failed to assign task', {
        error: (error as Error).message,
        taskId,
        assigneeId,
        assignedBy
      });
      throw error;
    }
  }

  async generateTasksFromTimeline(
    campaignId: string,
    timelineId: string,
    templateName: string
  ): Promise<TaskWithRelations[]> {
    try {
      logger.info('Generating tasks from timeline', {
        campaignId,
        timelineId,
        templateName
      });

      // Get timeline with milestones
      const timeline = await this.prisma.timeline.findUnique({
        where: { id: timelineId },
        include: {
          campaign: true
        }
      });

      if (!timeline) {
        throw new Error('Timeline not found');
      }

      // Get template to understand task details
      const template = await this.getTimelineTemplate(templateName, timeline.campaign.type);
      const milestones = Array.isArray(timeline.milestones) ? timeline.milestones : [];
      const createdTasks: TaskWithRelations[] = [];

      // Generate tasks for each milestone phase
      for (const milestone of milestones) {
        const milestoneData = milestone as any;
        const phaseTasks = template.tasks.filter(task =>
          milestoneData.tasks?.includes(task.id)
        );

        for (const templateTask of phaseTasks) {
          // Calculate due date based on milestone
          const dueDate = new Date(milestoneData.dueDate);
          dueDate.setDate(dueDate.getDate() - 1); // Due day before milestone

          const taskData: CreateTaskRequest = {
            campaignId,
            title: templateTask.title,
            description: templateTask.description,
            dueDate,
            priority: templateTask.priority,
            estimatedHours: templateTask.estimatedHours,
            tags: templateTask.skills,
            dependencies: templateTask.dependencies,
            milestoneId: milestoneData.id,
            templateTaskId: templateTask.id,
            autoAssign: true
          };

          try {
            const task = await this.createTask(taskData, 'system');
            createdTasks.push(task);
          } catch (taskError) {
            logger.warn('Failed to create task from template', {
              templateTaskId: templateTask.id,
              error: (taskError as Error).message
            });
          }
        }
      }

      // Update task dependencies based on template
      await this.updateTaskDependencies(createdTasks, template);

      logger.info('Tasks generated from timeline successfully', {
        campaignId,
        timelineId,
        tasksCreated: createdTasks.length
      });

      return createdTasks;

    } catch (error) {
      logger.error('Failed to generate tasks from timeline', {
        error: (error as Error).message,
        campaignId,
        timelineId,
        templateName
      });
      throw error;
    }
  }

  async findBestAssignee(taskData: CreateTaskRequest): Promise<TaskAssignmentResult | null> {
    try {
      // Get available team members with required skills
      const teamMembers = await this.prisma.teamMember.findMany({
        where: {
          isActive: true,
          // In a real implementation, we'd filter by skills
          // skills: { hasSome: taskData.tags }
        },
        include: {
          tasks: {
            where: {
              status: { in: ['assigned', 'in_progress'] }
            },
            select: { id: true, priority: true, dueDate: true }
          }
        }
      });

      if (teamMembers.length === 0) {
        return null;
      }

      // Score each team member based on availability and skills
      const scoredMembers = teamMembers.map(member => {
        const currentLoad = member.tasks.length;
        const capacity = member.maxConcurrent;
        const availabilityScore = Math.max(0, (capacity - currentLoad) / capacity);

        // Simple skill matching (in real implementation, this would be more sophisticated)
        const skillScore = 0.5; // Placeholder

        // Urgency factor based on due date
        const daysUntilDue = Math.ceil(
          (taskData.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        const urgencyScore = daysUntilDue < 3 ? 1.0 : 0.7;

        const totalScore = (availabilityScore * 0.4) + (skillScore * 0.4) + (urgencyScore * 0.2);

        return {
          member,
          score: totalScore,
          currentLoad,
          capacity,
          availabilityScore,
          skillScore
        };
      });

      // Sort by score and return best match
      scoredMembers.sort((a, b) => b.score - a.score);
      const bestMatch = scoredMembers[0];

      if (bestMatch.score > 0.3) { // Minimum acceptable score
        return {
          assigneeId: bestMatch.member.id,
          assigneeName: bestMatch.member.name,
          confidence: bestMatch.score,
          reasoning: `Selected based on availability (${Math.round(bestMatch.availabilityScore * 100)}%) and skill match`
        };
      }

      return null;

    } catch (error) {
      logger.error('Failed to find best assignee', {
        error: (error as Error).message,
        taskData
      });
      return null;
    }
  }

  private async getTimelineTemplate(templateName: string, campaignType: string): Promise<TimelineTemplate> {
    // This would normally call the TimelineService, but for now we'll use a simple implementation
    const cacheKey = `timeline_template:${templateName}:${campaignType}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Return a basic template for now
    return {
      name: 'Basic Template',
      type: campaignType,
      description: 'Basic campaign template',
      duration: 14,
      phases: [],
      tasks: []
    };
  }

  private async validateStatusTransition(currentStatus: string, newStatus: string): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      pending: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'blocked', 'cancelled'],
      in_progress: ['completed', 'blocked', 'assigned'],
      blocked: ['assigned', 'in_progress'],
      completed: [],
      cancelled: ['pending']
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async handleAssignmentChange(
    taskId: string,
    oldAssigneeId: string | null,
    newAssigneeId: string,
    updatedBy: string
  ): Promise<void> {
    // Log assignment change
    await this.logTaskActivity(taskId, 'task_reassigned', updatedBy, {
      oldAssigneeId,
      newAssigneeId
    });

    // Notify old assignee if exists
    if (oldAssigneeId) {
      // This would trigger a notification
    }

    // Notify new assignee
    await this.triggerTaskAssignmentNotification(taskId, newAssigneeId, updatedBy);
  }

  private async triggerTaskAssignmentNotification(
    taskId: string,
    assigneeId: string,
    assignedBy: string
  ): Promise<void> {
    try {
      // This would use the notification queue
      logger.debug('Task assignment notification triggered', {
        taskId,
        assigneeId,
        assignedBy
      });
    } catch (error) {
      logger.warn('Failed to trigger task assignment notification', {
        error: (error as Error).message,
        taskId,
        assigneeId
      });
    }
  }

  private async logTaskActivity(
    taskId: string,
    activityType: string,
    performedBy: string,
    details: any
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          type: activityType,
          entityType: 'task',
          entityId: taskId,
          performedBy,
          details
        }
      });
    } catch (error) {
      logger.warn('Failed to log task activity', {
        error: (error as Error).message,
        taskId,
        activityType
      });
    }
  }

  private async updateTaskDependencies(
    tasks: TaskWithRelations[],
    template: TimelineTemplate
  ): Promise<void> {
    try {
      // Create a map of template task ID to actual task ID
      const taskMap = new Map<string, string>();
      tasks.forEach(task => {
        if ((task as any).templateTaskId) {
          taskMap.set((task as any).templateTaskId, task.id);
        }
      });

      // Update dependencies
      for (const task of tasks) {
        const templateTaskId = (task as any).templateTaskId;
        if (!templateTaskId) continue;

        const templateTask = template.tasks.find(t => t.id === templateTaskId);
        if (!templateTask || !templateTask.dependencies.length) continue;

        const actualDependencies = templateTask.dependencies
          .map(depId => taskMap.get(depId))
          .filter(Boolean) as string[];

        if (actualDependencies.length > 0) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { dependencies: actualDependencies }
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to update task dependencies', {
        error: (error as Error).message
      });
    }
  }
}