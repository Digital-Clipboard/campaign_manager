import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { NotificationService } from '@/services/notification/notification.service';
import { logger } from '@/utils/logger';
import {
  Approval,
  CreateApprovalRequest,
  ApprovalDecision,
  ApprovalFilters,
  ApprovalStage,
  ApprovalStatus,
  ApprovalUrgency
} from '@/types';

export class ApprovalService {
  private readonly APPROVAL_STAGES: ApprovalStage[] = ['content', 'compliance', 'executive', 'final'];
  private readonly STAGE_ESCALATION_HOURS = {
    content: 24,
    compliance: 48,
    executive: 72,
    final: 24
  };

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService,
    private notificationService?: NotificationService
  ) {}

  /**
   * Create approval request for campaign stage
   */
  async createApproval(data: CreateApprovalRequest, createdBy: string): Promise<Approval> {
    try {
      logger.info('Creating approval request', {
        campaignId: data.campaignId,
        stage: data.stage,
        approverId: data.approverId,
        createdBy
      });

      // Validate campaign exists and is in appropriate status
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true, status: true, name: true, priority: true }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if approval already exists for this stage
      const existingApproval = await this.prisma.approval.findUnique({
        where: {
          campaignId_stage_approverId: {
            campaignId: data.campaignId,
            stage: data.stage,
            approverId: data.approverId
          }
        }
      });

      if (existingApproval && existingApproval.status === 'pending') {
        throw new Error('Approval already pending for this stage and approver');
      }

      // Calculate deadline based on urgency and stage
      const deadline = this.calculateDeadline(
        data.urgency || 'normal',
        data.stage,
        campaign.priority as string
      );

      // Calculate auto-approval time if enabled
      const autoApproveAt = data.autoApprove ?
        this.calculateAutoApprovalTime(deadline, data.urgency || 'normal') :
        null;

      const approval = await this.prisma.approval.create({
        data: {
          campaignId: data.campaignId,
          stage: data.stage,
          approverId: data.approverId,
          status: 'pending',
          conditions: data.conditions || [],
          deadline,
          autoApprove: data.autoApprove || false,
          autoApproveAt,
          urgency: data.urgency || 'normal'
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true
            }
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Invalidate caches
      await this.cache.invalidatePattern(`approval:*`);
      await this.cache.invalidatePattern(`campaign:${data.campaignId}`);

      // Send notification to approver
      if (this.notificationService) {
        await this.notificationService.sendApprovalRequest(approval as any);
      }

      // Log activity
      await this.logApprovalActivity(
        'approval_created',
        approval.id,
        createdBy,
        { stage: data.stage, approverId: data.approverId }
      );

      logger.info('Approval request created successfully', {
        approvalId: approval.id,
        deadline: approval.deadline
      });

      return approval as any;

    } catch (error) {
      logger.error('Failed to create approval', {
        error: (error as Error).message,
        campaignId: data.campaignId,
        stage: data.stage
      });
      throw error;
    }
  }

  /**
   * Process approval decision
   */
  async processDecision(
    approvalId: string,
    decision: ApprovalDecision,
    decidedBy: string
  ): Promise<Approval> {
    try {
      logger.info('Processing approval decision', {
        approvalId,
        decision: decision.decision,
        decidedBy
      });

      // Get approval with relations
      const approval = await this.prisma.approval.findUnique({
        where: { id: approvalId },
        include: {
          campaign: true,
          approver: true
        }
      });

      if (!approval) {
        throw new Error('Approval not found');
      }

      if (approval.status !== 'pending') {
        throw new Error(`Approval already ${approval.status}`);
      }

      // Verify the decider is the assigned approver
      if (approval.approverId !== decidedBy) {
        throw new Error('Only assigned approver can make decision');
      }

      // Update approval status
      const updatedApproval = await this.prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: this.mapDecisionToStatus(decision.decision),
          comments: decision.comments,
          decidedAt: new Date(),
          conditions: decision.conditions || approval.conditions
        },
        include: {
          campaign: true,
          approver: true
        }
      });

      // Handle post-decision logic
      await this.handlePostDecision(updatedApproval, decision);

      // Invalidate caches
      await this.cache.invalidatePattern(`approval:*`);
      await this.cache.invalidatePattern(`campaign:${approval.campaignId}`);

      // Log activity
      await this.logApprovalActivity(
        'approval_decided',
        approvalId,
        decidedBy,
        {
          decision: decision.decision,
          previousStatus: approval.status,
          newStatus: updatedApproval.status
        }
      );

      logger.info('Approval decision processed', {
        approvalId,
        newStatus: updatedApproval.status
      });

      return updatedApproval as any;

    } catch (error) {
      logger.error('Failed to process approval decision', {
        error: (error as Error).message,
        approvalId,
        decision: decision.decision
      });
      throw error;
    }
  }

  /**
   * Get approval by ID
   */
  async getApproval(id: string): Promise<Approval | null> {
    try {
      const cacheKey = `approval:${id}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const approval = await this.prisma.approval.findUnique({
        where: { id },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              priority: true
            }
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (approval) {
        await this.cache.set(cacheKey, JSON.stringify(approval), 300); // Cache for 5 minutes
      }

      return approval as any;

    } catch (error) {
      logger.error('Failed to get approval', {
        error: (error as Error).message,
        approvalId: id
      });
      throw error;
    }
  }

  /**
   * List approvals with filters
   */
  async listApprovals(filters: ApprovalFilters = {}): Promise<{
    approvals: Approval[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        campaignId,
        approverId,
        status,
        urgency,
        stage,
        overdue
      } = filters;

      const where: any = {};

      if (campaignId) where.campaignId = campaignId;
      if (approverId) where.approverId = approverId;
      if (status) where.status = status;
      if (urgency) where.urgency = urgency;
      if (stage) where.stage = stage;

      if (overdue) {
        where.deadline = { lt: new Date() };
        where.status = 'pending';
      }

      const [approvals, total] = await Promise.all([
        this.prisma.approval.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [
            { urgency: 'desc' },
            { deadline: 'asc' }
          ],
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true
              }
            },
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }),
        this.prisma.approval.count({ where })
      ]);

      return {
        approvals: approvals as any[],
        total,
        page,
        pageSize
      };

    } catch (error) {
      logger.error('Failed to list approvals', {
        error: (error as Error).message,
        filters
      });
      throw error;
    }
  }

  /**
   * Get approval workflow for campaign
   */
  async getCampaignApprovalWorkflow(campaignId: string): Promise<{
    stages: Array<{
      stage: string;
      approvals: Approval[];
      isComplete: boolean;
      isBlocked: boolean;
    }>;
    overallStatus: string;
    nextRequiredStage: string | null;
  }> {
    try {
      // Get all approvals for the campaign
      const approvals = await this.prisma.approval.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'asc' },
        include: {
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Group by stage
      const stageMap = new Map<string, Approval[]>();
      for (const approval of approvals) {
        const stage = approval.stage;
        if (!stageMap.has(stage)) {
          stageMap.set(stage, []);
        }
        stageMap.get(stage)!.push(approval as any);
      }

      // Build stage status
      const stages = this.APPROVAL_STAGES.map(stage => {
        const stageApprovals = stageMap.get(stage) || [];
        const isComplete = stageApprovals.length > 0 &&
          stageApprovals.every(a => a.status === 'approved');
        const isBlocked = stageApprovals.some(a =>
          a.status === 'rejected' || a.status === 'changes_requested'
        );

        return {
          stage,
          approvals: stageApprovals,
          isComplete,
          isBlocked
        };
      });

      // Determine overall status
      let overallStatus = 'pending';
      if (stages.every(s => s.isComplete)) {
        overallStatus = 'approved';
      } else if (stages.some(s => s.isBlocked)) {
        overallStatus = 'blocked';
      }

      // Find next required stage
      const nextRequiredStage = stages.find(s => !s.isComplete && !s.isBlocked)?.stage || null;

      return {
        stages,
        overallStatus,
        nextRequiredStage
      };

    } catch (error) {
      logger.error('Failed to get campaign approval workflow', {
        error: (error as Error).message,
        campaignId
      });
      throw error;
    }
  }

  /**
   * Process auto-approvals
   */
  async processAutoApprovals(): Promise<number> {
    try {
      logger.info('Processing auto-approvals');

      const pendingAutoApprovals = await this.prisma.approval.findMany({
        where: {
          status: 'pending',
          autoApprove: true,
          autoApproveAt: { lte: new Date() }
        }
      });

      let processedCount = 0;

      for (const approval of pendingAutoApprovals) {
        try {
          await this.prisma.approval.update({
            where: { id: approval.id },
            data: {
              status: 'approved',
              comments: 'Auto-approved after deadline',
              decidedAt: new Date()
            }
          });

          // Log activity
          await this.logApprovalActivity(
            'approval_auto_approved',
            approval.id,
            'system',
            { reason: 'deadline_reached' }
          );

          processedCount++;

          logger.info('Auto-approved approval', {
            approvalId: approval.id,
            campaignId: approval.campaignId
          });

        } catch (error) {
          logger.error('Failed to auto-approve', {
            error: (error as Error).message,
            approvalId: approval.id
          });
        }
      }

      logger.info('Auto-approval processing complete', {
        processedCount,
        totalPending: pendingAutoApprovals.length
      });

      return processedCount;

    } catch (error) {
      logger.error('Failed to process auto-approvals', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Escalate overdue approvals
   */
  async escalateOverdueApprovals(): Promise<number> {
    try {
      logger.info('Escalating overdue approvals');

      const overdueApprovals = await this.prisma.approval.findMany({
        where: {
          status: 'pending',
          deadline: { lt: new Date() },
          urgency: { not: 'critical' }
        },
        include: {
          campaign: true,
          approver: true
        }
      });

      let escalatedCount = 0;

      for (const approval of overdueApprovals) {
        try {
          // Increase urgency level
          const newUrgency = this.escalateUrgency(approval.urgency as ApprovalUrgency);

          await this.prisma.approval.update({
            where: { id: approval.id },
            data: { urgency: newUrgency }
          });

          // Send escalation notification
          if (this.notificationService) {
            await this.notificationService.sendEscalationNotice(approval as any);
          }

          // Log activity
          await this.logApprovalActivity(
            'approval_escalated',
            approval.id,
            'system',
            {
              previousUrgency: approval.urgency,
              newUrgency
            }
          );

          escalatedCount++;

        } catch (error) {
          logger.error('Failed to escalate approval', {
            error: (error as Error).message,
            approvalId: approval.id
          });
        }
      }

      logger.info('Escalation processing complete', {
        escalatedCount,
        totalOverdue: overdueApprovals.length
      });

      return escalatedCount;

    } catch (error) {
      logger.error('Failed to escalate overdue approvals', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch create approvals for campaign stage
   */
  async createStageApprovals(
    campaignId: string,
    stage: ApprovalStage,
    approverIds: string[],
    options: {
      urgency?: ApprovalUrgency;
      autoApprove?: boolean;
      conditions?: string[];
    } = {}
  ): Promise<Approval[]> {
    try {
      logger.info('Creating stage approvals', {
        campaignId,
        stage,
        approverCount: approverIds.length
      });

      const approvals: Approval[] = [];

      for (const approverId of approverIds) {
        try {
          const approval = await this.createApproval({
            campaignId,
            stage,
            approverId,
            urgency: options.urgency,
            autoApprove: options.autoApprove,
            conditions: options.conditions
          }, 'system');

          approvals.push(approval);
        } catch (error) {
          logger.error('Failed to create approval for approver', {
            error: (error as Error).message,
            approverId
          });
        }
      }

      return approvals;

    } catch (error) {
      logger.error('Failed to create stage approvals', {
        error: (error as Error).message,
        campaignId,
        stage
      });
      throw error;
    }
  }

  // Private helper methods

  private calculateDeadline(
    urgency: ApprovalUrgency,
    stage: string,
    campaignPriority: string
  ): Date {
    const baseHours = this.STAGE_ESCALATION_HOURS[stage as ApprovalStage] || 48;

    let multiplier = 1;
    if (urgency === 'critical') multiplier = 0.25;
    else if (urgency === 'high') multiplier = 0.5;
    else if (urgency === 'low') multiplier = 2;

    if (campaignPriority === 'critical') multiplier *= 0.5;
    else if (campaignPriority === 'high') multiplier *= 0.75;

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + (baseHours * multiplier));

    return deadline;
  }

  private calculateAutoApprovalTime(deadline: Date, urgency: ApprovalUrgency): Date {
    const autoApproveTime = new Date(deadline);

    // Add buffer time based on urgency
    const bufferHours = urgency === 'critical' ? 2 :
                       urgency === 'high' ? 4 :
                       urgency === 'normal' ? 8 : 12;

    autoApproveTime.setHours(autoApproveTime.getHours() + bufferHours);

    return autoApproveTime;
  }

  private mapDecisionToStatus(decision: string): ApprovalStatus {
    switch (decision) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'request_changes':
        return 'changes_requested';
      default:
        return 'pending';
    }
  }

  private escalateUrgency(current: ApprovalUrgency): ApprovalUrgency {
    switch (current) {
      case 'low':
        return 'normal';
      case 'normal':
        return 'high';
      case 'high':
        return 'critical';
      default:
        return 'critical';
    }
  }

  private async handlePostDecision(approval: any, decision: ApprovalDecision): Promise<void> {
    // If approved, check if we should advance to next stage
    if (decision.decision === 'approve') {
      const workflow = await this.getCampaignApprovalWorkflow(approval.campaignId);

      // Check if current stage is complete
      const currentStage = workflow.stages.find(s => s.stage === approval.stage);
      if (currentStage?.isComplete) {
        // Trigger next stage if exists
        if (workflow.nextRequiredStage) {
          logger.info('Current stage complete, ready for next stage', {
            currentStage: approval.stage,
            nextStage: workflow.nextRequiredStage
          });

          // Notification service will handle triggering next stage approvals
          if (this.notificationService) {
            await this.notificationService.notifyNextStageReady(
              approval.campaignId,
              workflow.nextRequiredStage
            );
          }
        }

        // If all stages complete, update campaign status
        if (workflow.overallStatus === 'approved') {
          await this.prisma.campaign.update({
            where: { id: approval.campaignId },
            data: {
              status: 'approved',
              readinessScore: 100
            }
          });

          logger.info('All approvals complete, campaign approved', {
            campaignId: approval.campaignId
          });
        }
      }
    }

    // If rejected or changes requested, notify campaign owner
    if (decision.decision === 'reject' || decision.decision === 'request_changes') {
      if (this.notificationService) {
        await this.notificationService.notifyApprovalBlocked(approval);
      }
    }
  }

  private async logApprovalActivity(
    action: string,
    approvalId: string,
    performedBy: string,
    details: any
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          type: 'approval_activity',
          entityType: 'approval',
          entityId: approvalId,
          action,
          performedBy,
          details
        }
      });
    } catch (error) {
      logger.error('Failed to log approval activity', {
        error: (error as Error).message,
        action,
        approvalId
      });
    }
  }
}