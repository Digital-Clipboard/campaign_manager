import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { TimelineService } from '@/services/timeline/timeline.service';
import { logger } from '@/utils/logger';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignWithRelations,
  CampaignFilters
} from '@/types';

export class CampaignService {
  private timelineService: TimelineService;

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {
    this.timelineService = new TimelineService(prisma, cache);
  }

  async createCampaign(data: CreateCampaignRequest, createdBy: string): Promise<CampaignWithRelations> {
    try {
      logger.info('Creating campaign', { name: data.name, type: data.type, createdBy });

      const campaign = await this.prisma.campaign.create({
        data: {
          name: data.name,
          type: data.type,
          status: 'planning',
          targetDate: data.targetDate,
          objectives: data.objectives || [],
          priority: data.priority || 'medium',
          ...(data.description && { description: data.description }),
          ...(data.budget && { budget: data.budget }),
          stakeholders: data.stakeholders || [],
          ...(data.metadata && { metadata: data.metadata }),
          createdBy,
          updatedBy: createdBy
        },
        include: {
          timeline: true,
          tasks: {
            include: {
              assignee: true
            }
          },
          approvals: {
            include: {
              approver: true
            }
          },
          _count: {
            select: {
              tasks: true,
              approvals: true
            }
          }
        }
      });

      await this.cache.setCampaign(campaign as any);

      // Auto-generate timeline for campaign
      try {
        const timelineResult = await this.timelineService.generateTimeline(
          campaign.id,
          'standard',
          campaign.targetDate
        );

        logger.info('Timeline auto-generated for campaign', {
          campaignId: campaign.id,
          timelineId: timelineResult.timeline.id,
          milestonesCount: Array.isArray(timelineResult.timeline.milestones)
            ? timelineResult.timeline.milestones.length
            : 0
        });
      } catch (timelineError) {
        // Timeline generation is optional - don't fail campaign creation
        logger.warn('Failed to auto-generate timeline', {
          campaignId: campaign.id,
          error: (timelineError as Error).message
        });
      }

      logger.info('Campaign created successfully', {
        campaignId: campaign.id,
        name: campaign.name
      });

      return campaign as any;
    } catch (error) {
      logger.error('Failed to create campaign', {
        error: (error as Error).message,
        data,
        createdBy
      });
      throw error;
    }
  }

