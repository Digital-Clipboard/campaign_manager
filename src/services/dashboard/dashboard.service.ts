import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  DashboardMetrics,
  CampaignAnalytics,
  TeamPerformance,
  RiskIndicator,
  TrendData,
  DateRange,
  DashboardFilters,
  WorkloadData,
  ApprovalDelay,
  SystemHealthStatus,
  MilestoneStatus,
  MemberPerformance,
  DataPoint
} from '@/types/dashboard.types';
import { Campaign, Task, TeamMember } from '@/types';
import { addDays, differenceInDays, differenceInHours, startOfDay, endOfDay, subDays, format } from 'date-fns';

export class DashboardService {
  private readonly CACHE_KEYS = {
    OVERVIEW: 'dashboard:overview',
    CAMPAIGN_ANALYTICS: 'dashboard:campaign:',
    TEAM_PERFORMANCE: 'dashboard:team:',
    TRENDS: 'dashboard:trends:',
    RISKS: 'dashboard:risks'
  };

  private readonly CACHE_TTL = {
    OVERVIEW: 300,        // 5 minutes
    TRENDS: 3600,         // 1 hour
    TEAM: 600,           // 10 minutes
    CAMPAIGN: 900,       // 15 minutes
    RISKS: 1800         // 30 minutes
  };

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  async getOverviewMetrics(filters?: DashboardFilters): Promise<DashboardMetrics> {
    try {
      const cacheKey = `${this.CACHE_KEYS.OVERVIEW}:${JSON.stringify(filters || {})}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating dashboard overview metrics', { filters });

      // Build date range filter
      const dateFilter = this.buildDateFilter(filters?.dateRange);

      // Parallel fetch all metrics
      const [
        campaigns,
        tasks,
        teamMembers,
        approvals,
        systemHealth
      ] = await Promise.all([
        this.fetchCampaignMetrics(dateFilter, filters),
        this.fetchTaskMetrics(dateFilter, filters),
        this.fetchTeamMetrics(dateFilter, filters),
        this.fetchApprovalMetrics(dateFilter, filters),
        this.getSystemHealth()
      ]);

      // Calculate derived metrics
      const workloadDistribution = await this.calculateWorkloadDistribution(teamMembers);
      const performanceTrends = await this.calculatePerformanceTrends(filters?.dateRange);

      const metrics: DashboardMetrics = {
        // Campaign metrics
        totalCampaigns: campaigns.total,
        activeCampaigns: campaigns.active,
        campaignsByStatus: campaigns.byStatus,
        upcomingDeadlines: campaigns.upcomingDeadlines,
        campaignCompletionRate: campaigns.completionRate,
        averageCampaignDuration: campaigns.avgDuration,

        // Task metrics
        totalTasks: tasks.total,
        overdueTasks: tasks.overdue,
        taskCompletionRate: tasks.completionRate,
        tasksByPriority: tasks.byPriority,
        tasksByStatus: tasks.byStatus,
        averageTaskCompletionTime: tasks.avgCompletionTime,

        // Team metrics
        teamUtilization: teamMembers.utilization,
        availableMembers: teamMembers.available,
        workloadDistribution,
        teamProductivity: teamMembers.productivity,

        // Performance metrics
        avgCampaignDuration: campaigns.avgDuration,
        avgTaskCompletionTime: tasks.avgCompletionTime,
        approvalBottlenecks: approvals.bottlenecks,
        performanceTrends,

        // System metrics
        systemHealth,
        lastUpdated: new Date()
      };

      await this.cache.set(cacheKey, JSON.stringify(metrics), this.CACHE_TTL.OVERVIEW);
      return metrics;

    } catch (error) {
      logger.error('Error generating dashboard metrics', error);
      throw error;
    }
  }

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    try {
      const cacheKey = `${this.CACHE_KEYS.CAMPAIGN_ANALYTICS}${campaignId}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating campaign analytics', { campaignId });

      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          tasks: true,
          timeline: true,
          team: {
            include: {
              member: true
            }
          },
          approvals: true
        }
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const analytics = await this.calculateCampaignAnalytics(campaign);

      await this.cache.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL.CAMPAIGN);
      return analytics;

    } catch (error) {
      logger.error('Error generating campaign analytics', { campaignId, error });
      throw error;
    }
  }

  async getTeamPerformance(period: DateRange): Promise<TeamPerformance> {
    try {
      const cacheKey = `${this.CACHE_KEYS.TEAM_PERFORMANCE}${period.startDate}:${period.endDate}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating team performance metrics', { period });

      const tasks = await this.prisma.task.findMany({
        where: {
          AND: [
            { createdAt: { gte: period.startDate } },
            { createdAt: { lte: period.endDate } }
          ]
        },
        include: {
          assignee: true
        }
      });

      const teamMembers = await this.prisma.teamMember.findMany({
        where: { isActive: true }
      });

      const performance = this.calculateTeamPerformanceMetrics(tasks, teamMembers, period);

      await this.cache.set(cacheKey, JSON.stringify(performance), this.CACHE_TTL.TEAM);
      return performance;

    } catch (error) {
      logger.error('Error generating team performance', { period, error });
      throw error;
    }
  }

  async getRiskAssessment(): Promise<RiskIndicator[]> {
    try {
      const cached = await this.cache.get(this.CACHE_KEYS.RISKS);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating risk assessment');

      const risks: RiskIndicator[] = [];

      // Schedule risks - overdue campaigns and tasks
      const overdueRisks = await this.assessScheduleRisks();
      risks.push(...overdueRisks);

      // Resource risks - overloaded team members
      const resourceRisks = await this.assessResourceRisks();
      risks.push(...resourceRisks);

      // Approval risks - pending approvals
      const approvalRisks = await this.assessApprovalRisks();
      risks.push(...approvalRisks);

      // Quality risks - high failure rates
      const qualityRisks = await this.assessQualityRisks();
      risks.push(...qualityRisks);

      // Sort by risk score
      risks.sort((a, b) => b.riskScore - a.riskScore);

      await this.cache.set(this.CACHE_KEYS.RISKS, JSON.stringify(risks), this.CACHE_TTL.RISKS);
      return risks;

    } catch (error) {
      logger.error('Error generating risk assessment', error);
      throw error;
    }
  }

  async getTrendAnalysis(metric: string, period: DateRange): Promise<TrendData> {
    try {
      const cacheKey = `${this.CACHE_KEYS.TRENDS}${metric}:${period.startDate}:${period.endDate}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating trend analysis', { metric, period });

      const dataPoints = await this.collectTrendData(metric, period);
      const trend = this.analyzeTrend(dataPoints);
      const forecast = this.forecastTrend(dataPoints, 7); // 7-day forecast

      const trendData: TrendData = {
        metric,
        period,
        dataPoints,
        trend,
        changePercentage: this.calculateChangePercentage(dataPoints),
        forecast
      };

      await this.cache.set(cacheKey, JSON.stringify(trendData), this.CACHE_TTL.TRENDS);
      return trendData;

    } catch (error) {
      logger.error('Error generating trend analysis', { metric, period, error });
      throw error;
    }
  }

  // Private helper methods

  private buildDateFilter(dateRange?: DateRange) {
    if (!dateRange) {
      return {};
    }
    return {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate
      }
    };
  }

  private async fetchCampaignMetrics(dateFilter: any, filters?: DashboardFilters) {
    const where: any = { ...dateFilter };

    if (filters?.campaignTypes?.length) {
      where.type = { in: filters.campaignTypes };
    }
    if (filters?.priorities?.length) {
      where.priority = { in: filters.priorities };
    }
    if (filters?.statuses?.length) {
      where.status = { in: filters.statuses };
    }

    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: {
        tasks: {
          select: { status: true, completedAt: true }
        }
      }
    });

    const now = new Date();
    const activeCampaigns = campaigns.filter(c =>
      ['preparation', 'review', 'scheduled', 'live'].includes(c.status)
    );

    const upcomingDeadlines = campaigns
      .filter(c => c.targetDate > now && c.status !== 'completed' && c.status !== 'cancelled')
      .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime())
      .slice(0, 5);

    const byStatus = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedCampaigns = campaigns.filter(c => c.status === 'completed');
    const completionRate = campaigns.length > 0
      ? (completedCampaigns.length / campaigns.length) * 100
      : 0;

    const avgDuration = completedCampaigns.length > 0
      ? completedCampaigns.reduce((sum, c) => {
          const duration = differenceInDays(c.updatedAt, c.createdAt);
          return sum + duration;
        }, 0) / completedCampaigns.length
      : 0;

    return {
      total: campaigns.length,
      active: activeCampaigns.length,
      byStatus,
      upcomingDeadlines,
      completionRate,
      avgDuration
    };
  }

  private async fetchTaskMetrics(dateFilter: any, filters?: DashboardFilters) {
    const where: any = { ...dateFilter };

    if (filters?.priorities?.length) {
      where.priority = { in: filters.priorities };
    }
    if (filters?.teamMembers?.length) {
      where.assigneeId = { in: filters.teamMembers };
    }

    const tasks = await this.prisma.task.findMany({ where });
    const now = new Date();

    const overdueTasks = tasks.filter(t =>
      t.status !== 'completed' && t.dueDate < now
    ).length;

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = tasks.length > 0
      ? (completedTasks.length / tasks.length) * 100
      : 0;

    const byPriority = tasks.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgCompletionTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const time = t.completedAt
            ? differenceInHours(t.completedAt, t.createdAt)
            : 0;
          return sum + time;
        }, 0) / completedTasks.length
      : 0;

    return {
      total: tasks.length,
      overdue: overdueTasks,
      completionRate,
      byPriority,
      byStatus,
      avgCompletionTime
    };
  }

  private async fetchTeamMetrics(dateFilter: any, filters?: DashboardFilters) {
    const where: any = { isActive: true };

    if (filters?.teamMembers?.length) {
      where.id = { in: filters.teamMembers };
    }

    const teamMembers = await this.prisma.teamMember.findMany({
      where,
      include: {
        tasks: {
          where: {
            status: { notIn: ['completed', 'cancelled'] }
          }
        }
      }
    });

    const available = teamMembers.filter(m =>
      m.tasks.length < m.maxConcurrent
    );

    const totalCapacity = teamMembers.reduce((sum, m) => sum + m.maxConcurrent, 0);
    const currentLoad = teamMembers.reduce((sum, m) => sum + m.tasks.length, 0);
    const utilization = totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0;

    // Calculate productivity (simplified metric)
    const completedTasks = await this.prisma.task.count({
      where: {
        assigneeId: { in: teamMembers.map(m => m.id) },
        status: 'completed',
        completedAt: dateFilter.createdAt
      }
    });

    const productivity = teamMembers.length > 0
      ? completedTasks / teamMembers.length
      : 0;

    return {
      utilization,
      available,
      productivity
    };
  }

  private async fetchApprovalMetrics(dateFilter: any, filters?: DashboardFilters) {
    const approvals = await this.prisma.approval.findMany({
      where: {
        status: 'pending',
        ...dateFilter
      },
      include: {
        campaign: true
      }
    });

    const now = new Date();
    const bottlenecks: ApprovalDelay[] = approvals
      .filter(a => a.dueDate && a.dueDate < now)
      .map(a => ({
        campaignId: a.campaignId,
        campaignName: a.campaign.name,
        stage: a.stage,
        delayHours: differenceInHours(now, a.dueDate!),
        approverId: a.approverId,
        dueDate: a.dueDate!,
        priority: a.urgency
      }))
      .sort((a, b) => b.delayHours - a.delayHours)
      .slice(0, 10);

    return { bottlenecks };
  }

  private async calculateWorkloadDistribution(teamData: any): Promise<WorkloadData[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { isActive: true },
      include: {
        tasks: true
      }
    });

    return members.map(member => {
      const tasks = member.tasks || [];
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
      const overdueTasks = tasks.filter(t =>
        t.status !== 'completed' && t.dueDate < new Date()
      );

      const estimatedHours = tasks
        .filter(t => t.status !== 'completed')
        .reduce((sum, t) => sum + t.estimatedHours, 0);

      const utilization = member.maxConcurrent > 0
        ? (tasks.filter(t => t.status !== 'completed').length / member.maxConcurrent) * 100
        : 0;

      return {
        memberId: member.id,
        memberName: member.name,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        inProgressTasks: inProgressTasks.length,
        overdueTasks: overdueTasks.length,
        utilization,
        estimatedHoursRemaining: estimatedHours
      };
    });
  }

  private async calculatePerformanceTrends(dateRange?: DateRange): Promise<TrendData[]> {
    const period = dateRange || {
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    };

    const trends: TrendData[] = [];

    // Task completion trend
    const taskTrend = await this.getTrendAnalysis('task_completion', period);
    trends.push(taskTrend);

    // Campaign progress trend
    const campaignTrend = await this.getTrendAnalysis('campaign_progress', period);
    trends.push(campaignTrend);

    return trends;
  }

  private async calculateCampaignAnalytics(campaign: any): Promise<CampaignAnalytics> {
    const tasks = campaign.tasks || [];
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const pendingTasks = tasks.filter((t: any) => t.status === 'pending');
    const overdueTasks = tasks.filter((t: any) =>
      t.status !== 'completed' && t.dueDate < new Date()
    );

    const estimatedHoursRemaining = tasks
      .filter((t: any) => t.status !== 'completed')
      .reduce((sum: number, t: any) => sum + t.estimatedHours, 0);

    const actualHoursSpent = tasks
      .reduce((sum: number, t: any) => sum + t.actualHours, 0);

    const efficiency = estimatedHoursRemaining > 0
      ? (actualHoursSpent / (actualHoursSpent + estimatedHoursRemaining)) * 100
      : 100;

    const completionPercentage = tasks.length > 0
      ? (completedTasks.length / tasks.length) * 100
      : 0;

    // Parse timeline milestones
    let milestoneStatuses: MilestoneStatus[] = [];
    if (campaign.timeline?.milestones) {
      const milestones = typeof campaign.timeline.milestones === 'string'
        ? JSON.parse(campaign.timeline.milestones)
        : campaign.timeline.milestones;

      milestoneStatuses = milestones.map((m: any) => ({
        name: m.name,
        status: m.status || 'pending',
        completionPercentage: m.status === 'completed' ? 100 : 0,
        dueDate: new Date(m.dueDate),
        completedAt: m.completedAt ? new Date(m.completedAt) : undefined
      }));
    }

    // Calculate risks
    const risks = await this.assessCampaignRisks(campaign);

    // Generate recommendations
    const recommendations = this.generateCampaignRecommendations(campaign, {
      completedTasks,
      pendingTasks,
      overdueTasks,
      efficiency
    });

    return {
      campaignId: campaign.id,
      metrics: {
        readinessScore: campaign.readinessScore || 0,
        completionPercentage,
        tasksCompleted: completedTasks.length,
        tasksPending: pendingTasks.length,
        overdueTaskCount: overdueTasks.length,
        teamMembers: campaign.team?.length || 0,
        estimatedHoursRemaining,
        actualHoursSpent,
        efficiency
      },
      timeline: {
        startDate: campaign.createdAt,
        targetDate: campaign.targetDate,
        estimatedCompletionDate: this.estimateCompletionDate(campaign, tasks),
        criticalPathStatus: campaign.timeline?.criticalPath?.length > 0 ? 'active' : 'inactive',
        bufferRemaining: campaign.timeline?.buffer || 0,
        milestoneCompletion: milestoneStatuses
      },
      risks,
      recommendations
    };
  }

  private calculateTeamPerformanceMetrics(
    tasks: any[],
    teamMembers: any[],
    period: DateRange
  ): TeamPerformance {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasks = tasks.length;

    const avgCompletionTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const time = t.completedAt
            ? differenceInHours(t.completedAt, t.createdAt)
            : 0;
          return sum + time;
        }, 0) / completedTasks.length
      : 0;

    const onTimeTasks = completedTasks.filter(t =>
      t.completedAt && t.completedAt <= t.dueDate
    );
    const onTimeDeliveryRate = completedTasks.length > 0
      ? (onTimeTasks.length / completedTasks.length) * 100
      : 0;

    // Calculate member performance
    const memberPerformance: MemberPerformance[] = teamMembers.map(member => {
      const memberTasks = tasks.filter(t => t.assigneeId === member.id);
      const memberCompleted = memberTasks.filter(t => t.status === 'completed');

      const memberAvgTime = memberCompleted.length > 0
        ? memberCompleted.reduce((sum, t) => {
            const time = t.completedAt
              ? differenceInHours(t.completedAt, t.createdAt)
              : 0;
            return sum + time;
          }, 0) / memberCompleted.length
        : 0;

      const efficiency = member.maxConcurrent > 0
        ? (memberCompleted.length / member.maxConcurrent) * 100
        : 0;

      return {
        memberId: member.id,
        name: member.name,
        metrics: {
          tasksCompleted: memberCompleted.length,
          tasksAssigned: memberTasks.length,
          completionRate: memberTasks.length > 0
            ? (memberCompleted.length / memberTasks.length) * 100
            : 0,
          averageTime: memberAvgTime,
          efficiency,
          qualityScore: 95 // Placeholder - would calculate based on rework, errors, etc.
        }
      };
    });

    // Calculate trends (simplified)
    const productivityTrend: TrendData = {
      metric: 'productivity',
      period,
      dataPoints: [],
      trend: 'stable',
      changePercentage: 0
    };

    const efficiencyTrend: TrendData = {
      metric: 'efficiency',
      period,
      dataPoints: [],
      trend: 'stable',
      changePercentage: 0
    };

    const workloadTrend: TrendData = {
      metric: 'workload',
      period,
      dataPoints: [],
      trend: 'stable',
      changePercentage: 0
    };

    return {
      period,
      metrics: {
        tasksCompleted: completedTasks.length,
        averageCompletionTime: avgCompletionTime,
        onTimeDeliveryRate,
        productivityScore: 85, // Placeholder calculation
        capacityUtilization: 75 // Placeholder calculation
      },
      memberPerformance,
      trends: {
        productivity: productivityTrend,
        efficiency: efficiencyTrend,
        workload: workloadTrend
      }
    };
  }

  private async assessScheduleRisks(): Promise<RiskIndicator[]> {
    const risks: RiskIndicator[] = [];
    const now = new Date();

    // Find overdue campaigns
    const overdueCampaigns = await this.prisma.campaign.findMany({
      where: {
        targetDate: { lt: now },
        status: { notIn: ['completed', 'cancelled'] }
      }
    });

    if (overdueCampaigns.length > 0) {
      risks.push({
        type: 'schedule',
        severity: overdueCampaigns.length > 5 ? 'critical' : 'high',
        description: `${overdueCampaigns.length} campaigns are past their target date`,
        affectedItems: overdueCampaigns.map(c => c.id),
        mitigationSteps: [
          'Review and update campaign timelines',
          'Reassign resources to critical campaigns',
          'Consider extending deadlines or reducing scope'
        ],
        probability: 1.0,
        impact: 0.8,
        riskScore: 0.8
      });
    }

    // Find tasks at risk
    const tasksAtRisk = await this.prisma.task.count({
      where: {
        dueDate: {
          gte: now,
          lte: addDays(now, 3)
        },
        status: { notIn: ['completed', 'cancelled'] }
      }
    });

    if (tasksAtRisk > 10) {
      risks.push({
        type: 'schedule',
        severity: 'medium',
        description: `${tasksAtRisk} tasks due in next 3 days`,
        affectedItems: [],
        mitigationSteps: [
          'Prioritize critical tasks',
          'Allocate additional resources',
          'Consider task delegation'
        ],
        probability: 0.7,
        impact: 0.6,
        riskScore: 0.42
      });
    }

    return risks;
  }

  private async assessResourceRisks(): Promise<RiskIndicator[]> {
    const risks: RiskIndicator[] = [];

    // Find overloaded team members
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { isActive: true },
      include: {
        tasks: {
          where: {
            status: { notIn: ['completed', 'cancelled'] }
          }
        }
      }
    });

    const overloaded = teamMembers.filter(m =>
      m.tasks.length >= m.maxConcurrent
    );

    if (overloaded.length > 0) {
      risks.push({
        type: 'resource',
        severity: overloaded.length > 3 ? 'high' : 'medium',
        description: `${overloaded.length} team members at or over capacity`,
        affectedItems: overloaded.map(m => m.id),
        mitigationSteps: [
          'Redistribute workload',
          'Hire additional resources',
          'Postpone non-critical tasks'
        ],
        probability: 0.9,
        impact: 0.7,
        riskScore: 0.63
      });
    }

    return risks;
  }

  private async assessApprovalRisks(): Promise<RiskIndicator[]> {
    const risks: RiskIndicator[] = [];
    const now = new Date();

    // Find overdue approvals
    const overdueApprovals = await this.prisma.approval.findMany({
      where: {
        status: 'pending',
        dueDate: { lt: now }
      },
      include: {
        campaign: true
      }
    });

    if (overdueApprovals.length > 0) {
      const criticalApprovals = overdueApprovals.filter(a =>
        a.urgency === 'critical' || a.urgency === 'high'
      );

      risks.push({
        type: 'approval',
        severity: criticalApprovals.length > 0 ? 'critical' : 'high',
        description: `${overdueApprovals.length} approvals are overdue`,
        affectedItems: overdueApprovals.map(a => a.campaignId),
        mitigationSteps: [
          'Escalate to management',
          'Send reminder notifications',
          'Consider auto-approval for low-risk items'
        ],
        probability: 1.0,
        impact: 0.8,
        riskScore: 0.8
      });
    }

    return risks;
  }

  private async assessQualityRisks(): Promise<RiskIndicator[]> {
    const risks: RiskIndicator[] = [];

    // Check for high task failure/rework rate
    const recentTasks = await this.prisma.task.findMany({
      where: {
        updatedAt: {
          gte: subDays(new Date(), 7)
        }
      }
    });

    const blockedTasks = recentTasks.filter(t => t.status === 'blocked');
    const blockRate = recentTasks.length > 0
      ? (blockedTasks.length / recentTasks.length) * 100
      : 0;

    if (blockRate > 20) {
      risks.push({
        type: 'quality',
        severity: blockRate > 30 ? 'high' : 'medium',
        description: `High task blockage rate (${blockRate.toFixed(1)}%)`,
        affectedItems: blockedTasks.map(t => t.id),
        mitigationSteps: [
          'Review blocked task reasons',
          'Improve task requirements clarity',
          'Enhance team training'
        ],
        probability: 0.8,
        impact: 0.6,
        riskScore: 0.48
      });
    }

    return risks;
  }

  private async assessCampaignRisks(campaign: any): Promise<RiskIndicator[]> {
    const risks: RiskIndicator[] = [];
    const now = new Date();

    // Schedule risk
    if (campaign.targetDate < now && campaign.status !== 'completed') {
      risks.push({
        type: 'schedule',
        severity: 'high',
        description: 'Campaign is past target date',
        affectedItems: [campaign.id],
        probability: 1.0,
        impact: 0.8,
        riskScore: 0.8
      });
    }

    // Resource risk
    const taskCount = campaign.tasks?.length || 0;
    const teamSize = campaign.team?.length || 0;
    if (teamSize > 0 && taskCount / teamSize > 10) {
      risks.push({
        type: 'resource',
        severity: 'medium',
        description: 'High task-to-team ratio',
        affectedItems: [campaign.id],
        probability: 0.7,
        impact: 0.6,
        riskScore: 0.42
      });
    }

    return risks;
  }

  private generateCampaignRecommendations(
    campaign: any,
    metrics: any
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.overdueTasks.length > 0) {
      recommendations.push('Address overdue tasks immediately');
    }

    if (metrics.efficiency < 70) {
      recommendations.push('Review resource allocation for better efficiency');
    }

    if (campaign.readinessScore < 50) {
      recommendations.push('Focus on improving campaign readiness score');
    }

    if (!campaign.timeline) {
      recommendations.push('Create a timeline for better tracking');
    }

    return recommendations;
  }

  private estimateCompletionDate(campaign: any, tasks: any[]): Date {
    const incompleteTasks = tasks.filter((t: any) => t.status !== 'completed');
    const avgCompletionTime = 24; // hours (simplified)
    const estimatedHours = incompleteTasks.length * avgCompletionTime;
    return addDays(new Date(), Math.ceil(estimatedHours / 24));
  }

  private async collectTrendData(metric: string, period: DateRange): Promise<DataPoint[]> {
    const dataPoints: DataPoint[] = [];
    const days = differenceInDays(period.endDate, period.startDate);

    for (let i = 0; i <= days; i++) {
      const date = addDays(period.startDate, i);
      const startOfDate = startOfDay(date);
      const endOfDate = endOfDay(date);

      let value = 0;

      switch (metric) {
        case 'task_completion':
          value = await this.prisma.task.count({
            where: {
              status: 'completed',
              completedAt: {
                gte: startOfDate,
                lte: endOfDate
              }
            }
          });
          break;

        case 'campaign_progress':
          const campaigns = await this.prisma.campaign.findMany({
            where: {
              updatedAt: {
                gte: startOfDate,
                lte: endOfDate
              }
            }
          });
          value = campaigns.reduce((sum, c) => sum + (c.readinessScore || 0), 0) / (campaigns.length || 1);
          break;
      }

      dataPoints.push({
        timestamp: date,
        value,
        label: format(date, 'MMM dd')
      });
    }

    return dataPoints;
  }

  private analyzeTrend(dataPoints: DataPoint[]): 'increasing' | 'decreasing' | 'stable' {
    if (dataPoints.length < 2) return 'stable';

    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateChangePercentage(dataPoints: DataPoint[]): number {
    if (dataPoints.length < 2) return 0;

    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;

    if (first === 0) return last > 0 ? 100 : 0;
    return ((last - first) / first) * 100;
  }

  private forecastTrend(dataPoints: DataPoint[], days: number): DataPoint[] {
    if (dataPoints.length < 3) return [];

    // Simple linear regression for forecast
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
    const sumY = dataPoints.reduce((sum, p) => sum + p.value, 0);
    const sumXY = dataPoints.reduce((sum, p, i) => sum + (i * p.value), 0);
    const sumX2 = dataPoints.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast: DataPoint[] = [];
    const lastDate = dataPoints[dataPoints.length - 1].timestamp;

    for (let i = 1; i <= days; i++) {
      const forecastDate = addDays(lastDate, i);
      const forecastValue = Math.max(0, slope * (n + i - 1) + intercept);

      forecast.push({
        timestamp: forecastDate,
        value: forecastValue,
        label: format(forecastDate, 'MMM dd')
      });
    }

    return forecast;
  }

  private async getSystemHealth(): Promise<SystemHealthStatus> {
    const services: ServiceStatus[] = [];

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({
        name: 'PostgreSQL',
        status: 'up',
        responseTime: 5
      });
    } catch (error) {
      services.push({
        name: 'PostgreSQL',
        status: 'down',
        details: 'Database connection failed'
      });
    }

    // Check Redis
    try {
      await this.cache.get('health:check');
      services.push({
        name: 'Redis',
        status: 'up',
        responseTime: 2
      });
    } catch (error) {
      services.push({
        name: 'Redis',
        status: 'down',
        details: 'Cache connection failed'
      });
    }

    const allHealthy = services.every(s => s.status === 'up');
    const anyDown = services.some(s => s.status === 'down');

    return {
      status: anyDown ? 'critical' : allHealthy ? 'healthy' : 'warning',
      services,
      lastCheck: new Date()
    };
  }
}