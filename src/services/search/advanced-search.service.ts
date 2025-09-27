import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

export interface SearchFilters {
  query?: string;
  status?: string[];
  priority?: string[];
  assigneeEmails?: string[];
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  dueBefore?: Date;
  dueAfter?: Date;
  budgetMin?: number;
  budgetMax?: number;
  hasOverdueTasks?: boolean;
  hasPendingApprovals?: boolean;
  campaignIds?: string[];
  excludeIds?: string[];
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchResults<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  facets: {
    statuses: Array<{ value: string; count: number }>;
    priorities: Array<{ value: string; count: number }>;
    assignees: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  };
}

export interface CampaignSearchResult {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  assigneeEmail: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  _count: {
    tasks: number;
    approvals: number;
  };
  metrics?: {
    completedTasks: number;
    overdueTasks: number;
    pendingApprovals: number;
    progressPercentage: number;
  };
}

export interface TaskSearchResult {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate: Date;
  assigneeEmail: string;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  dependencies?: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

export interface ApprovalSearchResult {
  id: string;
  stage: string;
  status: string;
  urgency: string;
  approverEmail: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  campaign: {
    id: string;
    name: string;
    status: string;
  };
}

export class AdvancedSearchService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Campaign Search
  async searchCampaigns(
    filters: SearchFilters,
    sort: SortOptions = { field: 'createdAt', direction: 'desc' },
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResults<CampaignSearchResult>> {
    logger.info('Searching campaigns', { filters, sort, page, limit });

    const where: any = {};
    const skip = (page - 1) * limit;

    // Build where clause
    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } }
      ];
    }

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }

    if (filters.assigneeEmails?.length) {
      where.assigneeEmail = { in: filters.assigneeEmails };
    }

    if (filters.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.budgetMin !== undefined || filters.budgetMax !== undefined) {
      where.budget = {};
      if (filters.budgetMin !== undefined) where.budget.gte = filters.budgetMin;
      if (filters.budgetMax !== undefined) where.budget.lte = filters.budgetMax;
    }

    if (filters.campaignIds?.length) {
      where.id = { in: filters.campaignIds };
    }

    if (filters.excludeIds?.length) {
      where.id = { notIn: filters.excludeIds };
    }

    // Handle complex filters
    if (filters.hasOverdueTasks) {
      where.tasks = {
        some: {
          status: { not: 'completed' },
          dueDate: { lt: new Date() }
        }
      };
    }

    if (filters.hasPendingApprovals) {
      where.approvals = {
        some: {
          status: 'pending'
        }
      };
    }

    // Get total count
    const total = await this.prisma.campaign.count({ where });

    // Build sort
    const orderBy: any = {};
    orderBy[sort.field] = sort.direction;

    // Execute search
    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: {
        _count: {
          select: {
            tasks: true,
            approvals: true
          }
        },
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true
          }
        },
        approvals: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    });

    // Calculate metrics for each campaign
    const campaignResults: CampaignSearchResult[] = campaigns.map(campaign => {
      const completedTasks = campaign.tasks.filter(t => t.status === 'completed').length;
      const overdueTasks = campaign.tasks.filter(t =>
        t.status !== 'completed' && t.dueDate && t.dueDate < new Date()
      ).length;
      const pendingApprovals = campaign.approvals.filter(a => a.status === 'pending').length;
      const progressPercentage = campaign.tasks.length > 0 ?
        Math.round((completedTasks / campaign.tasks.length) * 100) : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        priority: campaign.priority,
        budget: campaign.budget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        assigneeEmail: campaign.assigneeEmail,
        tags: campaign.tags,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        _count: campaign._count,
        metrics: {
          completedTasks,
          overdueTasks,
          pendingApprovals,
          progressPercentage
        }
      };
    });

    // Generate facets
    const facets = await this.generateCampaignFacets(where);

    return {
      items: campaignResults,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets
    };
  }

  // Task Search
  async searchTasks(
    filters: SearchFilters,
    sort: SortOptions = { field: 'dueDate', direction: 'asc' },
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResults<TaskSearchResult>> {
    logger.info('Searching tasks', { filters, sort, page, limit });

    const where: any = {};
    const skip = (page - 1) * limit;

    // Build where clause
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } }
      ];
    }

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }

    if (filters.assigneeEmails?.length) {
      where.assigneeEmail = { in: filters.assigneeEmails };
    }

    if (filters.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.dueAfter || filters.dueBefore) {
      where.dueDate = {};
      if (filters.dueAfter) where.dueDate.gte = filters.dueAfter;
      if (filters.dueBefore) where.dueDate.lte = filters.dueBefore;
    }

    if (filters.campaignIds?.length) {
      where.campaignId = { in: filters.campaignIds };
    }

    if (filters.excludeIds?.length) {
      where.id = { notIn: filters.excludeIds };
    }

    // Get total count
    const total = await this.prisma.task.count({ where });

    // Build sort
    const orderBy: any = {};
    orderBy[sort.field] = sort.direction;

    // Execute search
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        dependencies: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    });

    // Generate facets
    const facets = await this.generateTaskFacets(where);

    return {
      items: tasks,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets
    };
  }

  // Approval Search
  async searchApprovals(
    filters: SearchFilters,
    sort: SortOptions = { field: 'dueDate', direction: 'asc' },
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResults<ApprovalSearchResult>> {
    logger.info('Searching approvals', { filters, sort, page, limit });

    const where: any = {};
    const skip = (page - 1) * limit;

    // Build where clause
    if (filters.query) {
      where.stage = { contains: filters.query, mode: 'insensitive' };
    }

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.assigneeEmails?.length) {
      where.approverEmail = { in: filters.assigneeEmails };
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.dueAfter || filters.dueBefore) {
      where.dueDate = {};
      if (filters.dueAfter) where.dueDate.gte = filters.dueAfter;
      if (filters.dueBefore) where.dueDate.lte = filters.dueBefore;
    }

    if (filters.campaignIds?.length) {
      where.campaignId = { in: filters.campaignIds };
    }

    if (filters.excludeIds?.length) {
      where.id = { notIn: filters.excludeIds };
    }

    // Get total count
    const total = await this.prisma.approval.count({ where });

    // Build sort
    const orderBy: any = {};
    orderBy[sort.field] = sort.direction;

    // Execute search
    const approvals = await this.prisma.approval.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    });

    // Generate facets
    const facets = await this.generateApprovalFacets(where);

    return {
      items: approvals,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets
    };
  }

  // Global Search (across all entities)
  async globalSearch(
    query: string,
    entityTypes: Array<'campaign' | 'task' | 'approval'> = ['campaign', 'task', 'approval'],
    limit: number = 10
  ): Promise<{
    campaigns: CampaignSearchResult[];
    tasks: TaskSearchResult[];
    approvals: ApprovalSearchResult[];
    total: number;
  }> {
    logger.info('Performing global search', { query, entityTypes, limit });

    const results = {
      campaigns: [] as CampaignSearchResult[],
      tasks: [] as TaskSearchResult[],
      approvals: [] as ApprovalSearchResult[],
      total: 0
    };

    const searchFilters: SearchFilters = { query };

    if (entityTypes.includes('campaign')) {
      const campaignResults = await this.searchCampaigns(searchFilters, { field: 'updatedAt', direction: 'desc' }, 1, limit);
      results.campaigns = campaignResults.items;
      results.total += campaignResults.total;
    }

    if (entityTypes.includes('task')) {
      const taskResults = await this.searchTasks(searchFilters, { field: 'updatedAt', direction: 'desc' }, 1, limit);
      results.tasks = taskResults.items;
      results.total += taskResults.total;
    }

    if (entityTypes.includes('approval')) {
      const approvalResults = await this.searchApprovals(searchFilters, { field: 'updatedAt', direction: 'desc' }, 1, limit);
      results.approvals = approvalResults.items;
      results.total += approvalResults.total;
    }

    return results;
  }

  // Saved Searches
  async saveSearch(
    name: string,
    entityType: 'campaign' | 'task' | 'approval',
    filters: SearchFilters,
    sort: SortOptions,
    userId: string
  ): Promise<{ id: string; name: string }> {
    logger.info('Saving search', { name, entityType, userId });

    const savedSearch = await this.prisma.savedSearch.create({
      data: {
        name,
        entityType,
        filters: JSON.stringify(filters),
        sort: JSON.stringify(sort),
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return {
      id: savedSearch.id,
      name: savedSearch.name
    };
  }

  async getSavedSearches(userId: string): Promise<Array<{
    id: string;
    name: string;
    entityType: string;
    createdAt: Date;
  }>> {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        entityType: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async executeSavedSearch(searchId: string, page: number = 1, limit: number = 20): Promise<any> {
    const savedSearch = await this.prisma.savedSearch.findUnique({
      where: { id: searchId }
    });

    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    const filters = JSON.parse(savedSearch.filters);
    const sort = JSON.parse(savedSearch.sort);

    switch (savedSearch.entityType) {
      case 'campaign':
        return this.searchCampaigns(filters, sort, page, limit);
      case 'task':
        return this.searchTasks(filters, sort, page, limit);
      case 'approval':
        return this.searchApprovals(filters, sort, page, limit);
      default:
        throw new Error(`Invalid entity type: ${savedSearch.entityType}`);
    }
  }

  // Private helper methods for facet generation
  private async generateCampaignFacets(baseWhere: any): Promise<any> {
    const [statuses, priorities, assignees, tags] = await Promise.all([
      this.prisma.campaign.groupBy({
        by: ['status'],
        _count: { status: true },
        where: baseWhere
      }),
      this.prisma.campaign.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where: baseWhere
      }),
      this.prisma.campaign.groupBy({
        by: ['assigneeEmail'],
        _count: { assigneeEmail: true },
        where: baseWhere
      }),
      this.prisma.$queryRaw`
        SELECT unnest(tags) as tag, COUNT(*) as count
        FROM "Campaign"
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 20
      `
    ]);

    return {
      statuses: statuses.map(s => ({ value: s.status, count: s._count.status })),
      priorities: priorities.map(p => ({ value: p.priority, count: p._count.priority })),
      assignees: assignees.map(a => ({ value: a.assigneeEmail, count: a._count.assigneeEmail })),
      tags: (tags as any[]).map(t => ({ value: t.tag, count: parseInt(t.count) }))
    };
  }

  private async generateTaskFacets(baseWhere: any): Promise<any> {
    const [statuses, priorities, assignees, tags] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        _count: { status: true },
        where: baseWhere
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where: baseWhere
      }),
      this.prisma.task.groupBy({
        by: ['assigneeEmail'],
        _count: { assigneeEmail: true },
        where: baseWhere
      }),
      this.prisma.$queryRaw`
        SELECT unnest(tags) as tag, COUNT(*) as count
        FROM "Task"
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 20
      `
    ]);

    return {
      statuses: statuses.map(s => ({ value: s.status, count: s._count.status })),
      priorities: priorities.map(p => ({ value: p.priority, count: p._count.priority })),
      assignees: assignees.map(a => ({ value: a.assigneeEmail, count: a._count.assigneeEmail })),
      tags: (tags as any[]).map(t => ({ value: t.tag, count: parseInt(t.count) }))
    };
  }

  private async generateApprovalFacets(baseWhere: any): Promise<any> {
    const [statuses, urgencies, approvers] = await Promise.all([
      this.prisma.approval.groupBy({
        by: ['status'],
        _count: { status: true },
        where: baseWhere
      }),
      this.prisma.approval.groupBy({
        by: ['urgency'],
        _count: { urgency: true },
        where: baseWhere
      }),
      this.prisma.approval.groupBy({
        by: ['approverEmail'],
        _count: { approverEmail: true },
        where: baseWhere
      })
    ]);

    return {
      statuses: statuses.map(s => ({ value: s.status, count: s._count.status })),
      priorities: urgencies.map(u => ({ value: u.urgency, count: u._count.urgency })),
      assignees: approvers.map(a => ({ value: a.approverEmail, count: a._count.approverEmail })),
      tags: []
    };
  }
}