  async getCampaign(id: string): Promise<CampaignWithRelations | null> {
    try {
      // Try cache first
      const cached = await this.cache.getCampaign(id);
      if (cached) {
        logger.debug('Campaign retrieved from cache', { campaignId: id });
        return cached as any;
      }

      // Fetch from database
      const campaign = await this.prisma.campaign.findUnique({
        where: { id },
        include: {
          timeline: true,
          tasks: {
            include: {
              assignee: true
            },
            orderBy: { createdAt: 'asc' }
          },
          approvals: {
            include: {
              approver: true
            },
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              tasks: true,
              approvals: true
            }
          }
        }
      });

      if (campaign) {
        await this.cache.setCampaign(campaign as any);
        logger.debug('Campaign retrieved from database', { campaignId: id });
      }

      return campaign as any;
    } catch (error) {
      logger.error('Failed to get campaign', {
        error: (error as Error).message,
        campaignId: id
      });
      throw error;
    }
  }

  async updateCampaign(
    id: string,
    data: UpdateCampaignRequest,
    updatedBy: string
  ): Promise<CampaignWithRelations> {
    try {
      logger.info('Updating campaign', { campaignId: id, updatedBy });

      const campaign = await this.prisma.campaign.update({
        where: { id },
        data: {
          ...data,
          updatedBy
        },
        include: {
          timeline: true,
          tasks: {
            include: {
              assignee: true
            }
          },
          approvals: {
            include: {
              approver: true
            }
          },
          _count: {
            select: {
              tasks: true,
              approvals: true
            }
          }
        }
      });

      // Invalidate cache
      await this.cache.invalidateCampaign(id);

      logger.info('Campaign updated successfully', { campaignId: id });

      return campaign as any;
    } catch (error) {
      logger.error('Failed to update campaign', {
        error: (error as Error).message,
        campaignId: id,
        updatedBy
      });
      throw error;
    }
  }

  async deleteCampaign(id: string, deletedBy: string): Promise<void> {
    try {
      logger.info('Deleting campaign', { campaignId: id, deletedBy });

      await this.prisma.campaign.delete({
        where: { id }
      });

      await this.cache.invalidateCampaign(id);

      logger.info('Campaign deleted successfully', { campaignId: id });
    } catch (error) {
      logger.error('Failed to delete campaign', {
        error: (error as Error).message,
        campaignId: id,
        deletedBy
      });
      throw error;
    }
  }

  async listCampaigns(filters: CampaignFilters = {}): Promise<{
    campaigns: CampaignWithRelations[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        type,
        priority,
        createdBy,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const skip = (page - 1) * pageSize;

      const where: any = {};
      const orderBy: any = { [sortBy]: sortOrder };

      // Apply filters
      if (status) where.status = status;
      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (createdBy) where.createdBy = createdBy;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [campaigns, total] = await Promise.all([
        this.prisma.campaign.findMany({
          where,
          include: {
            timeline: true,
            tasks: {
              include: {
                assignee: true
              },
              take: 5 // Limit tasks for list view
            },
            approvals: {
              include: {
                approver: true
              },
              take: 3 // Limit approvals for list view
            },
            _count: {
              select: {
                tasks: true,
                approvals: true
              }
            }
          },
          orderBy,
          skip,
          take: pageSize
        }),
        this.prisma.campaign.count({ where })
      ]);

      logger.debug('Campaigns listed', {
        count: campaigns.length,
        total,
        page,
        pageSize
      });

      return {
        campaigns: campaigns as any,
        total,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to list campaigns', {
        error: (error as Error).message,
        filters
      });
      throw error;
    }
  }

  async updateCampaignStatus(
    id: string,
    status: string,
    updatedBy: string
  ): Promise<CampaignWithRelations> {
    try {
      logger.info('Updating campaign status', { campaignId: id, status, updatedBy });

      // Validate status transition
      const currentCampaign = await this.prisma.campaign.findUnique({
        where: { id },
        select: { status: true }
      }) as any;

      if (!currentCampaign) {
        throw new Error('Campaign not found');
      }

      const validTransitions = this.getValidStatusTransitions(currentCampaign.status);
      if (!validTransitions.includes(status)) {
        throw new Error(`Invalid status transition from ${currentCampaign.status} to ${status}`);
      }

      const campaign = await this.updateCampaign(id, { status: status as any }, updatedBy);

      // Trigger status change events
      await this.handleStatusChange(id, currentCampaign.status, status, updatedBy);

      return campaign;
    } catch (error) {
      logger.error('Failed to update campaign status', {
        error: (error as Error).message,
        campaignId: id,
        status,
        updatedBy
      });
      throw error;
    }
  }

  async calculateReadinessScore(id: string): Promise<number> {
    try {
      // Check cache first
      const cached = await this.cache.getReadinessScore(id);
      if (cached !== null) {
        return cached;
      }

      // Calculate score using database function
      const result = await this.prisma.$queryRaw<[{ score: number }]>`
        SELECT calculate_readiness_score(${id}) as score
      `;

      const score = result[0]?.score || 0;

      // Cache the result
      await this.cache.setReadinessScore(id, score);

      logger.debug('Readiness score calculated', { campaignId: id, score });

      return score;
    } catch (error) {
      logger.error('Failed to calculate readiness score', {
        error: (error as Error).message,
        campaignId: id
      });
      throw error;
    }
  }

  private getValidStatusTransitions(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      planning: ['ready_for_review', 'cancelled'],
      ready_for_review: ['approved', 'needs_revision', 'cancelled'],
      needs_revision: ['ready_for_review', 'cancelled'],
      approved: ['launched', 'cancelled'],
      launched: ['completed', 'paused'],
      paused: ['launched', 'cancelled'],
      completed: [],
      cancelled: []
    };

    return transitions[currentStatus] || [];
  }

  private async handleStatusChange(
    campaignId: string,
    fromStatus: string,
    toStatus: string,
    updatedBy: string
  ): Promise<void> {
    try {
      // Add status change to activity log
      await this.prisma.activityLog.create({
        data: {
          type: 'campaign_status_change',
          entityType: 'campaign',
          entityId: campaignId,
          performedBy: updatedBy,
          details: {
            fromStatus,
            toStatus,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Trigger notifications for status changes
      if (toStatus === 'ready_for_review') {
        // Notify approvers
        // This will be handled by the notification system
      } else if (toStatus === 'launched') {
        // Notify stakeholders
        // This will be handled by the notification system
      }

      logger.debug('Status change handled', {
        campaignId,
        fromStatus,
        toStatus,
        updatedBy
      });
    } catch (error) {
      logger.error('Failed to handle status change', {
        error: (error as Error).message,
        campaignId,
        fromStatus,
        toStatus
      });
      // Don't throw - this is a side effect
    }
  }
}