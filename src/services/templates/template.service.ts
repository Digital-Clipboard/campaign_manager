import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import { Campaign, Task, Timeline } from '@/types';

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  campaignType: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  // Template structure
  timeline: TimelineTemplate;
  tasks: TaskTemplate[];
  approvalFlow: ApprovalStageTemplate[];
  defaultSettings: CampaignTemplateSettings;

  // Usage stats
  usageCount: number;
  rating?: number;
  tags: string[];
}

export interface TimelineTemplate {
  template: string;
  milestones: MilestoneTemplate[];
  estimatedDuration: number;
  buffer: number;
}

export interface MilestoneTemplate {
  name: string;
  description?: string;
  daysFromStart: number;
  dependencies: string[];
  tasks: string[];
  phase?: string;
}

export interface TaskTemplate {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  skills: string[];
  daysFromStart: number;
  dependencies: string[];
  tags: string[];
  assignmentRules?: AssignmentRule[];
}

export interface AssignmentRule {
  type: 'skill' | 'role' | 'availability' | 'workload';
  criteria: any;
  weight: number;
}

export interface ApprovalStageTemplate {
  stage: 'content' | 'compliance' | 'executive' | 'final';
  required: boolean;
  approverRoles: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedDays: number;
  autoApprovalRules?: AutoApprovalRule[];
}

export interface AutoApprovalRule {
  condition: string;
  value: any;
  action: 'approve' | 'skip' | 'escalate';
}

export interface CampaignTemplateSettings {
  priority: 'low' | 'medium' | 'high' | 'critical';
  stakeholderRoles: string[];
  notificationSettings: {
    enableSlack: boolean;
    enableEmail: boolean;
    channels: string[];
  };
  metadata?: Record<string, any>;
}

export type TemplateCategory =
  | 'email_marketing'
  | 'product_launch'
  | 'content_marketing'
  | 'event_marketing'
  | 'lead_generation'
  | 'brand_awareness'
  | 'seasonal'
  | 'custom';

export interface TemplateFilters {
  category?: TemplateCategory;
  campaignType?: string;
  isPublic?: boolean;
  createdBy?: string;
  tags?: string[];
  rating?: number;
  search?: string;
}

export interface TemplateParams {
  name: string;
  targetDate: Date;
  budget?: number;
  stakeholders?: string[];
  customSettings?: Record<string, any>;
  teamAssignments?: Record<string, string>; // taskId -> memberId
}

export interface CloneOptions {
  name: string;
  targetDate?: Date;
  includeTeamAssignments: boolean;
  includeTimeline: boolean;
  includeTasks: boolean;
  includeApprovals: boolean;
  adjustDates: boolean;
  copySettings: boolean;
}

