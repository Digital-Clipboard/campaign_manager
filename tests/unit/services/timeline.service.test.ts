import { TimelineService } from '../../../src/services/timeline/timeline.service';

// Mock dependencies
const mockPrisma = {
  campaign: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  timeline: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
} as any;

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
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

describe('TimelineService', () => {
  let timelineService: TimelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    timelineService = new TimelineService(mockPrisma, mockCache);
  });

  describe('generateTimeline', () => {
    const mockCampaign = {
      id: 'campaign-1',
      type: 'email_blast',
      priority: 'high',
      objectives: ['Increase awareness'],
      targetDate: new Date('2024-12-31')
    };

    const mockTimeline = {
      id: 'timeline-1',
      campaignId: 'campaign-1',
      template: 'standard',
      milestones: [],
      criticalPath: [],
      buffer: 3,
      estimatedHours: 60
    };

    it('should generate timeline successfully', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrisma.timeline.create.mockResolvedValue(mockTimeline);
      mockCache.get.mockResolvedValue(null); // No cached template

      const result = await timelineService.generateTimeline(
        'campaign-1',
        'standard',
        new Date('2024-12-31')
      );

      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        select: {
          id: true,
          type: true,
          priority: true,
          objectives: true,
          targetDate: true
        }
      });

      expect(mockPrisma.timeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campaignId: 'campaign-1',
          template: 'standard',
          milestones: expect.any(Array),
          criticalPath: expect.any(Array),
          buffer: expect.any(Number),
          estimatedHours: expect.any(Number)
        })
      });

      expect(result.timeline).toEqual(mockTimeline);
      expect(result.criticalPath).toBeDefined();
      expect(result.totalDuration).toBeDefined();
      expect(result.buffer).toBeDefined();
    });

    it('should throw error if campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(timelineService.generateTimeline(
        'nonexistent',
        'standard',
        new Date('2024-12-31')
      )).rejects.toThrow('Campaign not found');
    });

    it('should use cached template when available', async () => {
      const cachedTemplate = JSON.stringify({
        name: 'Cached Template',
        type: 'email_blast',
        duration: 14,
        phases: [],
        tasks: []
      });

      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrisma.timeline.create.mockResolvedValue(mockTimeline);
      mockCache.get.mockResolvedValue(cachedTemplate);

      await timelineService.generateTimeline(
        'campaign-1',
        'standard',
        new Date('2024-12-31')
      );

      expect(mockCache.get).toHaveBeenCalledWith('timeline_template:standard:email_blast');
      expect(mockCache.set).not.toHaveBeenCalled(); // Should not cache again
    });
  });

  describe('getTimelineTemplate', () => {
    it('should return cached template if available', async () => {
      const template = {
        name: 'Test Template',
        type: 'email_blast',
        duration: 14,
        phases: [],
        tasks: []
      };

      mockCache.get.mockResolvedValue(JSON.stringify(template));

      const result = await timelineService.getTimelineTemplate('standard', 'email_blast');

      expect(mockCache.get).toHaveBeenCalledWith('timeline_template:standard:email_blast');
      expect(result).toEqual(template);
    });

    it('should return built-in template and cache it', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await timelineService.getTimelineTemplate('standard', 'email_blast');

      expect(result.name).toBe('Email Blast - Standard');
      expect(result.type).toBe('email_blast');
      expect(result.duration).toBe(14);
      expect(result.phases.length).toBeGreaterThan(0);
      expect(result.tasks.length).toBeGreaterThan(0);

      expect(mockCache.set).toHaveBeenCalledWith(
        'timeline_template:standard:email_blast',
        expect.any(String),
        3600
      );
    });

    it('should return product launch template for product launches', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await timelineService.getTimelineTemplate('standard', 'product_launch');

      expect(result.name).toBe('Product Launch - Standard');
      expect(result.type).toBe('product_launch');
      expect(result.duration).toBe(42);
      expect(result.phases.length).toBeGreaterThan(0);
    });

    it('should return fallback template for unknown types', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await timelineService.getTimelineTemplate('standard', 'unknown_type');

      expect(result.name).toBe('Basic Campaign');
      expect(result.type).toBe('unknown_type');
      expect(result.duration).toBe(7);
    });
  });

  describe('updateTimeline', () => {
    const mockExistingTimeline = {
      id: 'timeline-1',
      campaignId: 'campaign-1',
      template: 'standard',
      criticalPath: ['task1', 'task2'],
      campaign: {
        id: 'campaign-1',
        type: 'email_blast',
        priority: 'high',
        targetDate: new Date('2024-12-31')
      }
    };

    it('should update timeline successfully', async () => {
      const updates = {
        buffer: 5,
        milestones: [{
          id: 'milestone-1',
          name: 'Test Milestone',
          description: 'Test',
          dueDate: new Date('2024-12-20'),
          status: 'pending' as const,
          dependencies: [],
          tasks: []
        }]
      };

      mockPrisma.timeline.findUnique.mockResolvedValue(mockExistingTimeline);
      mockPrisma.timeline.update.mockResolvedValue({
        ...mockExistingTimeline,
        ...updates
      });

      const result = await timelineService.updateTimeline('timeline-1', updates);

      expect(mockPrisma.timeline.update).toHaveBeenCalledWith({
        where: { id: 'timeline-1' },
        data: expect.objectContaining({
          milestones: updates.milestones,
          buffer: updates.buffer
        })
      });

      expect(result).toBeDefined();
    });

    it('should throw error if timeline not found', async () => {
      mockPrisma.timeline.findUnique.mockResolvedValue(null);

      await expect(timelineService.updateTimeline('nonexistent', { buffer: 5 }))
        .rejects.toThrow('Timeline not found');
    });
  });

  describe('getTimeline', () => {
    it('should return timeline if found', async () => {
      const mockTimeline = {
        id: 'timeline-1',
        campaignId: 'campaign-1',
        template: 'standard',
        campaign: {
          id: 'campaign-1',
          name: 'Test Campaign',
          type: 'email_blast',
          status: 'planning',
          targetDate: new Date('2024-12-31')
        }
      };

      mockPrisma.timeline.findUnique.mockResolvedValue(mockTimeline);

      const result = await timelineService.getTimeline('timeline-1');

      expect(mockPrisma.timeline.findUnique).toHaveBeenCalledWith({
        where: { id: 'timeline-1' },
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

      expect(result).toEqual(mockTimeline);
    });

    it('should return null if timeline not found', async () => {
      mockPrisma.timeline.findUnique.mockResolvedValue(null);

      const result = await timelineService.getTimeline('nonexistent');

      expect(result).toBeNull();
    });
  });
});