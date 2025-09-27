import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdvancedSearchService, SearchFilters, SortOptions } from '@/services/search/advanced-search.service';

// Mock Prisma
vi.mock('@prisma/client');

const mockPrisma = {
  campaign: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn()
  },
  task: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn()
  },
  approval: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn()
  },
  savedSearch: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  },
  $queryRaw: vi.fn()
};

describe('AdvancedSearchService', () => {
  let searchService: AdvancedSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    (PrismaClient as any).mockImplementation(() => mockPrisma);
    searchService = new AdvancedSearchService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('searchCampaigns', () => {
    it('should search campaigns with basic filters', async () => {
      const filters: SearchFilters = {
        query: 'marketing',
        status: ['active', 'draft'],
        priority: ['high']
      };
      const sort: SortOptions = { field: 'createdAt', direction: 'desc' };

      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Marketing Campaign',
          description: 'Marketing description',
          status: 'active',
          priority: 'high',
          budget: 10000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          assigneeEmail: 'user@example.com',
          tags: ['marketing', 'digital'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          _count: { tasks: 5, approvals: 2 },
          tasks: [
            { id: 'task-1', status: 'completed', dueDate: new Date('2024-06-01') },
            { id: 'task-2', status: 'pending', dueDate: new Date('2024-07-01') }
          ],
          approvals: [
            { id: 'approval-1', status: 'pending' }
          ]
        }
      ];

      const mockFacets = {
        statuses: [{ value: 'active', count: 1 }],
        priorities: [{ value: 'high', count: 1 }],
        assignees: [{ value: 'user@example.com', count: 1 }],
        tags: [{ value: 'marketing', count: 1 }]
      };

      mockPrisma.campaign.count.mockResolvedValue(1);
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrisma.campaign.groupBy
        .mockResolvedValueOnce([{ status: 'active', _count: { status: 1 } }])
        .mockResolvedValueOnce([{ priority: 'high', _count: { priority: 1 } }])
        .mockResolvedValueOnce([{ assigneeEmail: 'user@example.com', _count: { assigneeEmail: 1 } }]);
      mockPrisma.$queryRaw.mockResolvedValue([{ tag: 'marketing', count: '1' }]);

      const result = await searchService.searchCampaigns(filters, sort, 1, 20);

      expect(mockPrisma.campaign.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'marketing', mode: 'insensitive' } },
            { description: { contains: 'marketing', mode: 'insensitive' } }
          ],
          status: { in: ['active', 'draft'] },
          priority: { in: ['high'] }
        }
      });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.any(Array),
          status: { in: ['active', 'draft'] },
          priority: { in: ['high'] }
        }),
        include: {
          _count: { select: { tasks: true, approvals: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          approvals: { select: { id: true, status: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20
      });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'campaign-1',
        name: 'Marketing Campaign',
        metrics: {
          completedTasks: 1,
          overdueTasks: 0,
          pendingApprovals: 1,
          progressPercentage: 50
        }
      });
    });

    it('should handle date range filters', async () => {
      const filters: SearchFilters = {
        createdAfter: new Date('2024-01-01'),
        createdBefore: new Date('2024-12-31'),
        budgetMin: 5000,
        budgetMax: 15000
      };

      mockPrisma.campaign.count.mockResolvedValue(0);
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await searchService.searchCampaigns(filters);

      expect(mockPrisma.campaign.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31')
          },
          budget: {
            gte: 5000,
            lte: 15000
          }
        }
      });
    });

    it('should handle complex filters', async () => {
      const filters: SearchFilters = {
        hasOverdueTasks: true,
        hasPendingApprovals: true,
        campaignIds: ['campaign-1', 'campaign-2'],
        excludeIds: ['campaign-3']
      };

      mockPrisma.campaign.count.mockResolvedValue(0);
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await searchService.searchCampaigns(filters);

      expect(mockPrisma.campaign.count).toHaveBeenCalledWith({
        where: {
          tasks: {
            some: {
              status: { not: 'completed' },
              dueDate: { lt: expect.any(Date) }
            }
          },
          approvals: {
            some: {
              status: 'pending'
            }
          },
          id: { in: ['campaign-1', 'campaign-2'], notIn: ['campaign-3'] }
        }
      });
    });
  });

  describe('searchTasks', () => {
    it('should search tasks with filters', async () => {
      const filters: SearchFilters = {
        query: 'review',
        status: ['pending'],
        assigneeEmails: ['user@example.com'],
        dueAfter: new Date('2024-01-01'),
        dueBefore: new Date('2024-12-31')
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Review Task',
          description: 'Task for review',
          status: 'pending',
          priority: 'medium',
          dueDate: new Date('2024-06-01'),
          assigneeEmail: 'user@example.com',
          estimatedHours: 4,
          actualHours: null,
          tags: ['review'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          campaign: {
            id: 'campaign-1',
            name: 'Campaign 1',
            status: 'active'
          },
          dependencies: []
        }
      ];

      mockPrisma.task.count.mockResolvedValue(1);
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
      mockPrisma.task.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await searchService.searchTasks(filters);

      expect(mockPrisma.task.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'review', mode: 'insensitive' } },
            { description: { contains: 'review', mode: 'insensitive' } }
          ],
          status: { in: ['pending'] },
          assigneeEmail: { in: ['user@example.com'] },
          dueDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31')
          }
        }
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'task-1',
        title: 'Review Task'
      });
    });
  });

  describe('searchApprovals', () => {
    it('should search approvals with filters', async () => {
      const filters: SearchFilters = {
        query: 'final',
        status: ['pending'],
        assigneeEmails: ['approver@example.com']
      };

      const mockApprovals = [
        {
          id: 'approval-1',
          stage: 'Final Review',
          status: 'pending',
          urgency: 'high',
          approverEmail: 'approver@example.com',
          dueDate: new Date('2024-06-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          campaign: {
            id: 'campaign-1',
            name: 'Campaign 1',
            status: 'active'
          }
        }
      ];

      mockPrisma.approval.count.mockResolvedValue(1);
      mockPrisma.approval.findMany.mockResolvedValue(mockApprovals);
      mockPrisma.approval.groupBy.mockResolvedValue([]);

      const result = await searchService.searchApprovals(filters);

      expect(mockPrisma.approval.count).toHaveBeenCalledWith({
        where: {
          stage: { contains: 'final', mode: 'insensitive' },
          status: { in: ['pending'] },
          approverEmail: { in: ['approver@example.com'] }
        }
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'approval-1',
        stage: 'Final Review'
      });
    });
  });

  describe('globalSearch', () => {
    it('should search across all entity types', async () => {
      const query = 'project';
      const entityTypes = ['campaign', 'task', 'approval'] as const;

      // Mock campaign search
      mockPrisma.campaign.count.mockResolvedValue(2);
      mockPrisma.campaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          name: 'Project Alpha',
          status: 'active',
          _count: { tasks: 5, approvals: 2 },
          tasks: [],
          approvals: []
        }
      ]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);

      // Mock task search
      mockPrisma.task.count.mockResolvedValue(3);
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Project Setup',
          status: 'completed',
          campaign: { id: 'campaign-1', name: 'Campaign 1', status: 'active' }
        }
      ]);
      mockPrisma.task.groupBy.mockResolvedValue([]);

      // Mock approval search
      mockPrisma.approval.count.mockResolvedValue(1);
      mockPrisma.approval.findMany.mockResolvedValue([
        {
          id: 'approval-1',
          stage: 'Project Approval',
          status: 'pending',
          campaign: { id: 'campaign-1', name: 'Campaign 1', status: 'active' }
        }
      ]);
      mockPrisma.approval.groupBy.mockResolvedValue([]);

      // Mock tag queries
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await searchService.globalSearch(query, entityTypes, 10);

      expect(result.campaigns).toHaveLength(1);
      expect(result.tasks).toHaveLength(1);
      expect(result.approvals).toHaveLength(1);
      expect(result.total).toBe(6); // 2 + 3 + 1
    });

    it('should search only specified entity types', async () => {
      const query = 'test';
      const entityTypes = ['campaign'] as const;

      mockPrisma.campaign.count.mockResolvedValue(1);
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await searchService.globalSearch(query, entityTypes, 10);

      expect(result.campaigns).toHaveLength(0);
      expect(result.tasks).toHaveLength(0);
      expect(result.approvals).toHaveLength(0);
      expect(result.total).toBe(1);

      // Should only call campaign search methods
      expect(mockPrisma.campaign.count).toHaveBeenCalled();
      expect(mockPrisma.task.count).not.toHaveBeenCalled();
      expect(mockPrisma.approval.count).not.toHaveBeenCalled();
    });
  });

  describe('saveSearch', () => {
    it('should save a search configuration', async () => {
      const name = 'My Saved Search';
      const entityType = 'campaign';
      const filters: SearchFilters = {
        status: ['active'],
        priority: ['high']
      };
      const sort: SortOptions = { field: 'createdAt', direction: 'desc' };
      const userId = 'user1';

      const mockSavedSearch = {
        id: 'search-1',
        name,
        entityType,
        filters: JSON.stringify(filters),
        sort: JSON.stringify(sort),
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.savedSearch.create.mockResolvedValue(mockSavedSearch);

      const result = await searchService.saveSearch(name, entityType, filters, sort, userId);

      expect(mockPrisma.savedSearch.create).toHaveBeenCalledWith({
        data: {
          name,
          entityType,
          filters: JSON.stringify(filters),
          sort: JSON.stringify(sort),
          userId,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      });

      expect(result).toEqual({
        id: 'search-1',
        name
      });
    });
  });

  describe('getSavedSearches', () => {
    it('should retrieve saved searches for user', async () => {
      const userId = 'user1';
      const mockSavedSearches = [
        {
          id: 'search-1',
          name: 'Active Campaigns',
          entityType: 'campaign',
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'search-2',
          name: 'High Priority Tasks',
          entityType: 'task',
          createdAt: new Date('2024-01-02')
        }
      ];

      mockPrisma.savedSearch.findMany.mockResolvedValue(mockSavedSearches);

      const result = await searchService.getSavedSearches(userId);

      expect(mockPrisma.savedSearch.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          name: true,
          entityType: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'search-1',
        name: 'Active Campaigns'
      });
    });
  });

  describe('executeSavedSearch', () => {
    it('should execute a saved campaign search', async () => {
      const searchId = 'search-1';
      const mockSavedSearch = {
        id: searchId,
        name: 'Active Campaigns',
        entityType: 'campaign',
        filters: JSON.stringify({ status: ['active'] }),
        sort: JSON.stringify({ field: 'createdAt', direction: 'desc' })
      };

      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.campaign.count.mockResolvedValue(1);
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await searchService.executeSavedSearch(searchId, 1, 20);

      expect(mockPrisma.savedSearch.findUnique).toHaveBeenCalledWith({
        where: { id: searchId }
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pages');
    });

    it('should throw error if saved search not found', async () => {
      const searchId = 'nonexistent-search';

      mockPrisma.savedSearch.findUnique.mockResolvedValue(null);

      await expect(
        searchService.executeSavedSearch(searchId)
      ).rejects.toThrow('Saved search not found');
    });

    it('should throw error for invalid entity type in saved search', async () => {
      const searchId = 'search-1';
      const mockSavedSearch = {
        id: searchId,
        entityType: 'invalid',
        filters: '{}',
        sort: '{}'
      };

      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);

      await expect(
        searchService.executeSavedSearch(searchId)
      ).rejects.toThrow('Invalid entity type: invalid');
    });
  });

  describe('pagination and sorting', () => {
    it('should handle pagination correctly', async () => {
      const filters: SearchFilters = {};
      const sort: SortOptions = { field: 'name', direction: 'asc' };
      const page = 2;
      const limit = 5;

      mockPrisma.campaign.count.mockResolvedValue(12);
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.groupBy.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await searchService.searchCampaigns(filters, sort, page, limit);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { name: 'asc' },
        skip: 5, // (page - 1) * limit = (2 - 1) * 5
        take: 5
      });

      expect(result.page).toBe(2);
      expect(result.pages).toBe(3); // Math.ceil(12 / 5)
      expect(result.total).toBe(12);
    });
  });
});