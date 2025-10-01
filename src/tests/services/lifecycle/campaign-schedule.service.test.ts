/**
 * Campaign Schedule Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CampaignScheduleService } from '@/services/lifecycle/campaign-schedule.service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    lifecycleCampaignSchedule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  })),
  CampaignStatus: {
    SCHEDULED: 'SCHEDULED',
    READY: 'READY',
    LAUNCHING: 'LAUNCHING',
    SENT: 'SENT',
    COMPLETED: 'COMPLETED',
    BLOCKED: 'BLOCKED'
  }
}));

describe('CampaignScheduleService', () => {
  let service: CampaignScheduleService;
  let mockPrisma: any;

  beforeEach(() => {
    service = new CampaignScheduleService();
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createCampaignSchedule', () => {
    it('should create 3 campaign schedules', async () => {
      const mockSchedule = {
        id: 1,
        campaignName: 'Test Campaign',
        roundNumber: 1,
        scheduledDate: new Date('2025-10-15T09:15:00Z'),
        scheduledTime: '09:15',
        listName: 'test_list_001',
        listId: BigInt(12345),
        recipientCount: 3334,
        recipientRange: '1-3334',
        mailjetDraftId: null,
        mailjetCampaignId: null,
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        notificationStatus: {},
        status: 'SCHEDULED',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.lifecycleCampaignSchedule.create.mockResolvedValue(mockSchedule);

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-15T00:00:00Z')
      };

      const result = await service.createCampaignSchedule(params);

      expect(result).toHaveLength(3);
      expect(mockPrisma.lifecycleCampaignSchedule.create).toHaveBeenCalledTimes(3);
    });

    it('should schedule only on Tuesdays and Thursdays', async () => {
      const mockSchedule = {
        id: 1,
        scheduledDate: new Date(),
        status: 'SCHEDULED'
      };

      mockPrisma.lifecycleCampaignSchedule.create.mockResolvedValue(mockSchedule);

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-13T00:00:00Z') // Monday
      };

      const result = await service.createCampaignSchedule(params);

      // Check that all scheduled dates are Tue (2) or Thu (4)
      result.forEach(schedule => {
        const dayOfWeek = schedule.scheduledDate.getDay();
        expect([2, 4]).toContain(dayOfWeek);
      });
    });

    it('should split recipients into 3 equal batches', async () => {
      const mockSchedules: any[] = [];
      mockPrisma.lifecycleCampaignSchedule.create.mockImplementation((args: any) => {
        const schedule = {
          id: mockSchedules.length + 1,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockSchedules.push(schedule);
        return Promise.resolve(schedule);
      });

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-15T00:00:00Z')
      };

      await service.createCampaignSchedule(params);

      // Verify batch sizes
      expect(mockSchedules[0].recipientCount).toBe(3334); // ceil(10000/3)
      expect(mockSchedules[1].recipientCount).toBe(3333);
      expect(mockSchedules[2].recipientCount).toBe(3333);

      // Verify total
      const total = mockSchedules.reduce((sum, s) => sum + s.recipientCount, 0);
      expect(total).toBe(10000);
    });

    it('should set scheduled time to 09:15', async () => {
      const mockSchedule = {
        id: 1,
        scheduledTime: '09:15',
        status: 'SCHEDULED'
      };

      mockPrisma.lifecycleCampaignSchedule.create.mockResolvedValue(mockSchedule);

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-15T00:00:00Z')
      };

      const result = await service.createCampaignSchedule(params);

      result.forEach(schedule => {
        expect(schedule.scheduledTime).toBe('09:15');
      });
    });

    it('should create proper recipient ranges', async () => {
      const mockSchedules: any[] = [];
      mockPrisma.lifecycleCampaignSchedule.create.mockImplementation((args: any) => {
        const schedule = {
          id: mockSchedules.length + 1,
          ...args.data
        };
        mockSchedules.push(schedule);
        return Promise.resolve(schedule);
      });

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-15T00:00:00Z')
      };

      await service.createCampaignSchedule(params);

      expect(mockSchedules[0].recipientRange).toBe('1-3334');
      expect(mockSchedules[1].recipientRange).toBe('3335-6667');
      expect(mockSchedules[2].recipientRange).toBe('6668-10000');
    });

    it('should initialize notification status for all stages', async () => {
      const mockSchedule = {
        id: 1,
        notificationStatus: {
          prelaunch: { sent: false, timestamp: null, status: null },
          preflight: { sent: false, timestamp: null, status: null },
          launchWarning: { sent: false, timestamp: null, status: null },
          launchConfirmation: { sent: false, timestamp: null, status: null },
          wrapup: { sent: false, timestamp: null, status: null }
        },
        status: 'SCHEDULED'
      };

      mockPrisma.lifecycleCampaignSchedule.create.mockResolvedValue(mockSchedule);

      const params = {
        campaignName: 'Test Campaign',
        listIdPrefix: 'test_list',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 10000,
        mailjetListIds: [BigInt(12345), BigInt(12346), BigInt(12347)] as [bigint, bigint, bigint],
        startDate: new Date('2025-10-15T00:00:00Z')
      };

      const result = await service.createCampaignSchedule(params);

      result.forEach(schedule => {
        expect(schedule.notificationStatus).toBeDefined();
        const status = schedule.notificationStatus as any;
        expect(status.prelaunch).toBeDefined();
        expect(status.preflight).toBeDefined();
        expect(status.launchWarning).toBeDefined();
        expect(status.launchConfirmation).toBeDefined();
        expect(status.wrapup).toBeDefined();
      });
    });
  });

  describe('getNextTuesdayOrThursday', () => {
    it('should return next Tuesday from Sunday', () => {
      const sunday = new Date('2025-10-12T00:00:00Z'); // Sunday
      const service = new CampaignScheduleService();

      // Use a public method that calls getNextTuesdayOrThursday internally
      // We'll test this through the batch schedule calculation
      const result = (service as any).getNextTuesdayOrThursday(sunday);

      expect(result.getDay()).toBe(2); // Tuesday
      expect(result.getDate()).toBe(14); // Oct 14
    });

    it('should return next Thursday from Tuesday', () => {
      const tuesday = new Date('2025-10-14T00:00:00Z'); // Tuesday
      const service = new CampaignScheduleService();

      const result = (service as any).getNextTuesdayOrThursday(tuesday);

      expect(result.getDay()).toBe(4); // Thursday
      expect(result.getDate()).toBe(16); // Oct 16
    });

    it('should return next Tuesday from Thursday', () => {
      const thursday = new Date('2025-10-16T00:00:00Z'); // Thursday
      const service = new CampaignScheduleService();

      const result = (service as any).getNextTuesdayOrThursday(thursday);

      expect(result.getDay()).toBe(2); // Tuesday
      expect(result.getDate()).toBe(21); // Oct 21 (next week)
    });

    it('should set time to 09:15 UTC', () => {
      const monday = new Date('2025-10-13T15:30:00Z'); // Monday 3:30 PM
      const service = new CampaignScheduleService();

      const result = (service as any).getNextTuesdayOrThursday(monday);

      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(15);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });
});
