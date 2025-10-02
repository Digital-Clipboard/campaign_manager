/**
 * Notification Log Service
 * Tracks all lifecycle notification attempts and status
 */

import { LifecycleNotificationLog, NotificationStage, NotificationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class NotificationLogService {
  /**
   * Log a notification attempt
   */
  async logNotification(
    campaignScheduleId: number,
    stage: NotificationStage,
    status: NotificationStatus,
    slackMessageId?: string,
    errorMessage?: string
  ): Promise<LifecycleNotificationLog> {
    // Get current attempt count for this stage
    const existingLogs = await prisma.lifecycleNotificationLog.findMany({
      where: {
        campaignScheduleId,
        stage,
      },
    });

    const attempt = existingLogs.length + 1;

    return await prisma.lifecycleNotificationLog.create({
      data: {
        campaignScheduleId,
        stage,
        status,
        attempt,
        slackMessageId,
        errorMessage,
      },
    });
  }

  /**
   * Get all notifications for a campaign schedule
   */
  async getNotifications(campaignScheduleId: number): Promise<LifecycleNotificationLog[]> {
    return await prisma.lifecycleNotificationLog.findMany({
      where: { campaignScheduleId },
      orderBy: { sentAt: 'asc' },
    });
  }

  /**
   * Get notifications for a specific stage
   */
  async getNotificationsByStage(
    campaignScheduleId: number,
    stage: NotificationStage
  ): Promise<LifecycleNotificationLog[]> {
    return await prisma.lifecycleNotificationLog.findMany({
      where: {
        campaignScheduleId,
        stage,
      },
      orderBy: { attempt: 'asc' },
    });
  }

  /**
   * Get latest notification for a stage
   */
  async getLatestNotification(
    campaignScheduleId: number,
    stage: NotificationStage
  ): Promise<LifecycleNotificationLog | null> {
    return await prisma.lifecycleNotificationLog.findFirst({
      where: {
        campaignScheduleId,
        stage,
      },
      orderBy: { attempt: 'desc' },
    });
  }

  /**
   * Check if notification was successful for a stage
   */
  async wasNotificationSuccessful(
    campaignScheduleId: number,
    stage: NotificationStage
  ): Promise<boolean> {
    const latest = await this.getLatestNotification(campaignScheduleId, stage);
    return latest?.status === NotificationStatus.SUCCESS;
  }

  /**
   * Get failed notifications that need retry
   */
  async getFailedNotifications(maxAttempts: number = 3): Promise<LifecycleNotificationLog[]> {
    // Get all campaign schedules with failed notifications
    const failedLogs = await prisma.lifecycleNotificationLog.findMany({
      where: {
        status: {
          in: [NotificationStatus.FAILURE, NotificationStatus.RETRYING],
        },
        attempt: {
          lt: maxAttempts,
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    // Filter to only include latest attempt for each schedule+stage combination
    const latestByScheduleStage = new Map<string, LifecycleNotificationLog>();

    for (const log of failedLogs) {
      const key = `${log.campaignScheduleId}-${log.stage}`;
      const existing = latestByScheduleStage.get(key);

      if (!existing || log.attempt > existing.attempt) {
        latestByScheduleStage.set(key, log);
      }
    }

    return Array.from(latestByScheduleStage.values());
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalNotifications: number;
    successfulNotifications: number;
    failedNotifications: number;
    retryingNotifications: number;
    successRate: number;
    byStage: Record<string, { total: number; successful: number; failed: number }>;
  }> {
    const allNotifications = await prisma.lifecycleNotificationLog.findMany();

    const stats = {
      totalNotifications: allNotifications.length,
      successfulNotifications: allNotifications.filter((n) => n.status === NotificationStatus.SUCCESS).length,
      failedNotifications: allNotifications.filter((n) => n.status === NotificationStatus.FAILURE).length,
      retryingNotifications: allNotifications.filter((n) => n.status === NotificationStatus.RETRYING).length,
      successRate: 0,
      byStage: {} as Record<string, { total: number; successful: number; failed: number }>,
    };

    stats.successRate = stats.totalNotifications > 0
      ? (stats.successfulNotifications / stats.totalNotifications) * 100
      : 0;

    // Calculate stats by stage
    for (const stage of Object.values(NotificationStage)) {
      const stageNotifications = allNotifications.filter((n) => n.stage === stage);
      stats.byStage[stage] = {
        total: stageNotifications.length,
        successful: stageNotifications.filter((n) => n.status === NotificationStatus.SUCCESS).length,
        failed: stageNotifications.filter((n) => n.status === NotificationStatus.FAILURE).length,
      };
    }

    return stats;
  }

  /**
   * Get average attempts before success
   */
  async getAverageAttemptsToSuccess(): Promise<number> {
    const successfulNotifications = await prisma.lifecycleNotificationLog.findMany({
      where: {
        status: NotificationStatus.SUCCESS,
      },
    });

    if (successfulNotifications.length === 0) return 0;

    const totalAttempts = successfulNotifications.reduce((sum, n) => sum + n.attempt, 0);
    return totalAttempts / successfulNotifications.length;
  }

  /**
   * Get recent notification history
   */
  async getRecentNotifications(limit: number = 50): Promise<LifecycleNotificationLog[]> {
    return await prisma.lifecycleNotificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: {
        campaignSchedule: {
          select: {
            campaignName: true,
            roundNumber: true,
            scheduledDate: true,
          },
        },
      },
    });
  }

  /**
   * Delete old notification logs (cleanup)
   */
  async deleteOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.lifecycleNotificationLog.deleteMany({
      where: {
        sentAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
