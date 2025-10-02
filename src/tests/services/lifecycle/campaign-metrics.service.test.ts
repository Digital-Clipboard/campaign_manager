/**
 * Campaign Metrics Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CampaignMetricsService } from '@/services/lifecycle/campaign-metrics.service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    lifecycleCampaignMetrics: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    lifecycleCampaignSchedule: {
      findFirst: vi.fn()
    }
  }))
}));

describe('CampaignMetricsService', () => {
  let service: CampaignMetricsService;
  let mockPrisma: any;

  beforeEach(() => {
    service = new CampaignMetricsService();
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('saveMetrics', () => {
    it('should save metrics with calculated rates', async () => {
      const mockMetrics = {
        id: 1,
        campaignScheduleId: 1,
        mailjetCampaignId: BigInt(999),
        processed: 10000,
        delivered: 9750,
        bounced: 250,
        hardBounces: 50,
        softBounces: 200,
        blocked: 0,
        queued: 0,
        opened: 2400,
        clicked: 480,
        unsubscribed: 10,
        complained: 5,
        deliveryRate: 97.5,
        bounceRate: 2.5,
        hardBounceRate: 0.5,
        softBounceRate: 2.0,
        openRate: 24.62,
        clickRate: 4.92,
        sendStartAt: new Date(),
        sendEndAt: new Date(),
        collectedAt: new Date()
      };

      mockPrisma.lifecycleCampaignMetrics.create.mockResolvedValue(mockMetrics);

      const result = await service.saveMetrics(
        1,
        BigInt(999),
        {
          processed: 10000,
          delivered: 9750,
          bounced: 250,
          hardBounces: 50,
          softBounces: 200,
          blocked: 0,
          queued: 0,
          opened: 2400,
          clicked: 480,
          unsubscribed: 10,
          complained: 5
        }
      );

      expect(result).toBeDefined();
      expect(mockPrisma.lifecycleCampaignMetrics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campaignScheduleId: 1,
          mailjetCampaignId: BigInt(999),
          processed: 10000,
          delivered: 9750,
          deliveryRate: expect.any(Number),
          bounceRate: expect.any(Number),
          openRate: expect.any(Number),
          clickRate: expect.any(Number)
        })
      });
    });

    it('should calculate correct delivery rate', async () => {
      const service = new CampaignMetricsService();

      // Test through calculateRates (private method, test via saveMetrics)
      const mockMetrics = {
        id: 1,
        deliveryRate: 97.5
      };

      mockPrisma.lifecycleCampaignMetrics.create.mockImplementation((args: any) => {
        return Promise.resolve({ ...mockMetrics, ...args.data });
      });

      await service.saveMetrics(1, BigInt(999), {
        processed: 10000,
        delivered: 9750,
        bounced: 250,
        hardBounces: 50,
        softBounces: 200,
        blocked: 0,
        queued: 0,
        opened: 2400,
        clicked: 480,
        unsubscribed: 10,
        complained: 5
      });

      const createCall = mockPrisma.lifecycleCampaignMetrics.create.mock.calls[0][0];
      expect(createCall.data.deliveryRate).toBeCloseTo(97.5, 1);
    });

    it('should calculate correct bounce rates', async () => {
      mockPrisma.lifecycleCampaignMetrics.create.mockImplementation((args: any) => {
        return Promise.resolve({ id: 1, ...args.data });
      });

      await service.saveMetrics(1, BigInt(999), {
        processed: 10000,
        delivered: 9750,
        bounced: 250,
        hardBounces: 50,
        softBounces: 200,
        blocked: 0,
        queued: 0,
        opened: 2400,
        clicked: 480,
        unsubscribed: 10,
        complained: 5
      });

      const createCall = mockPrisma.lifecycleCampaignMetrics.create.mock.calls[0][0];
      expect(createCall.data.bounceRate).toBeCloseTo(2.5, 1);
      expect(createCall.data.hardBounceRate).toBeCloseTo(0.5, 1);
      expect(createCall.data.softBounceRate).toBeCloseTo(2.0, 1);
    });

    it('should calculate open and click rates based on delivered', async () => {
      mockPrisma.lifecycleCampaignMetrics.create.mockImplementation((args: any) => {
        return Promise.resolve({ id: 1, ...args.data });
      });

      await service.saveMetrics(1, BigInt(999), {
        processed: 10000,
        delivered: 9750,
        bounced: 250,
        hardBounces: 50,
        softBounces: 200,
        blocked: 0,
        queued: 0,
        opened: 2400,
        clicked: 480,
        unsubscribed: 10,
        complained: 5
      });

      const createCall = mockPrisma.lifecycleCampaignMetrics.create.mock.calls[0][0];
      // Open rate = 2400 / 9750 * 100 = 24.62%
      expect(createCall.data.openRate).toBeCloseTo(24.62, 1);
      // Click rate = 480 / 9750 * 100 = 4.92%
      expect(createCall.data.clickRate).toBeCloseTo(4.92, 1);
    });

    it('should handle zero delivered for engagement rates', async () => {
      mockPrisma.lifecycleCampaignMetrics.create.mockImplementation((args: any) => {
        return Promise.resolve({ id: 1, ...args.data });
      });

      await service.saveMetrics(1, BigInt(999), {
        processed: 10000,
        delivered: 0,
        bounced: 10000,
        hardBounces: 5000,
        softBounces: 5000,
        blocked: 0,
        queued: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        complained: 0
      });

      const createCall = mockPrisma.lifecycleCampaignMetrics.create.mock.calls[0][0];
      expect(createCall.data.openRate).toBeNull();
      expect(createCall.data.clickRate).toBeNull();
    });
  });

  describe('getPreviousRoundMetrics', () => {
    it('should return null for round 1', async () => {
      const result = await service.getPreviousRoundMetrics('Test Campaign', 1);
      expect(result).toBeNull();
    });

    it('should fetch previous round metrics for round 2+', async () => {
      const mockSchedule = {
        id: 1,
        campaignName: 'Test Campaign',
        roundNumber: 1,
        metrics: [{
          id: 1,
          deliveryRate: 97.5,
          bounceRate: 2.5,
          collectedAt: new Date()
        }]
      };

      mockPrisma.lifecycleCampaignSchedule.findFirst.mockResolvedValue(mockSchedule);

      const result = await service.getPreviousRoundMetrics('Test Campaign', 2);

      expect(result).toBeDefined();
      expect(result?.deliveryRate).toBe(97.5);
      expect(mockPrisma.lifecycleCampaignSchedule.findFirst).toHaveBeenCalledWith({
        where: {
          campaignName: 'Test Campaign',
          roundNumber: 1
        },
        include: {
          metrics: {
            orderBy: { collectedAt: 'desc' },
            take: 1
          }
        }
      });
    });

    it('should return most recent metrics if multiple exist', async () => {
      const mockSchedule = {
        id: 1,
        campaignName: 'Test Campaign',
        roundNumber: 1,
        metrics: [{
          id: 2,
          deliveryRate: 98.0,
          collectedAt: new Date('2025-10-15T12:00:00Z')
        }]
      };

      mockPrisma.lifecycleCampaignSchedule.findFirst.mockResolvedValue(mockSchedule);

      const result = await service.getPreviousRoundMetrics('Test Campaign', 2);

      expect(result?.id).toBe(2);
      expect(result?.deliveryRate).toBe(98.0);
    });
  });

  describe('calculateDeltas', () => {
    it('should calculate positive deltas', async () => {
      const currentMetrics = {
        id: 2,
        deliveryRate: 98.0,
        bounceRate: 1.5,
        hardBounceRate: 0.3,
        softBounceRate: 1.2,
        openRate: 26.0,
        clickRate: 5.2
      };

      const previousMetrics = {
        id: 1,
        deliveryRate: 97.5,
        bounceRate: 2.0,
        hardBounceRate: 0.5,
        softBounceRate: 1.5,
        openRate: 24.0,
        clickRate: 4.5
      };

      mockPrisma.lifecycleCampaignMetrics.findUnique
        .mockResolvedValueOnce(currentMetrics)
        .mockResolvedValueOnce(previousMetrics);

      const result = await service.calculateDeltas(2, 1);

      expect(result.deliveryRate).toBeCloseTo(0.5, 1);
      expect(result.bounceRate).toBeCloseTo(-0.5, 1);
      expect(result.openRate).toBeCloseTo(2.0, 1);
      expect(result.clickRate).toBeCloseTo(0.7, 1);
    });

    it('should calculate negative deltas', async () => {
      const currentMetrics = {
        id: 2,
        deliveryRate: 96.0,
        bounceRate: 3.0,
        hardBounceRate: 0.8,
        softBounceRate: 2.2,
        openRate: 22.0,
        clickRate: 4.0
      };

      const previousMetrics = {
        id: 1,
        deliveryRate: 97.5,
        bounceRate: 2.0,
        hardBounceRate: 0.5,
        softBounceRate: 1.5,
        openRate: 24.0,
        clickRate: 4.5
      };

      mockPrisma.lifecycleCampaignMetrics.findUnique
        .mockResolvedValueOnce(currentMetrics)
        .mockResolvedValueOnce(previousMetrics);

      const result = await service.calculateDeltas(2, 1);

      expect(result.deliveryRate).toBeCloseTo(-1.5, 1);
      expect(result.bounceRate).toBeCloseTo(1.0, 1);
      expect(result.openRate).toBeCloseTo(-2.0, 1);
      expect(result.clickRate).toBeCloseTo(-0.5, 1);
    });

    it('should handle null engagement rates', async () => {
      const currentMetrics = {
        id: 2,
        deliveryRate: 98.0,
        bounceRate: 1.5,
        hardBounceRate: 0.3,
        softBounceRate: 1.2,
        openRate: null,
        clickRate: null
      };

      const previousMetrics = {
        id: 1,
        deliveryRate: 97.5,
        bounceRate: 2.0,
        hardBounceRate: 0.5,
        softBounceRate: 1.5,
        openRate: 24.0,
        clickRate: 4.5
      };

      mockPrisma.lifecycleCampaignMetrics.findUnique
        .mockResolvedValueOnce(currentMetrics)
        .mockResolvedValueOnce(previousMetrics);

      const result = await service.calculateDeltas(2, 1);

      expect(result.openRate).toBeNull();
      expect(result.clickRate).toBeNull();
    });
  });
});
