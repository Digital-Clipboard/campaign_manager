import { PrismaClient } from '@prisma/client';
import { CampaignService } from '@/services/campaign/campaign.service';
import { CacheService } from '@/services/cache/cache.service';
import { CreateCampaignRequest } from '@/types';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@/services/cache/cache.service');
jest.mock('@/utils/logger');

const mockPrisma = {
  campaign: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
} as any;

const mockCache = {
  getCampaign: jest.fn(),
  setCampaign: jest.fn(),
  invalidateCampaign: jest.fn(),
  getReadinessScore: jest.fn(),
  setReadinessScore: jest.fn(),
} as any;

describe('CampaignService', () => {
  let campaignService: CampaignService;

  beforeEach(() => {
    jest.clearAllMocks();
    campaignService = new CampaignService(mockPrisma, mockCache);
  });

  describe('createCampaign', () => {
    const createRequest: CreateCampaignRequest = {
      name: 'Test Campaign',
      type: 'email_blast',
      targetDate: new Date('2024-12-31'),
      objectives: ['Increase awareness', 'Drive sales'],
      priority: 'high',
      description: 'Test campaign description',
    };

    const mockCreatedCampaign = {
      id: 'campaign-1',
      name: 'Test Campaign',
      type: 'email_blast',
      status: 'planning',
      targetDate: new Date('2024-12-31'),
      objectives: ['Increase awareness', 'Drive sales'],
      priority: 'high',
      description: 'Test campaign description',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      timeline: null,
      tasks: [],
      approvals: [],
      _count: { tasks: 0, approvals: 0 }
    };

    it('should create a campaign successfully', async () => {
      mockPrisma.campaign.create.mockResolvedValue(mockCreatedCampaign);

      const result = await campaignService.createCampaign(createRequest, 'user-1');

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Campaign',
          type: 'email_blast',
          status: 'planning',
          targetDate: createRequest.targetDate,
          objectives: ['Increase awareness', 'Drive sales'],
          priority: 'high',
          description: 'Test campaign description',
          stakeholders: [],
          createdBy: 'user-1',
          updatedBy: 'user-1'
        },
        include: expect.objectContaining({
          timeline: true,
          tasks: expect.any(Object),
          approvals: expect.any(Object),
          _count: expect.any(Object)
        })
      });

      expect(mockCache.setCampaign).toHaveBeenCalledWith(mockCreatedCampaign);
      expect(result).toEqual(mockCreatedCampaign);
    });

    it('should handle missing optional fields', async () => {
      const minimalRequest: CreateCampaignRequest = {
        name: 'Minimal Campaign',
        type: 'newsletter',
        targetDate: new Date('2024-12-31'),
      };

      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCreatedCampaign,
        name: 'Minimal Campaign',
        type: 'newsletter',
        objectives: [],
        priority: 'medium'
      });

      const result = await campaignService.createCampaign(minimalRequest, 'user-1');

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: 'Minimal Campaign',
          type: 'newsletter',
          status: 'planning',
          targetDate: minimalRequest.targetDate,
          objectives: [],
          priority: 'medium',
          stakeholders: [],
          createdBy: 'user-1',
          updatedBy: 'user-1'
        },
        include: expect.any(Object)
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('Database connection failed');
      mockPrisma.campaign.create.mockRejectedValue(error);

      await expect(campaignService.createCampaign(createRequest, 'user-1'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('getCampaign', () => {
    const mockCampaign = {
      id: 'campaign-1',
      name: 'Test Campaign',
      status: 'planning',
      timeline: null,
      tasks: [],
      approvals: []
    };

    it('should return campaign from cache if available', async () => {
      mockCache.getCampaign.mockResolvedValue(mockCampaign);

      const result = await campaignService.getCampaign('campaign-1');

      expect(mockCache.getCampaign).toHaveBeenCalledWith('campaign-1');
      expect(mockPrisma.campaign.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockCampaign);
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCache.getCampaign.mockResolvedValue(null);
      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      const result = await campaignService.getCampaign('campaign-1');

      expect(mockCache.getCampaign).toHaveBeenCalledWith('campaign-1');
      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        include: expect.any(Object)
      });
      expect(mockCache.setCampaign).toHaveBeenCalledWith(mockCampaign);
      expect(result).toEqual(mockCampaign);
    });

    it('should return null if campaign not found', async () => {
      mockCache.getCampaign.mockResolvedValue(null);
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const result = await campaignService.getCampaign('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateCampaignStatus', () => {
    it('should update campaign status with valid transition', async () => {
      const currentCampaign = { status: 'planning' };
      const updatedCampaign = { ...currentCampaign, status: 'ready_for_review' };

      mockPrisma.campaign.findUnique.mockResolvedValue(currentCampaign);
      mockPrisma.campaign.update.mockResolvedValue(updatedCampaign);
      mockPrisma.activityLog.create.mockResolvedValue({});

      const result = await campaignService.updateCampaignStatus(
        'campaign-1',
        'ready_for_review',
        'user-1'
      );

      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        select: { status: true }
      });

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          type: 'campaign_status_change',
          entityType: 'campaign',
          entityId: 'campaign-1',
          performedBy: 'user-1',
          details: {
            fromStatus: 'planning',
            toStatus: 'ready_for_review',
            timestamp: expect.any(String)
          }
        }
      });
    });

    it('should reject invalid status transitions', async () => {
      const currentCampaign = { status: 'completed' };
      mockPrisma.campaign.findUnique.mockResolvedValue(currentCampaign);

      await expect(campaignService.updateCampaignStatus(
        'campaign-1',
        'planning',
        'user-1'
      )).rejects.toThrow('Invalid status transition from completed to planning');
    });

    it('should handle campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(campaignService.updateCampaignStatus(
        'nonexistent',
        'ready_for_review',
        'user-1'
      )).rejects.toThrow('Campaign not found');
    });
  });

  describe('calculateReadinessScore', () => {
    it('should return cached score if available', async () => {
      mockCache.getReadinessScore.mockResolvedValue(85);

      const result = await campaignService.calculateReadinessScore('campaign-1');

      expect(mockCache.getReadinessScore).toHaveBeenCalledWith('campaign-1');
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBe(85);
    });

    it('should calculate and cache score if not cached', async () => {
      mockCache.getReadinessScore.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([{ score: 72 }]);

      const result = await campaignService.calculateReadinessScore('campaign-1');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockCache.setReadinessScore).toHaveBeenCalledWith('campaign-1', 72);
      expect(result).toBe(72);
    });

    it('should return 0 if no score calculated', async () => {
      mockCache.getReadinessScore.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await campaignService.calculateReadinessScore('campaign-1');

      expect(result).toBe(0);
    });
  });

  describe('listCampaigns', () => {
    const mockCampaigns = [
      { id: 'campaign-1', name: 'Campaign 1', status: 'planning' },
      { id: 'campaign-2', name: 'Campaign 2', status: 'approved' }
    ];

    it('should list campaigns with pagination', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrisma.campaign.count.mockResolvedValue(25);

      const result = await campaignService.listCampaigns({
        page: 2,
        pageSize: 10,
        status: 'planning'
      });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: { status: 'planning' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10
      });

      expect(result).toEqual({
        campaigns: mockCampaigns,
        total: 25,
        page: 2,
        pageSize: 10
      });
    });

    it('should handle search filtering', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrisma.campaign.count.mockResolvedValue(2);

      await campaignService.listCampaigns({
        search: 'email campaign'
      });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'email campaign', mode: 'insensitive' } },
            { description: { contains: 'email campaign', mode: 'insensitive' } }
          ]
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20
      });
    });
  });

  describe('deleteCampaign', () => {
    it('should delete campaign and invalidate cache', async () => {
      mockPrisma.campaign.delete.mockResolvedValue({});

      await campaignService.deleteCampaign('campaign-1', 'user-1');

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: 'campaign-1' }
      });
      expect(mockCache.invalidateCampaign).toHaveBeenCalledWith('campaign-1');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Campaign has associated tasks');
      mockPrisma.campaign.delete.mockRejectedValue(error);

      await expect(campaignService.deleteCampaign('campaign-1', 'user-1'))
        .rejects.toThrow('Campaign has associated tasks');
    });
  });
});