import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/services/cache/cache.service';
import { logger } from '@/utils/logger';
import {
  AnalyticsQuery,
  MetricDefinition,
  DashboardExport,
  ExportOptions,
  DateRange,
  DashboardFilters
} from '@/types/dashboard.types';
import { subDays, format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';

export class AnalyticsService {
  private metrics: Map<string, MetricDefinition>;

  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): Map<string, MetricDefinition> {
    const metrics = new Map<string, MetricDefinition>();

    // Campaign metrics
    metrics.set('campaign_count', {
      id: 'campaign_count',
      name: 'Total Campaigns',
      category: 'campaign',
      calculation: 'COUNT(*)',
      description: 'Total number of campaigns'
    });

    metrics.set('campaign_completion_rate', {
      id: 'campaign_completion_rate',
      name: 'Campaign Completion Rate',
      category: 'campaign',
      calculation: 'COUNT(CASE WHEN status = "completed" THEN 1 END) / COUNT(*) * 100',
      unit: '%',
      description: 'Percentage of campaigns completed'
    });

    metrics.set('campaign_success_rate', {
      id: 'campaign_success_rate',
      name: 'Campaign Success Rate',
      category: 'campaign',
      calculation: 'COUNT(CASE WHEN readinessScore >= 80 THEN 1 END) / COUNT(*) * 100',
      unit: '%',
      description: 'Percentage of campaigns with high readiness scores'
    });

    // Task metrics
    metrics.set('task_count', {
      id: 'task_count',
      name: 'Total Tasks',
      category: 'task',
      calculation: 'COUNT(*)',
      description: 'Total number of tasks'
    });

    metrics.set('task_completion_rate', {
      id: 'task_completion_rate',
      name: 'Task Completion Rate',
      category: 'task',
      calculation: 'COUNT(CASE WHEN status = "completed" THEN 1 END) / COUNT(*) * 100',
      unit: '%',
      description: 'Percentage of tasks completed'
    });

    metrics.set('task_overdue_rate', {
      id: 'task_overdue_rate',
      name: 'Task Overdue Rate',
      category: 'task',
      calculation: 'COUNT(CASE WHEN dueDate < NOW() AND status != "completed" THEN 1 END) / COUNT(*) * 100',
      unit: '%',
      description: 'Percentage of tasks overdue'
    });

    // Team metrics
    metrics.set('team_utilization', {
      id: 'team_utilization',
      name: 'Team Utilization',
      category: 'team',
      calculation: 'AVG(current_tasks / max_concurrent) * 100',
      unit: '%',
      description: 'Average team member utilization'
    });

    metrics.set('team_productivity', {
      id: 'team_productivity',
      name: 'Team Productivity',
      category: 'team',
      calculation: 'COUNT(completed_tasks) / COUNT(DISTINCT member_id) / days',
      unit: 'tasks/person/day',
      description: 'Average tasks completed per person per day'
    });

    // Performance metrics
    metrics.set('avg_campaign_duration', {
      id: 'avg_campaign_duration',
      name: 'Average Campaign Duration',
      category: 'performance',
      calculation: 'AVG(DATEDIFF(completedAt, createdAt))',
      unit: 'days',
      description: 'Average time to complete a campaign'
    });

    metrics.set('avg_task_completion_time', {
      id: 'avg_task_completion_time',
      name: 'Average Task Completion Time',
      category: 'performance',
      calculation: 'AVG(DATEDIFF(completedAt, createdAt))',
      unit: 'hours',
      description: 'Average time to complete a task'
    });

    metrics.set('approval_speed', {
      id: 'approval_speed',
      name: 'Approval Speed',
      category: 'performance',
      calculation: 'AVG(DATEDIFF(decidedAt, createdAt))',
      unit: 'hours',
      description: 'Average time to process approvals'
    });

    return metrics;
  }

  async queryMetrics(query: AnalyticsQuery): Promise<any> {
    try {
      logger.info('Executing analytics query', { query });

      const results: any = {};

      for (const metricId of query.metrics) {
        const metric = this.metrics.get(metricId);
        if (!metric) {
          logger.warn(`Unknown metric: ${metricId}`);
          continue;
        }

        const value = await this.calculateMetric(metric, query.filters);
        results[metricId] = {
          value,
          metric
        };
      }

      if (query.groupBy?.length) {
        return this.groupResults(results, query.groupBy);
      }

      return results;

    } catch (error) {
      logger.error('Error executing analytics query', { query, error });
      throw error;
    }
  }

  async exportDashboard(options: ExportOptions): Promise<DashboardExport> {
    try {
      logger.info('Exporting dashboard', { options });

      const data = await this.collectExportData(options);

      let exportBuffer: Buffer;
      let mimeType: string;
      let filename: string;

      switch (options.format) {
        case 'json':
          exportBuffer = Buffer.from(JSON.stringify(data, null, 2));
          mimeType = 'application/json';
          filename = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
          break;

        case 'csv':
          exportBuffer = await this.generateCSV(data);
          mimeType = 'text/csv';
          filename = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          break;

        case 'pdf':
          exportBuffer = await this.generatePDF(data, options);
          mimeType = 'application/pdf';
          filename = `dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
          break;

        case 'excel':
          exportBuffer = await this.generateExcel(data);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
          break;

        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      return {
        generatedAt: new Date(),
        format: options.format,
        data: exportBuffer,
        filename,
        mimeType
      };

    } catch (error) {
      logger.error('Error exporting dashboard', { options, error });
      throw error;
    }
  }

  async getComparativeAnalytics(
    metric: string,
    periods: DateRange[]
  ): Promise<any> {
    try {
      const results = [];

      for (const period of periods) {
        const value = await this.getMetricForPeriod(metric, period);
        results.push({
          period,
          value,
          label: this.formatPeriodLabel(period)
        });
      }

      const comparison = this.calculateComparison(results);
      return {
        metric,
        periods: results,
        comparison
      };

    } catch (error) {
      logger.error('Error generating comparative analytics', { metric, periods, error });
      throw error;
    }
  }

  async getFunnelAnalytics(stages: string[]): Promise<any> {
    try {
      const funnel = [];

      for (const stage of stages) {
        const count = await this.getStageCount(stage);
        funnel.push({
          stage,
          count,
          conversionRate: funnel.length > 0
            ? (count / funnel[0].count) * 100
            : 100
        });
      }

      return {
        stages: funnel,
        overallConversion: funnel.length > 0
          ? (funnel[funnel.length - 1].count / funnel[0].count) * 100
          : 0
      };

    } catch (error) {
      logger.error('Error generating funnel analytics', { stages, error });
      throw error;
    }
  }

  async getCohortAnalysis(
    cohortField: string,
    metricField: string,
    periods: number = 12
  ): Promise<any> {
    try {
      const cohorts = [];
      const now = new Date();

      for (let i = periods - 1; i >= 0; i--) {
        const cohortStart = startOfMonth(subDays(now, i * 30));
        const cohortEnd = endOfMonth(subDays(now, i * 30));

        const cohortData = await this.getCohortData(
          cohortField,
          metricField,
          cohortStart,
          cohortEnd
        );

        cohorts.push({
          period: format(cohortStart, 'MMM yyyy'),
          start: cohortStart,
          end: cohortEnd,
          data: cohortData
        });
      }

      return {
        cohortField,
        metricField,
        cohorts,
        analysis: this.analyzeCohorts(cohorts)
      };

    } catch (error) {
      logger.error('Error generating cohort analysis', { cohortField, metricField, error });
      throw error;
    }
  }

  async getCorrelationAnalysis(
    metric1: string,
    metric2: string,
    period: DateRange
  ): Promise<any> {
    try {
      const data1 = await this.getMetricTimeSeries(metric1, period);
      const data2 = await this.getMetricTimeSeries(metric2, period);

      const correlation = this.calculateCorrelation(data1, data2);
      const regression = this.calculateRegression(data1, data2);

      return {
        metric1,
        metric2,
        period,
        correlation,
        regression,
        interpretation: this.interpretCorrelation(correlation)
      };

    } catch (error) {
      logger.error('Error generating correlation analysis', { metric1, metric2, period, error });
      throw error;
    }
  }

  // Private helper methods

  private async calculateMetric(metric: MetricDefinition, filters?: DashboardFilters): Promise<number> {
    let result = 0;

    switch (metric.category) {
      case 'campaign':
        result = await this.calculateCampaignMetric(metric, filters);
        break;
      case 'task':
        result = await this.calculateTaskMetric(metric, filters);
        break;
      case 'team':
        result = await this.calculateTeamMetric(metric, filters);
        break;
      case 'performance':
        result = await this.calculatePerformanceMetric(metric, filters);
        break;
    }

    return result;
  }

  private async calculateCampaignMetric(metric: MetricDefinition, filters?: DashboardFilters): Promise<number> {
    const where = this.buildWhereClause('campaign', filters);

    switch (metric.id) {
      case 'campaign_count':
        return await this.prisma.campaign.count({ where });

      case 'campaign_completion_rate':
        const total = await this.prisma.campaign.count({ where });
        const completed = await this.prisma.campaign.count({
          where: { ...where, status: 'completed' }
        });
        return total > 0 ? (completed / total) * 100 : 0;

      case 'campaign_success_rate':
        const allCampaigns = await this.prisma.campaign.count({ where });
        const successful = await this.prisma.campaign.count({
          where: { ...where, readinessScore: { gte: 80 } }
        });
        return allCampaigns > 0 ? (successful / allCampaigns) * 100 : 0;

      default:
        return 0;
    }
  }

  private async calculateTaskMetric(metric: MetricDefinition, filters?: DashboardFilters): Promise<number> {
    const where = this.buildWhereClause('task', filters);

    switch (metric.id) {
      case 'task_count':
        return await this.prisma.task.count({ where });

      case 'task_completion_rate':
        const total = await this.prisma.task.count({ where });
        const completed = await this.prisma.task.count({
          where: { ...where, status: 'completed' }
        });
        return total > 0 ? (completed / total) * 100 : 0;

      case 'task_overdue_rate':
        const allTasks = await this.prisma.task.count({ where });
        const overdue = await this.prisma.task.count({
          where: {
            ...where,
            dueDate: { lt: new Date() },
            status: { notIn: ['completed', 'cancelled'] }
          }
        });
        return allTasks > 0 ? (overdue / allTasks) * 100 : 0;

      default:
        return 0;
    }
  }

  private async calculateTeamMetric(metric: MetricDefinition, filters?: DashboardFilters): Promise<number> {
    switch (metric.id) {
      case 'team_utilization':
        const members = await this.prisma.teamMember.findMany({
          where: { isActive: true },
          include: {
            tasks: {
              where: { status: { notIn: ['completed', 'cancelled'] } }
            }
          }
        });

        if (members.length === 0) return 0;

        const utilizations = members.map(m => {
          const currentTasks = m.tasks.length;
          return m.maxConcurrent > 0 ? (currentTasks / m.maxConcurrent) * 100 : 0;
        });

        return utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;

      case 'team_productivity':
        const period = filters?.dateRange || {
          startDate: subDays(new Date(), 30),
          endDate: new Date()
        };

        const completedTasks = await this.prisma.task.count({
          where: {
            status: 'completed',
            completedAt: {
              gte: period.startDate,
              lte: period.endDate
            }
          }
        });

        const activeMembers = await this.prisma.teamMember.count({
          where: { isActive: true }
        });

        const days = Math.max(1, Math.ceil(
          (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)
        ));

        return activeMembers > 0 ? completedTasks / activeMembers / days : 0;

      default:
        return 0;
    }
  }

  private async calculatePerformanceMetric(metric: MetricDefinition, filters?: DashboardFilters): Promise<number> {
    const where = this.buildWhereClause('campaign', filters);

    switch (metric.id) {
      case 'avg_campaign_duration':
        const completedCampaigns = await this.prisma.campaign.findMany({
          where: { ...where, status: 'completed' },
          select: { createdAt: true, updatedAt: true }
        });

        if (completedCampaigns.length === 0) return 0;

        const durations = completedCampaigns.map(c => {
          return (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        });

        return durations.reduce((sum, d) => sum + d, 0) / durations.length;

      case 'avg_task_completion_time':
        const completedTasks = await this.prisma.task.findMany({
          where: { status: 'completed', completedAt: { not: null } },
          select: { createdAt: true, completedAt: true }
        });

        if (completedTasks.length === 0) return 0;

        const times = completedTasks.map(t => {
          return (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        });

        return times.reduce((sum, t) => sum + t, 0) / times.length;

      case 'approval_speed':
        const decidedApprovals = await this.prisma.approval.findMany({
          where: { status: { in: ['approved', 'rejected'] }, decidedAt: { not: null } },
          select: { createdAt: true, decidedAt: true }
        });

        if (decidedApprovals.length === 0) return 0;

        const speeds = decidedApprovals.map(a => {
          return (a.decidedAt!.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60);
        });

        return speeds.reduce((sum, s) => sum + s, 0) / speeds.length;

      default:
        return 0;
    }
  }

  private buildWhereClause(entity: string, filters?: DashboardFilters): any {
    const where: any = {};

    if (!filters) return where;

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.startDate,
        lte: filters.dateRange.endDate
      };
    }

    if (entity === 'campaign') {
      if (filters.campaignTypes?.length) {
        where.type = { in: filters.campaignTypes };
      }
      if (filters.priorities?.length) {
        where.priority = { in: filters.priorities };
      }
      if (filters.statuses?.length) {
        where.status = { in: filters.statuses };
      }
    }

    if (entity === 'task') {
      if (filters.priorities?.length) {
        where.priority = { in: filters.priorities };
      }
      if (filters.teamMembers?.length) {
        where.assigneeId = { in: filters.teamMembers };
      }
    }

    return where;
  }

  private groupResults(results: any, groupBy: string[]): any {
    // Simplified grouping logic
    return results;
  }

  private async collectExportData(options: ExportOptions): Promise<any> {
    const data: any = {
      generatedAt: new Date(),
      period: options.dateRange
    };

    if (options.sections.includes('overview')) {
      const dashboardService = new (require('./dashboard.service').DashboardService)(
        this.prisma,
        this.cache
      );
      data.overview = await dashboardService.getOverviewMetrics({ dateRange: options.dateRange });
    }

    if (options.sections.includes('campaigns')) {
      data.campaigns = await this.prisma.campaign.findMany({
        where: this.buildWhereClause('campaign', { dateRange: options.dateRange })
      });
    }

    if (options.sections.includes('tasks')) {
      data.tasks = await this.prisma.task.findMany({
        where: this.buildWhereClause('task', { dateRange: options.dateRange })
      });
    }

    if (options.sections.includes('team')) {
      data.team = await this.prisma.teamMember.findMany({
        where: { isActive: true }
      });
    }

    return data;
  }

  private async generateCSV(data: any): Promise<Buffer> {
    const rows: string[] = [];

    // Header
    rows.push('Category,Metric,Value,Unit');

    // Overview metrics
    if (data.overview) {
      rows.push(`Campaigns,Total,${data.overview.totalCampaigns},count`);
      rows.push(`Campaigns,Active,${data.overview.activeCampaigns},count`);
      rows.push(`Tasks,Total,${data.overview.totalTasks},count`);
      rows.push(`Tasks,Overdue,${data.overview.overdueTasks},count`);
      rows.push(`Team,Utilization,${data.overview.teamUtilization.toFixed(1)},%`);
    }

    return Buffer.from(rows.join('\n'));
  }

  private async generatePDF(data: any, options: ExportOptions): Promise<Buffer> {
    // Simplified PDF generation - would use a library like pdfkit
    const content = JSON.stringify(data, null, 2);
    return Buffer.from(content);
  }

  private async generateExcel(data: any): Promise<Buffer> {
    // Simplified Excel generation - would use a library like exceljs
    const content = JSON.stringify(data, null, 2);
    return Buffer.from(content);
  }

  private async getMetricForPeriod(metric: string, period: DateRange): Promise<number> {
    const metricDef = this.metrics.get(metric);
    if (!metricDef) return 0;

    return await this.calculateMetric(metricDef, { dateRange: period });
  }

  private formatPeriodLabel(period: DateRange): string {
    return `${format(period.startDate, 'MMM dd')} - ${format(period.endDate, 'MMM dd')}`;
  }

  private calculateComparison(results: any[]): any {
    if (results.length < 2) return null;

    const current = results[results.length - 1].value;
    const previous = results[results.length - 2].value;
    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

    return {
      current,
      previous,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  }

  private async getStageCount(stage: string): Promise<number> {
    return await this.prisma.campaign.count({
      where: { status: stage }
    });
  }

  private async getCohortData(
    cohortField: string,
    metricField: string,
    start: Date,
    end: Date
  ): Promise<any> {
    // Simplified cohort data collection
    return {
      size: 0,
      retention: []
    };
  }

  private analyzeCohorts(cohorts: any[]): any {
    // Simplified cohort analysis
    return {
      averageRetention: 0,
      trend: 'stable'
    };
  }

  private async getMetricTimeSeries(metric: string, period: DateRange): Promise<number[]> {
    // Simplified time series data collection
    return [];
  }

  private calculateCorrelation(data1: number[], data2: number[]): number {
    if (data1.length !== data2.length || data1.length === 0) return 0;

    const n = data1.length;
    const sum1 = data1.reduce((a, b) => a + b, 0);
    const sum2 = data2.reduce((a, b) => a + b, 0);
    const sum1Sq = data1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = data2.reduce((a, b) => a + b * b, 0);
    const pSum = data1.reduce((a, b, i) => a + b * data2[i], 0);

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    return den === 0 ? 0 : num / den;
  }

  private calculateRegression(data1: number[], data2: number[]): any {
    // Simplified linear regression
    return {
      slope: 0,
      intercept: 0,
      r2: 0
    };
  }

  private interpretCorrelation(correlation: number): string {
    const abs = Math.abs(correlation);
    if (abs > 0.9) return 'Very strong correlation';
    if (abs > 0.7) return 'Strong correlation';
    if (abs > 0.5) return 'Moderate correlation';
    if (abs > 0.3) return 'Weak correlation';
    return 'No significant correlation';
  }
}