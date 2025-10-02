import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { NotificationService } from '@/services/notification/notification.service';
import { CampaignService } from '@/services/campaign/campaign.service';
import { TaskService } from '@/services/task/task.service';
import { ApprovalService } from '@/services/approval/approval.service';

export interface BulkOperationResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
  successIds: string[];
}

export interface BulkCampaignUpdate {
  status?: string;
  priority?: string;
  budget?: number;
  endDate?: Date;
  assigneeEmail?: string;
  tags?: string[];
}

export interface BulkTaskUpdate {
  status?: string;
  priority?: string;
  assigneeEmail?: string;
  dueDate?: Date;
  estimatedHours?: number;
  tags?: string[];
}

export interface BulkApprovalUpdate {
  status?: string;
  urgency?: string;
  approverEmail?: string;
  dueDate?: Date;
}

export class BulkOperationsService {
  private notificationService: NotificationService;
  private campaignService: CampaignService;
  private taskService: TaskService;
  private approvalService: ApprovalService;

  constructor() {
    this.notificationService = new NotificationService();
    this.campaignService = new CampaignService();
    this.taskService = new TaskService();
    this.approvalService = new ApprovalService();
  }

  // Bulk Campaign Operations
  async bulkUpdateCampaigns(
    campaignIds: string[],
    updates: BulkCampaignUpdate,
    updatedBy: string,
    notifyTeam: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk campaign update', { campaignIds: campaignIds.length, updates });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: campaignIds.length,
      errors: [],
      successIds: []
    };

