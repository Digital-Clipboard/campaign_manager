import { CampaignService } from '../../../src/services/campaign/campaign.service';
import { CreateCampaignRequest } from '../../../src/types';

// Mock dependencies
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

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

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
        data: expect.objectContaining({
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
        }),
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
});