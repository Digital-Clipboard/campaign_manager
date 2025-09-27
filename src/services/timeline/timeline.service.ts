import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  Timeline,
  Milestone,
  TimelineTemplate,
  TaskTemplate
} from '@/types';

interface TimelineCalculationResult {
  timeline: Timeline;
  criticalPath: string[];
  totalDuration: number;
  buffer: number;
}

export class TimelineService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  async generateTimeline(
    campaignId: string,
    templateName: string,
    targetDate: Date,
    customRequirements?: any
  ): Promise<TimelineCalculationResult> {
    try {
      logger.info('Generating timeline', {
        campaignId,
        templateName,
        targetDate: targetDate.toISOString()
      });

      // Get campaign details
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          type: true,
          priority: true,
          objectives: true,
          targetDate: true
        }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Load timeline template
      const template = await this.getTimelineTemplate(templateName, campaign.type);

      // Calculate milestones based on template and target date
      const milestones = this.calculateMilestones(
        template,
        targetDate,
        campaign.priority,
        customRequirements
      );

      // Calculate critical path
      const criticalPath = this.calculateCriticalPath(milestones, template.tasks);

      // Calculate buffer time
      const buffer = this.calculateBufferTime(template, campaign.priority);

      // Calculate total estimated hours
      const estimatedHours = template.tasks.reduce(
        (total, task) => total + task.estimatedHours,
        0
      );

      // Create timeline record
      const timeline = await this.prisma.timeline.create({
        data: {
          campaignId,
          template: templateName,
          milestones: milestones as any,
          criticalPath,
          buffer,
          estimatedHours
        }
      });

      const result: TimelineCalculationResult = {
        timeline: timeline as any,
        criticalPath,
        totalDuration: this.calculateTotalDuration(milestones),
        buffer
      };

      logger.info('Timeline generated successfully', {
        campaignId,
        timelineId: timeline.id,
        milestonesCount: milestones.length,
        criticalPathLength: criticalPath.length,
        buffer
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate timeline', {
        error: (error as Error).message,
        campaignId,
        templateName
      });
      throw error;
    }
  }

  async updateTimeline(
    timelineId: string,
    updates: {
      milestones?: Milestone[];
      buffer?: number;
      targetDate?: Date;
    }
  ): Promise<Timeline> {
    try {
      logger.info('Updating timeline', { timelineId, updates });

      // Get existing timeline
      const existingTimeline = await this.prisma.timeline.findUnique({
        where: { id: timelineId },
        include: { campaign: true }
      });

      if (!existingTimeline) {
        throw new Error('Timeline not found');
      }

      // Recalculate if target date changed
      let newMilestones = updates.milestones;
      let newCriticalPath = existingTimeline.criticalPath;

      if (updates.targetDate && updates.targetDate !== existingTimeline.campaign.targetDate) {
        const template = await this.getTimelineTemplate(
          existingTimeline.template,
          existingTimeline.campaign.type
        );

        newMilestones = this.calculateMilestones(
          template,
          updates.targetDate,
          existingTimeline.campaign.priority
        );

        newCriticalPath = this.calculateCriticalPath(newMilestones, template.tasks);

        // Update campaign target date
        await this.prisma.campaign.update({
          where: { id: existingTimeline.campaignId },
          data: { targetDate: updates.targetDate }
        });
      }

      // Update timeline
      const updatedTimeline = await this.prisma.timeline.update({
        where: { id: timelineId },
        data: {
          ...(newMilestones && { milestones: newMilestones as any }),
          ...(updates.buffer && { buffer: updates.buffer }),
          ...(newCriticalPath && { criticalPath: newCriticalPath })
        }
      });

      logger.info('Timeline updated successfully', { timelineId });

      return updatedTimeline as any;

    } catch (error) {
      logger.error('Failed to update timeline', {
        error: (error as Error).message,
        timelineId
      });
      throw error;
    }
  }

  async getTimeline(timelineId: string): Promise<Timeline | null> {
    try {
      const timeline = await this.prisma.timeline.findUnique({
        where: { id: timelineId },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              targetDate: true
            }
          }
        }
      });

      return timeline as any;

    } catch (error) {
      logger.error('Failed to get timeline', {
        error: (error as Error).message,
        timelineId
      });
      throw error;
    }
  }

  async getTimelineTemplate(templateName: string, campaignType: string): Promise<TimelineTemplate> {
    try {
      // Check cache first
      const cacheKey = `timeline_template:${templateName}:${campaignType}`;
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Load template from predefined templates
      const template = this.getBuiltInTemplate(templateName, campaignType);

      // Cache template for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(template), 3600);

      return template;

    } catch (error) {
      logger.error('Failed to get timeline template', {
        error: (error as Error).message,
        templateName,
        campaignType
      });
      throw error;
    }
  }

  private getBuiltInTemplate(templateName: string, campaignType: string): TimelineTemplate {
    const templates: Record<string, TimelineTemplate> = {
      email_blast_standard: {
        name: 'Email Blast - Standard',
        type: 'email_blast',
        description: 'Standard email campaign timeline',
        duration: 14, // days
        phases: [
          {
            name: 'Planning & Strategy',
            duration: 3,
            startOffset: 0,
            tasks: ['strategy', 'audience_segmentation', 'content_outline']
          },
          {
            name: 'Content Creation',
            duration: 5,
            startOffset: 3,
            tasks: ['copywriting', 'design', 'approval_content']
          },
          {
            name: 'Technical Setup',
            duration: 3,
            startOffset: 8,
            tasks: ['email_template', 'testing', 'list_setup']
          },
          {
            name: 'Launch & Monitor',
            duration: 3,
            startOffset: 11,
            tasks: ['final_approval', 'send_campaign', 'monitor_results']
          }
        ],
        tasks: [
          {
            id: 'strategy',
            title: 'Campaign Strategy Development',
            description: 'Define campaign goals and key messaging',
            estimatedHours: 8,
            dependencies: [],
            skills: ['strategy', 'marketing'],
            priority: 'high'
          },
          {
            id: 'audience_segmentation',
            title: 'Audience Segmentation',
            description: 'Define target audience segments',
            estimatedHours: 4,
            dependencies: ['strategy'],
            skills: ['data_analysis', 'marketing'],
            priority: 'high'
          },
          {
            id: 'content_outline',
            title: 'Content Outline',
            description: 'Create detailed content outline',
            estimatedHours: 3,
            dependencies: ['strategy'],
            skills: ['content_strategy'],
            priority: 'medium'
          },
          {
            id: 'copywriting',
            title: 'Email Copywriting',
            description: 'Write email copy and subject lines',
            estimatedHours: 12,
            dependencies: ['content_outline', 'audience_segmentation'],
            skills: ['copywriting', 'content_creation'],
            priority: 'high'
          },
          {
            id: 'design',
            title: 'Email Design',
            description: 'Create email template design',
            estimatedHours: 16,
            dependencies: ['content_outline'],
            skills: ['design', 'html_css'],
            priority: 'high'
          },
          {
            id: 'approval_content',
            title: 'Content Approval',
            description: 'Get stakeholder approval for content',
            estimatedHours: 2,
            dependencies: ['copywriting', 'design'],
            skills: ['project_management'],
            priority: 'critical'
          },
          {
            id: 'email_template',
            title: 'Email Template Setup',
            description: 'Set up email in ESP platform',
            estimatedHours: 6,
            dependencies: ['approval_content'],
            skills: ['email_marketing', 'technical'],
            priority: 'high'
          },
          {
            id: 'testing',
            title: 'Email Testing',
            description: 'Test email across devices and clients',
            estimatedHours: 4,
            dependencies: ['email_template'],
            skills: ['qa', 'email_marketing'],
            priority: 'high'
          },
          {
            id: 'list_setup',
            title: 'Email List Setup',
            description: 'Set up recipient lists and segments',
            estimatedHours: 3,
            dependencies: ['audience_segmentation'],
            skills: ['email_marketing', 'data_management'],
            priority: 'medium'
          },
          {
            id: 'final_approval',
            title: 'Final Campaign Approval',
            description: 'Get final approval to send',
            estimatedHours: 1,
            dependencies: ['testing', 'list_setup'],
            skills: ['project_management'],
            priority: 'critical'
          },
          {
            id: 'send_campaign',
            title: 'Send Campaign',
            description: 'Execute email send',
            estimatedHours: 2,
            dependencies: ['final_approval'],
            skills: ['email_marketing'],
            priority: 'critical'
          },
          {
            id: 'monitor_results',
            title: 'Monitor Results',
            description: 'Monitor campaign performance',
            estimatedHours: 4,
            dependencies: ['send_campaign'],
            skills: ['analytics', 'email_marketing'],
            priority: 'medium'
          }
        ]
      },

      product_launch_standard: {
        name: 'Product Launch - Standard',
        type: 'product_launch',
        description: 'Standard product launch campaign timeline',
        duration: 42, // 6 weeks
        phases: [
          {
            name: 'Pre-Launch Planning',
            duration: 14,
            startOffset: 0,
            tasks: ['market_research', 'positioning', 'launch_strategy', 'timeline_planning']
          },
          {
            name: 'Content & Asset Creation',
            duration: 14,
            startOffset: 7,
            tasks: ['messaging', 'content_creation', 'asset_design', 'website_updates']
          },
          {
            name: 'Marketing Campaign Setup',
            duration: 10,
            startOffset: 21,
            tasks: ['campaign_setup', 'pr_outreach', 'influencer_outreach', 'paid_media']
          },
          {
            name: 'Launch Execution',
            duration: 7,
            startOffset: 31,
            tasks: ['soft_launch', 'full_launch', 'post_launch_monitoring']
          }
        ],
        tasks: [
          {
            id: 'market_research',
            title: 'Market Research & Analysis',
            description: 'Research target market and competitive landscape',
            estimatedHours: 20,
            dependencies: [],
            skills: ['research', 'analysis'],
            priority: 'high'
          },
          {
            id: 'positioning',
            title: 'Product Positioning',
            description: 'Define product positioning and value proposition',
            estimatedHours: 16,
            dependencies: ['market_research'],
            skills: ['strategy', 'positioning'],
            priority: 'high'
          },
          {
            id: 'launch_strategy',
            title: 'Launch Strategy Development',
            description: 'Develop comprehensive launch strategy',
            estimatedHours: 24,
            dependencies: ['positioning'],
            skills: ['strategy', 'product_marketing'],
            priority: 'critical'
          },
          {
            id: 'messaging',
            title: 'Key Messaging Development',
            description: 'Develop key messaging and value props',
            estimatedHours: 16,
            dependencies: ['launch_strategy'],
            skills: ['messaging', 'copywriting'],
            priority: 'high'
          },
          {
            id: 'content_creation',
            title: 'Marketing Content Creation',
            description: 'Create all marketing content assets',
            estimatedHours: 40,
            dependencies: ['messaging'],
            skills: ['content_creation', 'copywriting'],
            priority: 'high'
          },
          {
            id: 'asset_design',
            title: 'Visual Asset Design',
            description: 'Design all visual marketing assets',
            estimatedHours: 32,
            dependencies: ['messaging'],
            skills: ['design', 'branding'],
            priority: 'high'
          },
          {
            id: 'website_updates',
            title: 'Website Updates',
            description: 'Update website with product information',
            estimatedHours: 24,
            dependencies: ['content_creation', 'asset_design'],
            skills: ['web_development', 'content_management'],
            priority: 'high'
          },
          {
            id: 'campaign_setup',
            title: 'Marketing Campaign Setup',
            description: 'Set up all marketing campaigns',
            estimatedHours: 20,
            dependencies: ['content_creation', 'asset_design'],
            skills: ['digital_marketing', 'campaign_management'],
            priority: 'high'
          },
          {
            id: 'pr_outreach',
            title: 'PR & Media Outreach',
            description: 'Coordinate PR and media outreach',
            estimatedHours: 16,
            dependencies: ['messaging'],
            skills: ['pr', 'communications'],
            priority: 'medium'
          },
          {
            id: 'soft_launch',
            title: 'Soft Launch Execution',
            description: 'Execute soft launch to limited audience',
            estimatedHours: 12,
            dependencies: ['campaign_setup', 'website_updates'],
            skills: ['project_management', 'launch_execution'],
            priority: 'critical'
          },
          {
            id: 'full_launch',
            title: 'Full Launch Execution',
            description: 'Execute full product launch',
            estimatedHours: 16,
            dependencies: ['soft_launch'],
            skills: ['project_management', 'launch_execution'],
            priority: 'critical'
          },
          {
            id: 'post_launch_monitoring',
            title: 'Post-Launch Monitoring',
            description: 'Monitor launch performance and optimize',
            estimatedHours: 20,
            dependencies: ['full_launch'],
            skills: ['analytics', 'optimization'],
            priority: 'high'
          }
        ]
      }
    };

    const templateKey = `${campaignType}_${templateName}`;
    if (templates[templateKey]) {
      return templates[templateKey];
    }

    // Return default template based on campaign type
    if (campaignType === 'email_blast') {
      return templates.email_blast_standard;
    } else if (campaignType === 'product_launch') {
      return templates.product_launch_standard;
    }

    // Fallback to basic template
    return {
      name: 'Basic Campaign',
      type: campaignType,
      description: 'Basic campaign timeline',
      duration: 7,
      phases: [
        {
          name: 'Planning',
          duration: 3,
          startOffset: 0,
          tasks: ['planning']
        },
        {
          name: 'Execution',
          duration: 4,
          startOffset: 3,
          tasks: ['execution']
        }
      ],
      tasks: [
        {
          id: 'planning',
          title: 'Campaign Planning',
          description: 'Plan campaign activities',
          estimatedHours: 8,
          dependencies: [],
          skills: ['planning'],
          priority: 'high'
        },
        {
          id: 'execution',
          title: 'Campaign Execution',
          description: 'Execute campaign',
          estimatedHours: 16,
          dependencies: ['planning'],
          skills: ['execution'],
          priority: 'high'
        }
      ]
    };
  }

  private calculateMilestones(
    template: TimelineTemplate,
    targetDate: Date,
    priority: string,
    _customRequirements?: any
  ): Milestone[] {
    const milestones: Milestone[] = [];

    // Apply priority adjustments
    const priorityMultiplier = this.getPriorityMultiplier(priority);
    const adjustedDuration = Math.ceil(template.duration * priorityMultiplier);

    // Calculate start date working backwards from target date
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - adjustedDuration);

    // Create milestones for each phase
    template.phases.forEach((phase, index) => {
      const phaseStartDate = new Date(startDate);
      phaseStartDate.setDate(phaseStartDate.getDate() + Math.ceil(phase.startOffset * priorityMultiplier));

      const phaseEndDate = new Date(phaseStartDate);
      phaseEndDate.setDate(phaseEndDate.getDate() + Math.ceil(phase.duration * priorityMultiplier));

      milestones.push({
        id: `milestone-${index + 1}`,
        name: phase.name,
        description: `Complete ${phase.name} phase`,
        dueDate: phaseEndDate,
        status: 'pending',
        dependencies: index > 0 ? [`milestone-${index}`] : [],
        tasks: phase.tasks,
        phase: phase.name,
        estimatedHours: template.tasks
          .filter(task => phase.tasks.includes(task.id))
          .reduce((total, task) => total + task.estimatedHours, 0)
      });
    });

    return milestones;
  }

  private calculateCriticalPath(_milestones: Milestone[], tasks: TaskTemplate[]): string[] {
    // Simplified critical path calculation
    // In a real implementation, this would use proper CPM algorithm
    const criticalTasks = tasks
      .filter(task => task.priority === 'critical' || task.priority === 'high')
      .sort((a, b) => {
        // Sort by dependency chain length
        const aDepthScore = this.calculateDependencyDepth(a, tasks);
        const bDepthScore = this.calculateDependencyDepth(b, tasks);
        return bDepthScore - aDepthScore;
      })
      .map(task => task.id);

    return criticalTasks;
  }

  private calculateDependencyDepth(task: TaskTemplate, allTasks: TaskTemplate[]): number {
    const visited = new Set<string>();

    const calculateDepth = (taskId: string): number => {
      if (visited.has(taskId)) return 0; // Avoid cycles
      visited.add(taskId);

      const currentTask = allTasks.find(t => t.id === taskId);
      if (!currentTask || currentTask.dependencies.length === 0) {
        return 1;
      }

      return 1 + Math.max(...currentTask.dependencies.map(depId => calculateDepth(depId)));
    };

    return calculateDepth(task.id);
  }

  private calculateBufferTime(template: TimelineTemplate, priority: string): number {
    // Calculate buffer as percentage of total duration
    const baseBu‌ffer = Math.ceil(template.duration * 0.15); // 15% base buffer

    // Adjust buffer based on priority
    switch (priority) {
      case 'critical':
        return Math.ceil(baseBu‌ffer * 0.5); // Reduce buffer for critical campaigns
      case 'high':
        return baseBu‌ffer;
      case 'medium':
        return Math.ceil(baseBu‌ffer * 1.2);
      case 'low':
        return Math.ceil(baseBu‌ffer * 1.5);
      default:
        return baseBu‌ffer;
    }
  }

  private getPriorityMultiplier(priority: string): number {
    // Adjust timeline duration based on priority
    switch (priority) {
      case 'critical':
        return 0.8; // Compress timeline by 20%
      case 'high':
        return 0.9; // Compress timeline by 10%
      case 'medium':
        return 1.0; // Standard timeline
      case 'low':
        return 1.2; // Extend timeline by 20%
      default:
        return 1.0;
    }
  }

  private calculateTotalDuration(milestones: Milestone[]): number {
    if (milestones.length === 0) return 0;

    const startDate = new Date(Math.min(...milestones.map(m => m.dueDate.getTime())));
    const endDate = new Date(Math.max(...milestones.map(m => m.dueDate.getTime())));

    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
}