    for (const campaignId of campaignIds) {
      try {
        // Validate campaign exists
        const campaign = await this.campaignService.getCampaign(campaignId);
        if (!campaign) {
          result.errors.push({ id: campaignId, error: 'Campaign not found' });
          result.failed++;
          continue;
        }

        // Apply updates
        const updateData: any = {};
        if (updates.status) updateData.status = updates.status;
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.budget !== undefined) updateData.budget = updates.budget;
        if (updates.endDate) updateData.endDate = updates.endDate;
        if (updates.assigneeEmail) updateData.assigneeEmail = updates.assigneeEmail;
        if (updates.tags) updateData.tags = updates.tags;

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            ...updateData,
            updatedAt: new Date()
          }
        });

        // Send notification if requested
        if (notifyTeam && (updates.status || updates.assigneeEmail)) {
          await this.notificationService.createNotification({
            type: 'campaign_updated',
            title: `Campaign Updated: ${campaign.name}`,
            message: `Campaign has been updated via bulk operation`,
            recipientEmail: updates.assigneeEmail || campaign.assigneeEmail,
            metadata: { campaignId, updatedBy, bulkOperation: true }
          });
        }

        result.successIds.push(campaignId);
        result.success++;

      } catch (error) {
        logger.error('Failed to update campaign in bulk operation', { campaignId, error });
        result.errors.push({
          id: campaignId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk campaign update completed', result);
    return result;
  }

  async bulkDeleteCampaigns(
    campaignIds: string[],
    deletedBy: string,
    notifyTeam: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk campaign deletion', { campaignIds: campaignIds.length });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: campaignIds.length,
      errors: [],
      successIds: []
    };

    for (const campaignId of campaignIds) {
      try {
        // Get campaign details before deletion
        const campaign = await this.campaignService.getCampaign(campaignId);
        if (!campaign) {
          result.errors.push({ id: campaignId, error: 'Campaign not found' });
          result.failed++;
          continue;
        }

        // Delete associated tasks and approvals first
        await prisma.task.deleteMany({ where: { campaignId } });
        await prisma.approval.deleteMany({ where: { campaignId } });

        // Delete campaign
        await prisma.campaign.delete({ where: { id: campaignId } });

        // Send notification if requested
        if (notifyTeam) {
          await this.notificationService.createNotification({
            type: 'campaign_deleted',
            title: `Campaign Deleted: ${campaign.name}`,
            message: `Campaign has been deleted via bulk operation`,
            recipientEmail: campaign.assigneeEmail,
            metadata: { campaignId, deletedBy, bulkOperation: true }
          });
        }

        result.successIds.push(campaignId);
        result.success++;

      } catch (error) {
        logger.error('Failed to delete campaign in bulk operation', { campaignId, error });
        result.errors.push({
          id: campaignId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk campaign deletion completed', result);
    return result;
  }

  // Bulk Task Operations
  async bulkUpdateTasks(
    taskIds: string[],
    updates: BulkTaskUpdate,
    updatedBy: string,
    notifyAssignees: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk task update', { taskIds: taskIds.length, updates });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: taskIds.length,
      errors: [],
      successIds: []
    };

    for (const taskId of taskIds) {
      try {
        // Validate task exists
        const task = await this.taskService.getTask(taskId);
        if (!task) {
          result.errors.push({ id: taskId, error: 'Task not found' });
          result.failed++;
          continue;
        }

        // Apply updates
        const updateData: any = {};
        if (updates.status) updateData.status = updates.status;
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.assigneeEmail) updateData.assigneeEmail = updates.assigneeEmail;
        if (updates.dueDate) updateData.dueDate = updates.dueDate;
        if (updates.estimatedHours !== undefined) updateData.estimatedHours = updates.estimatedHours;
        if (updates.tags) updateData.tags = updates.tags;

        await prisma.task.update({
          where: { id: taskId },
          data: {
            ...updateData,
            updatedAt: new Date()
          }
        });

        // Send notification if requested
        if (notifyAssignees && (updates.status || updates.assigneeEmail || updates.dueDate)) {
          await this.notificationService.createNotification({
            type: 'task_updated',
            title: `Task Updated: ${task.title}`,
            message: `Task has been updated via bulk operation`,
            recipientEmail: updates.assigneeEmail || task.assigneeEmail,
            metadata: { taskId, updatedBy, bulkOperation: true }
          });
        }

        result.successIds.push(taskId);
        result.success++;

      } catch (error) {
        logger.error('Failed to update task in bulk operation', { taskId, error });
        result.errors.push({
          id: taskId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk task update completed', result);
    return result;
  }

  async bulkDeleteTasks(
    taskIds: string[],
    deletedBy: string,
    notifyAssignees: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk task deletion', { taskIds: taskIds.length });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: taskIds.length,
      errors: [],
      successIds: []
    };

    for (const taskId of taskIds) {
      try {
        // Get task details before deletion
        const task = await this.taskService.getTask(taskId);
        if (!task) {
          result.errors.push({ id: taskId, error: 'Task not found' });
          result.failed++;
          continue;
        }

        // Delete task
        await prisma.task.delete({ where: { id: taskId } });

        // Send notification if requested
        if (notifyAssignees) {
          await this.notificationService.createNotification({
            type: 'task_deleted',
            title: `Task Deleted: ${task.title}`,
            message: `Task has been deleted via bulk operation`,
            recipientEmail: task.assigneeEmail,
            metadata: { taskId, deletedBy, bulkOperation: true }
          });
        }

        result.successIds.push(taskId);
        result.success++;

      } catch (error) {
        logger.error('Failed to delete task in bulk operation', { taskId, error });
        result.errors.push({
          id: taskId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk task deletion completed', result);
    return result;
  }

  // Bulk Approval Operations
  async bulkUpdateApprovals(
    approvalIds: string[],
    updates: BulkApprovalUpdate,
    updatedBy: string,
    notifyApprovers: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk approval update', { approvalIds: approvalIds.length, updates });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: approvalIds.length,
      errors: [],
      successIds: []
    };

    for (const approvalId of approvalIds) {
      try {
        // Validate approval exists
        const approval = await this.approvalService.getApproval(approvalId);
        if (!approval) {
          result.errors.push({ id: approvalId, error: 'Approval not found' });
          result.failed++;
          continue;
        }

        // Apply updates
        const updateData: any = {};
        if (updates.status) updateData.status = updates.status;
        if (updates.urgency) updateData.urgency = updates.urgency;
        if (updates.approverEmail) updateData.approverEmail = updates.approverEmail;
        if (updates.dueDate) updateData.dueDate = updates.dueDate;

        await prisma.approval.update({
          where: { id: approvalId },
          data: {
            ...updateData,
            updatedAt: new Date()
          }
        });

        // Send notification if requested
        if (notifyApprovers && (updates.status || updates.approverEmail)) {
          await this.notificationService.createNotification({
            type: 'approval_updated',
            title: `Approval Updated: ${approval.stage}`,
            message: `Approval has been updated via bulk operation`,
            recipientEmail: updates.approverEmail || approval.approverEmail,
            metadata: { approvalId, updatedBy, bulkOperation: true }
          });
        }

        result.successIds.push(approvalId);
        result.success++;

      } catch (error) {
        logger.error('Failed to update approval in bulk operation', { approvalId, error });
        result.errors.push({
          id: approvalId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk approval update completed', result);
    return result;
  }

  // Bulk Status Changes
  async bulkChangeStatus(
    entityType: 'campaign' | 'task' | 'approval',
    entityIds: string[],
    newStatus: string,
    updatedBy: string,
    reason?: string
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk status change', { entityType, entityIds: entityIds.length, newStatus });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: entityIds.length,
      errors: [],
      successIds: []
    };

    for (const entityId of entityIds) {
      try {
        let tableName: string;
        let entityName: string = '';

        switch (entityType) {
          case 'campaign':
            tableName = 'campaign';
            const campaign = await prisma.campaign.findUnique({ where: { id: entityId } });
            entityName = campaign?.name || 'Unknown Campaign';
            break;
          case 'task':
            tableName = 'task';
            const task = await prisma.task.findUnique({ where: { id: entityId } });
            entityName = task?.title || 'Unknown Task';
            break;
          case 'approval':
            tableName = 'approval';
            const approval = await prisma.approval.findUnique({ where: { id: entityId } });
            entityName = approval?.stage || 'Unknown Approval';
            break;
          default:
            throw new Error(`Invalid entity type: ${entityType}`);
        }

        // Update status
        await (prisma as any)[tableName].update({
          where: { id: entityId },
          data: {
            status: newStatus,
            updatedAt: new Date()
          }
        });

        // Create notification
        await this.notificationService.createNotification({
          type: `${entityType}_status_changed`,
          title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Status Changed`,
          message: `${entityName} status changed to ${newStatus}${reason ? ` - ${reason}` : ''}`,
          recipientEmail: 'admin@example.com', // Should be dynamic based on entity
          metadata: {
            entityId,
            entityType,
            newStatus,
            updatedBy,
            reason,
            bulkOperation: true
          }
        });

        result.successIds.push(entityId);
        result.success++;

      } catch (error) {
        logger.error('Failed to change status in bulk operation', { entityType, entityId, error });
        result.errors.push({
          id: entityId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk status change completed', result);
    return result;
  }

  // Bulk Assignment
  async bulkAssignItems(
    entityType: 'campaign' | 'task' | 'approval',
    entityIds: string[],
    assigneeEmail: string,
    assignedBy: string,
    notifyAssignee: boolean = true
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk assignment', { entityType, entityIds: entityIds.length, assigneeEmail });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: entityIds.length,
      errors: [],
      successIds: []
    };

    for (const entityId of entityIds) {
      try {
        let tableName: string;
        let entityName: string = '';
        let fieldName: string;

        switch (entityType) {
          case 'campaign':
            tableName = 'campaign';
            fieldName = 'assigneeEmail';
            const campaign = await prisma.campaign.findUnique({ where: { id: entityId } });
            entityName = campaign?.name || 'Unknown Campaign';
            break;
          case 'task':
            tableName = 'task';
            fieldName = 'assigneeEmail';
            const task = await prisma.task.findUnique({ where: { id: entityId } });
            entityName = task?.title || 'Unknown Task';
            break;
          case 'approval':
            tableName = 'approval';
            fieldName = 'approverEmail';
            const approval = await prisma.approval.findUnique({ where: { id: entityId } });
            entityName = approval?.stage || 'Unknown Approval';
            break;
          default:
            throw new Error(`Invalid entity type: ${entityType}`);
        }

        // Update assignment
        await (prisma as any)[tableName].update({
          where: { id: entityId },
          data: {
            [fieldName]: assigneeEmail,
            updatedAt: new Date()
          }
        });

        // Send notification if requested
        if (notifyAssignee) {
          await this.notificationService.createNotification({
            type: `${entityType}_assigned`,
            title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Assigned`,
            message: `You have been assigned: ${entityName}`,
            recipientEmail: assigneeEmail,
            metadata: {
              entityId,
              entityType,
              assignedBy,
              bulkOperation: true
            }
          });
        }

        result.successIds.push(entityId);
        result.success++;

      } catch (error) {
        logger.error('Failed to assign item in bulk operation', { entityType, entityId, error });
        result.errors.push({
          id: entityId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk assignment completed', result);
    return result;
  }

  // Bulk Tag Operations
  async bulkAddTags(
    entityType: 'campaign' | 'task',
    entityIds: string[],
    tagsToAdd: string[],
    updatedBy: string
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk tag addition', { entityType, entityIds: entityIds.length, tagsToAdd });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: entityIds.length,
      errors: [],
      successIds: []
    };

    for (const entityId of entityIds) {
      try {
        const tableName = entityType;

        // Get current entity
        const entity = await (prisma as any)[tableName].findUnique({
          where: { id: entityId }
        });

        if (!entity) {
          result.errors.push({ id: entityId, error: `${entityType} not found` });
          result.failed++;
          continue;
        }

        // Merge tags (avoid duplicates)
        const currentTags = entity.tags || [];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])];

        // Update entity
        await (prisma as any)[tableName].update({
          where: { id: entityId },
          data: {
            tags: newTags,
            updatedAt: new Date()
          }
        });

        result.successIds.push(entityId);
        result.success++;

      } catch (error) {
        logger.error('Failed to add tags in bulk operation', { entityType, entityId, error });
        result.errors.push({
          id: entityId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk tag addition completed', result);
    return result;
  }

  async bulkRemoveTags(
    entityType: 'campaign' | 'task',
    entityIds: string[],
    tagsToRemove: string[],
    updatedBy: string
  ): Promise<BulkOperationResult> {
    logger.info('Starting bulk tag removal', { entityType, entityIds: entityIds.length, tagsToRemove });

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      total: entityIds.length,
      errors: [],
      successIds: []
    };

    for (const entityId of entityIds) {
      try {
        const tableName = entityType;

        // Get current entity
        const entity = await (prisma as any)[tableName].findUnique({
          where: { id: entityId }
        });

        if (!entity) {
          result.errors.push({ id: entityId, error: `${entityType} not found` });
          result.failed++;
          continue;
        }

        // Remove specified tags
        const currentTags = entity.tags || [];
        const newTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag));

        // Update entity
        await (prisma as any)[tableName].update({
          where: { id: entityId },
          data: {
            tags: newTags,
            updatedAt: new Date()
          }
        });

        result.successIds.push(entityId);
        result.success++;

      } catch (error) {
        logger.error('Failed to remove tags in bulk operation', { entityType, entityId, error });
        result.errors.push({
          id: entityId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    logger.info('Bulk tag removal completed', result);
    return result;
  }
}