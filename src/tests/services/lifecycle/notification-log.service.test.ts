/**
 * Notification Log Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, NotificationStage, NotificationStatus } from '@prisma/client';
import { NotificationLogService } from '@/services/lifecycle/notification-log.service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    lifecycleNotificationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    }
  })),
  NotificationStage: {
    PRELAUNCH: 'PRELAUNCH',
    PREFLIGHT: 'PREFLIGHT',
    LAUNCH_WARNING: 'LAUNCH_WARNING',
    LAUNCH_CONFIRMATION: 'LAUNCH_CONFIRMATION',
    WRAPUP: 'WRAPUP'
  },
  NotificationStatus: {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    RETRYING: 'RETRYING'
  }
}));

describe('NotificationLogService', () => {
  let service: NotificationLogService;
  let mockPrisma: any;

  beforeEach(() => {
    service = new NotificationLogService();
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logNotification', () => {
    it('should log first notification attempt', async () => {
      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue([]);

      const mockLog = {
        id: 1,
        campaignScheduleId: 1,
        stage: 'PRELAUNCH',
        status: 'SUCCESS',
        attempt: 1,
        slackMessageId: 'msg_123',
        errorMessage: null,
        createdAt: new Date()
      };

      mockPrisma.lifecycleNotificationLog.create.mockResolvedValue(mockLog);

      const result = await service.logNotification(
        1,
        NotificationStage.PRELAUNCH,
        NotificationStatus.SUCCESS,
        'msg_123'
      );

      expect(result.attempt).toBe(1);
      expect(mockPrisma.lifecycleNotificationLog.create).toHaveBeenCalledWith({
        data: {
          campaignScheduleId: 1,
          stage: NotificationStage.PRELAUNCH,
          status: NotificationStatus.SUCCESS,
          attempt: 1,
          slackMessageId: 'msg_123',
          errorMessage: undefined
        }
      });
    });

    it('should increment attempt number for retries', async () => {
      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue([
        { id: 1, attempt: 1 },
        { id: 2, attempt: 2 }
      ]);

      const mockLog = {
        id: 3,
        campaignScheduleId: 1,
        stage: 'PREFLIGHT',
        status: 'SUCCESS',
        attempt: 3,
        slackMessageId: 'msg_456',
        errorMessage: null,
        createdAt: new Date()
      };

      mockPrisma.lifecycleNotificationLog.create.mockResolvedValue(mockLog);

      const result = await service.logNotification(
        1,
        NotificationStage.PREFLIGHT,
        NotificationStatus.SUCCESS,
        'msg_456'
      );

      expect(result.attempt).toBe(3);
    });

    it('should log error message for failures', async () => {
      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue([]);

      const mockLog = {
        id: 1,
        campaignScheduleId: 1,
        stage: 'LAUNCH_WARNING',
        status: 'FAILURE',
        attempt: 1,
        slackMessageId: null,
        errorMessage: 'Connection timeout',
        createdAt: new Date()
      };

      mockPrisma.lifecycleNotificationLog.create.mockResolvedValue(mockLog);

      const result = await service.logNotification(
        1,
        NotificationStage.LAUNCH_WARNING,
        NotificationStatus.FAILURE,
        undefined,
        'Connection timeout'
      );

      expect(result.status).toBe('FAILURE');
      expect(result.errorMessage).toBe('Connection timeout');
      expect(result.slackMessageId).toBeNull();
    });

    it('should track retrying status', async () => {
      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue([
        { id: 1, attempt: 1, status: 'FAILURE' }
      ]);

      const mockLog = {
        id: 2,
        campaignScheduleId: 1,
        stage: 'LAUNCH_CONFIRMATION',
        status: 'RETRYING',
        attempt: 2,
        slackMessageId: null,
        errorMessage: null,
        createdAt: new Date()
      };

      mockPrisma.lifecycleNotificationLog.create.mockResolvedValue(mockLog);

      const result = await service.logNotification(
        1,
        NotificationStage.LAUNCH_CONFIRMATION,
        NotificationStatus.RETRYING
      );

      expect(result.status).toBe('RETRYING');
      expect(result.attempt).toBe(2);
    });
  });

  describe('getNotificationStats', () => {
    it('should calculate overall statistics', async () => {
      const mockLogs = [
        { stage: 'PRELAUNCH', status: 'SUCCESS' },
        { stage: 'PREFLIGHT', status: 'SUCCESS' },
        { stage: 'LAUNCH_WARNING', status: 'FAILURE' },
        { stage: 'LAUNCH_CONFIRMATION', status: 'SUCCESS' },
        { stage: 'WRAPUP', status: 'RETRYING' }
      ];

      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getNotificationStats();

      expect(result.totalNotifications).toBe(5);
      expect(result.successfulNotifications).toBe(3);
      expect(result.failedNotifications).toBe(1);
      expect(result.retryingNotifications).toBe(1);
      expect(result.successRate).toBe(60);
    });

    it('should calculate stats by stage', async () => {
      const mockLogs = [
        { stage: 'PRELAUNCH', status: 'SUCCESS' },
        { stage: 'PRELAUNCH', status: 'SUCCESS' },
        { stage: 'PREFLIGHT', status: 'FAILURE' },
        { stage: 'PREFLIGHT', status: 'SUCCESS' }
      ];

      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getNotificationStats();

      expect(result.byStage['PRELAUNCH'].total).toBe(2);
      expect(result.byStage['PRELAUNCH'].successful).toBe(2);
      expect(result.byStage['PRELAUNCH'].failed).toBe(0);

      expect(result.byStage['PREFLIGHT'].total).toBe(2);
      expect(result.byStage['PREFLIGHT'].successful).toBe(1);
      expect(result.byStage['PREFLIGHT'].failed).toBe(1);
    });

    it('should handle empty notification log', async () => {
      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue([]);

      const result = await service.getNotificationStats();

      expect(result.totalNotifications).toBe(0);
      expect(result.successfulNotifications).toBe(0);
      expect(result.failedNotifications).toBe(0);
      expect(result.successRate).toBe(0);
    });

    it('should calculate 100% success rate', async () => {
      const mockLogs = [
        { stage: 'PRELAUNCH', status: 'SUCCESS' },
        { stage: 'PREFLIGHT', status: 'SUCCESS' },
        { stage: 'LAUNCH_WARNING', status: 'SUCCESS' }
      ];

      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getNotificationStats();

      expect(result.successRate).toBe(100);
    });
  });

  describe('getLogsForCampaign', () => {
    it('should fetch all logs for a campaign schedule', async () => {
      const mockLogs = [
        {
          id: 1,
          campaignScheduleId: 1,
          stage: 'PRELAUNCH',
          status: 'SUCCESS',
          attempt: 1,
          createdAt: new Date('2025-10-14T12:00:00Z')
        },
        {
          id: 2,
          campaignScheduleId: 1,
          stage: 'PREFLIGHT',
          status: 'SUCCESS',
          attempt: 1,
          createdAt: new Date('2025-10-15T06:00:00Z')
        }
      ];

      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogsForCampaign(1);

      expect(result).toHaveLength(2);
      expect(mockPrisma.lifecycleNotificationLog.findMany).toHaveBeenCalledWith({
        where: { campaignScheduleId: 1 },
        orderBy: { createdAt: 'asc' }
      });
    });

    it('should filter logs by stage', async () => {
      const mockLogs = [
        {
          id: 1,
          campaignScheduleId: 1,
          stage: 'PRELAUNCH',
          status: 'SUCCESS',
          attempt: 1
        }
      ];

      mockPrisma.lifecycleNotificationLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogsForCampaign(1, NotificationStage.PRELAUNCH);

      expect(result).toHaveLength(1);
      expect(mockPrisma.lifecycleNotificationLog.findMany).toHaveBeenCalledWith({
        where: {
          campaignScheduleId: 1,
          stage: NotificationStage.PRELAUNCH
        },
        orderBy: { createdAt: 'asc' }
      });
    });
  });
});