export class TemplateService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  // Template Creation and Management
  async createTemplateFromCampaign(
    campaignId: string,
    templateData: {
      name: string;
      description: string;
      category: TemplateCategory;
      isPublic: boolean;
      tags?: string[];
    },
    createdBy: string
  ): Promise<CampaignTemplate> {
    try {
      logger.info('Creating template from campaign', { campaignId, templateName: templateData.name });

      // Fetch the campaign with all related data
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          timeline: true,
          tasks: {
            include: {
              assignee: true
            }
          },
          approvals: true,
          team: {
            include: {
              member: true
            }
          }
        }
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Convert campaign data to template format
      const template = await this.convertCampaignToTemplate(campaign, templateData, createdBy);

      // Cache the template
      await this.cache.set(`template:${template.id}`, JSON.stringify(template), 3600);

      logger.info('Template created successfully', { templateId: template.id });
      return template;

    } catch (error) {
      logger.error('Error creating template from campaign', { campaignId, error });
      throw error;
    }
  }

  async createCustomTemplate(
    templateData: Omit<CampaignTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
    createdBy: string
  ): Promise<CampaignTemplate> {
    try {
      logger.info('Creating custom template', { templateName: templateData.name });

      const template: CampaignTemplate = {
        ...templateData,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };

      // Store template (simplified - would use proper database storage)
      await this.cache.set(`template:${template.id}`, JSON.stringify(template), 0); // No expiry for templates

      logger.info('Custom template created', { templateId: template.id });
      return template;

    } catch (error) {
      logger.error('Error creating custom template', error);
      throw error;
    }
  }

  // Template Application
  async applyTemplate(
    templateId: string,
    params: TemplateParams,
    createdBy: string
  ): Promise<Campaign> {
    try {
      logger.info('Applying template to create campaign', { templateId, campaignName: params.name });

      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // Create campaign from template
      const campaign = await this.createCampaignFromTemplate(template, params, createdBy);

      // Update template usage count
      await this.incrementTemplateUsage(templateId);

      logger.info('Template applied successfully', { templateId, campaignId: campaign.id });
      return campaign;

    } catch (error) {
      logger.error('Error applying template', { templateId, error });
      throw error;
    }
  }

  // Campaign Cloning
  async cloneCampaign(
    campaignId: string,
    options: CloneOptions,
    createdBy: string
  ): Promise<Campaign> {
    try {
      logger.info('Cloning campaign', { campaignId, newName: options.name });

      const originalCampaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          timeline: true,
          tasks: {
            include: {
              assignee: true
            }
          },
          approvals: true,
          team: {
            include: {
              member: true
            }
          }
        }
      });

      if (!originalCampaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const clonedCampaign = await this.createClonedCampaign(originalCampaign, options, createdBy);

      logger.info('Campaign cloned successfully', {
        originalId: campaignId,
        clonedId: clonedCampaign.id
      });

      return clonedCampaign;

    } catch (error) {
      logger.error('Error cloning campaign', { campaignId, error });
      throw error;
    }
  }

  // Template Retrieval and Management
  async getTemplate(templateId: string): Promise<CampaignTemplate | null> {
    try {
      // Try cache first
      const cached = await this.cache.get(`template:${templateId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database (simplified)
      logger.warn('Template not found in cache', { templateId });
      return null;

    } catch (error) {
      logger.error('Error retrieving template', { templateId, error });
      return null;
    }
  }

  async listTemplates(
    filters: TemplateFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<{ templates: CampaignTemplate[]; total: number }> {
    try {
      logger.info('Listing templates', { filters, limit, offset });

      // This would be a proper database query in production
      const allTemplateKeys = await this.cache.keys('template:*');
      const templates: CampaignTemplate[] = [];

      for (const key of allTemplateKeys) {
        const templateData = await this.cache.get(key);
        if (templateData) {
          const template = JSON.parse(templateData);
          if (this.matchesFilters(template, filters)) {
            templates.push(template);
          }
        }
      }

      // Sort by usage count and rating
      templates.sort((a, b) => {
        const scoreA = (a.usageCount * 0.7) + ((a.rating || 0) * 0.3);
        const scoreB = (b.usageCount * 0.7) + ((b.rating || 0) * 0.3);
        return scoreB - scoreA;
      });

      const paginatedTemplates = templates.slice(offset, offset + limit);

      return {
        templates: paginatedTemplates,
        total: templates.length
      };

    } catch (error) {
      logger.error('Error listing templates', { filters, error });
      throw error;
    }
  }

  async shareTemplate(
    templateId: string,
    visibility: 'public' | 'private' | 'organization',
    sharedBy: string
  ): Promise<boolean> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // Check permissions
      if (template.createdBy !== sharedBy && !template.isPublic) {
        throw new Error('Insufficient permissions to share template');
      }

      // Update template visibility
      template.isPublic = visibility === 'public';
      template.updatedAt = new Date();

      await this.cache.set(`template:${templateId}`, JSON.stringify(template), 0);

      logger.info('Template visibility updated', { templateId, visibility });
      return true;

    } catch (error) {
      logger.error('Error sharing template', { templateId, error });
      throw error;
    }
  }

  async deleteTemplate(templateId: string, deletedBy: string): Promise<boolean> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // Check permissions
      if (template.createdBy !== deletedBy) {
        throw new Error('Insufficient permissions to delete template');
      }

      await this.cache.del(`template:${templateId}`);

      logger.info('Template deleted', { templateId });
      return true;

    } catch (error) {
      logger.error('Error deleting template', { templateId, error });
      throw error;
    }
  }

  // Private helper methods

  private async convertCampaignToTemplate(
    campaign: any,
    templateData: any,
    createdBy: string
  ): Promise<CampaignTemplate> {
    // Convert timeline
    const timelineTemplate: TimelineTemplate = {
      template: campaign.timeline?.template || 'standard',
      milestones: this.convertMilestonesToTemplate(campaign.timeline?.milestones),
      estimatedDuration: this.calculateDuration(campaign),
      buffer: campaign.timeline?.buffer || 24
    };

    // Convert tasks
    const taskTemplates: TaskTemplate[] = campaign.tasks.map((task: any) => ({
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      skills: this.extractSkillsFromTask(task),
      daysFromStart: this.calculateDaysFromStart(task, campaign.createdAt),
      dependencies: task.dependencies || [],
      tags: task.tags || [],
      assignmentRules: this.generateAssignmentRules(task)
    }));

    // Convert approval flow
    const approvalFlow: ApprovalStageTemplate[] = campaign.approvals.map((approval: any) => ({
      stage: approval.stage,
      required: true,
      approverRoles: [approval.approverRole || 'manager'],
      urgency: approval.urgency,
      estimatedDays: 2,
      autoApprovalRules: []
    }));

    return {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      campaignType: campaign.type,
      isPublic: templateData.isPublic,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeline: timelineTemplate,
      tasks: taskTemplates,
      approvalFlow,
      defaultSettings: {
        priority: campaign.priority,
        stakeholderRoles: campaign.stakeholders || [],
        notificationSettings: {
          enableSlack: true,
          enableEmail: true,
          channels: ['campaigns']
        }
      },
      usageCount: 0,
      tags: templateData.tags || []
    };
  }

  private async createCampaignFromTemplate(
    template: CampaignTemplate,
    params: TemplateParams,
    createdBy: string
  ): Promise<Campaign> {
    // Create campaign using existing campaign service
    const campaignData = {
      name: params.name,
      type: template.campaignType as any,
      targetDate: params.targetDate,
      objectives: [],
      priority: template.defaultSettings.priority,
      description: template.description,
      budget: params.budget,
      stakeholders: params.stakeholders || template.defaultSettings.stakeholderRoles,
      metadata: params.customSettings
    };

    // This would integrate with the actual campaign service
    const campaign = await this.prisma.campaign.create({
      data: {
        ...campaignData,
        createdBy,
        updatedBy: createdBy
      }
    });

    return campaign as Campaign;
  }

  private async createClonedCampaign(
    originalCampaign: any,
    options: CloneOptions,
    createdBy: string
  ): Promise<Campaign> {
    const cloneData = {
      name: options.name,
      type: originalCampaign.type,
      targetDate: options.targetDate || this.adjustTargetDate(originalCampaign.targetDate),
      objectives: originalCampaign.objectives,
      priority: originalCampaign.priority,
      description: `Clone of: ${originalCampaign.description || originalCampaign.name}`,
      budget: originalCampaign.budget,
      stakeholders: originalCampaign.stakeholders,
      metadata: options.copySettings ? originalCampaign.metadata : {}
    };

    const clonedCampaign = await this.prisma.campaign.create({
      data: {
        ...cloneData,
        createdBy,
        updatedBy: createdBy
      }
    });

    return clonedCampaign as Campaign;
  }

  private matchesFilters(template: CampaignTemplate, filters: TemplateFilters): boolean {
    if (filters.category && template.category !== filters.category) return false;
    if (filters.campaignType && template.campaignType !== filters.campaignType) return false;
    if (filters.isPublic !== undefined && template.isPublic !== filters.isPublic) return false;
    if (filters.createdBy && template.createdBy !== filters.createdBy) return false;
    if (filters.rating && (template.rating || 0) < filters.rating) return false;

    if (filters.tags?.length) {
      const hasMatchingTag = filters.tags.some(tag => template.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = template.name.toLowerCase().includes(searchLower);
      const matchesDescription = template.description.toLowerCase().includes(searchLower);
      const matchesTags = template.tags.some(tag => tag.toLowerCase().includes(searchLower));

      if (!matchesName && !matchesDescription && !matchesTags) return false;
    }

    return true;
  }

  private async incrementTemplateUsage(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (template) {
      template.usageCount++;
      template.updatedAt = new Date();
      await this.cache.set(`template:${templateId}`, JSON.stringify(template), 0);
    }
  }

  private convertMilestonesToTemplate(milestones: any): MilestoneTemplate[] {
    if (!milestones) return [];

    const milestonesArray = typeof milestones === 'string' ? JSON.parse(milestones) : milestones;

    return milestonesArray.map((milestone: any) => ({
      name: milestone.name,
      description: milestone.description,
      daysFromStart: milestone.daysFromStart || 0,
      dependencies: milestone.dependencies || [],
      tasks: milestone.tasks || [],
      phase: milestone.phase
    }));
  }

  private calculateDuration(campaign: any): number {
    const created = new Date(campaign.createdAt);
    const target = new Date(campaign.targetDate);
    return Math.ceil((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  private extractSkillsFromTask(task: any): string[] {
    // Extract skills from task or assignee
    if (task.assignee?.skills) {
      return task.assignee.skills;
    }

    // Infer skills from task title/description
    const skillKeywords = ['design', 'development', 'marketing', 'content', 'analytics', 'copywriting'];
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();

    return skillKeywords.filter(skill => taskText.includes(skill));
  }

  private calculateDaysFromStart(task: any, campaignStartDate: Date): number {
    const taskDate = new Date(task.createdAt);
    const startDate = new Date(campaignStartDate);
    return Math.ceil((taskDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateAssignmentRules(task: any): AssignmentRule[] {
    const rules: AssignmentRule[] = [];

    // Skill-based rule
    if (task.assignee?.skills?.length) {
      rules.push({
        type: 'skill',
        criteria: { requiredSkills: task.assignee.skills },
        weight: 0.8
      });
    }

    // Priority-based rule
    rules.push({
      type: 'workload',
      criteria: { maxUtilization: task.priority === 'critical' ? 1.0 : 0.8 },
      weight: 0.6
    });

    return rules;
  }

  private adjustTargetDate(originalDate: Date): Date {
    const now = new Date();
    const originalDuration = originalDate.getTime() - Date.now();
    return new Date(now.getTime() + Math.abs(originalDuration));
  }
}