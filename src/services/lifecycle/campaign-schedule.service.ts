/**
 * Campaign Schedule Service
 * Manages lifecycle campaign schedules with automated batch splitting
 */

import { LifecycleCampaignSchedule, CampaignStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface BatchSchedule {
  round: number;
  recipientRange: string;
  recipientCount: number;
  scheduledDate: Date;
  scheduledTime: string;
}

export interface CreateCampaignScheduleParams {
  campaignName: string;
  totalRecipients: number;
  startDate: Date;
  listIdPrefix: string; // e.g., "campaign_batch"
  mailjetListIds: [bigint, bigint, bigint]; // List IDs for rounds 1, 2, 3
  subject: string;
  senderName: string;
  senderEmail: string;
  mailjetDraftIds?: [bigint?, bigint?, bigint?];
}

export class CampaignScheduleService {
  /**
   * Create a campaign schedule with 3 rounds (split into thirds)
   * Automatically schedules on Tuesdays and Thursdays at 9:15 AM UTC
   */
  async createCampaignSchedule(
    params: CreateCampaignScheduleParams
  ): Promise<LifecycleCampaignSchedule[]> {
    const batches = this.calculateBatchSchedule(params.totalRecipients, params.startDate);

    const schedules: LifecycleCampaignSchedule[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const round = batch.round;

      const schedule = await prisma.lifecycleCampaignSchedule.create({
        data: {
          campaignName: params.campaignName,
          roundNumber: round,
          scheduledDate: batch.scheduledDate,
          scheduledTime: batch.scheduledTime,

          // List details
          listName: `${params.listIdPrefix}_${String(round).padStart(3, '0')}`,
          listId: params.mailjetListIds[i],
          recipientCount: batch.recipientCount,
          recipientRange: batch.recipientRange,

          // Campaign details
          subject: params.subject,
          senderName: params.senderName,
          senderEmail: params.senderEmail,
          mailjetDraftId: params.mailjetDraftIds?.[i],

          // Initialize notification status
          notificationStatus: {
            prelaunch: { sent: false, timestamp: null, status: null },
            preflight: { sent: false, timestamp: null, status: null },
            launchWarning: { sent: false, timestamp: null, status: null },
            launchConfirmation: { sent: false, timestamp: null, status: null },
            wrapup: { sent: false, timestamp: null, status: null },
          },

          status: CampaignStatus.SCHEDULED,
        },
      });

      schedules.push(schedule);
    }

    return schedules;
  }

  /**
   * Get a campaign schedule by ID
   */
  async getCampaignSchedule(id: number): Promise<LifecycleCampaignSchedule | null> {
    return await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id },
      include: {
        metrics: true,
        notifications: true,
      },
    });
  }

  /**
   * Get all schedules for a campaign (all 3 rounds)
   */
  async getCampaignSchedulesByName(
    campaignName: string
  ): Promise<LifecycleCampaignSchedule[]> {
    return await prisma.lifecycleCampaignSchedule.findMany({
      where: { campaignName },
      orderBy: { roundNumber: 'asc' },
      include: {
        metrics: true,
        notifications: true,
      },
    });
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(id: number, status: CampaignStatus): Promise<void> {
    await prisma.lifecycleCampaignSchedule.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update notification status for a specific stage
   */
  async updateNotificationStatus(
    id: number,
    stage: 'prelaunch' | 'preflight' | 'launchWarning' | 'launchConfirmation' | 'wrapup',
    status: { sent: boolean; timestamp: Date; status?: string }
  ): Promise<void> {
    const schedule = await this.getCampaignSchedule(id);
    if (!schedule) throw new Error(`Campaign schedule ${id} not found`);

    const notificationStatus = schedule.notificationStatus as any;
    notificationStatus[stage] = status;

    await prisma.lifecycleCampaignSchedule.update({
      where: { id },
      data: { notificationStatus },
    });
  }

  /**
   * Get next scheduled campaign (for scheduler triggers)
   */
  async getNextScheduledCampaign(): Promise<LifecycleCampaignSchedule | null> {
    return await prisma.lifecycleCampaignSchedule.findFirst({
      where: {
        status: {
          in: [CampaignStatus.SCHEDULED, CampaignStatus.READY],
        },
        scheduledDate: {
          gte: new Date(),
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  /**
   * Get campaigns ready for a specific lifecycle stage
   */
  async getCampaignsForStage(
    stage: 'prelaunch' | 'preflight' | 'launchWarning' | 'wrapup',
    currentTime: Date
  ): Promise<LifecycleCampaignSchedule[]> {
    // Calculate time windows for each stage
    const timeWindows = this.calculateStageTimeWindows(stage, currentTime);

    return await prisma.lifecycleCampaignSchedule.findMany({
      where: {
        scheduledDate: {
          gte: timeWindows.start,
          lte: timeWindows.end,
        },
        status: {
          not: CampaignStatus.BLOCKED,
        },
      },
    });
  }

  /**
   * Calculate batch schedule (split into 3 rounds on Tue/Thu)
   */
  private calculateBatchSchedule(
    totalRecipients: number,
    startDate: Date
  ): BatchSchedule[] {
    const batchSize = Math.ceil(totalRecipients / 3);
    const batches: BatchSchedule[] = [];

    let currentDate = this.getNextTuesdayOrThursday(startDate);
    let startPosition = 0;

    for (let round = 1; round <= 3; round++) {
      const endPosition = round === 3 ? totalRecipients : startPosition + batchSize;

      batches.push({
        round,
        recipientRange: `${startPosition + 1}-${endPosition}`,
        recipientCount: endPosition - startPosition,
        scheduledDate: currentDate,
        scheduledTime: '09:15', // 9:15 AM UTC
      });

      currentDate = this.getNextTuesdayOrThursday(
        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      );
      startPosition = endPosition;
    }

    return batches;
  }

  /**
   * Get next Tuesday or Thursday from a given date
   */
  private getNextTuesdayOrThursday(fromDate: Date): Date {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay();

    // Tuesday = 2, Thursday = 4
    let daysToAdd = 0;

    if (dayOfWeek === 0) {
      // Sunday -> Tuesday
      daysToAdd = 2;
    } else if (dayOfWeek === 1) {
      // Monday -> Tuesday
      daysToAdd = 1;
    } else if (dayOfWeek === 2) {
      // Tuesday -> Thursday (unless it's the same day)
      daysToAdd = 2;
    } else if (dayOfWeek === 3) {
      // Wednesday -> Thursday
      daysToAdd = 1;
    } else if (dayOfWeek === 4) {
      // Thursday -> next Tuesday
      daysToAdd = 5;
    } else if (dayOfWeek === 5) {
      // Friday -> next Tuesday
      daysToAdd = 4;
    } else {
      // Saturday -> next Tuesday
      daysToAdd = 3;
    }

    date.setDate(date.getDate() + daysToAdd);
    date.setUTCHours(9, 15, 0, 0); // 9:15 AM UTC

    return date;
  }

  /**
   * Calculate time windows for lifecycle stages
   */
  private calculateStageTimeWindows(
    stage: string,
    currentTime: Date
  ): { start: Date; end: Date } {
    const now = currentTime.getTime();

    switch (stage) {
      case 'prelaunch':
        // T-21 hours (3 PM UTC day before)
        // Window: 21-20 hours before launch
        return {
          start: new Date(now - 21 * 60 * 60 * 1000),
          end: new Date(now - 20 * 60 * 60 * 1000),
        };

      case 'preflight':
        // T-3.25 hours (6 AM UTC launch day)
        // Window: 3.25-3 hours before launch
        return {
          start: new Date(now - 3.25 * 60 * 60 * 1000),
          end: new Date(now - 3 * 60 * 60 * 1000),
        };

      case 'launchWarning':
        // T-15 minutes (9:00 AM UTC)
        // Window: 15-10 minutes before launch
        return {
          start: new Date(now - 15 * 60 * 1000),
          end: new Date(now - 10 * 60 * 1000),
        };

      case 'wrapup':
        // T+30 minutes (9:45 AM UTC)
        // Window: 30-40 minutes after launch
        return {
          start: new Date(now + 30 * 60 * 1000),
          end: new Date(now + 40 * 60 * 1000),
        };

      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  /**
   * Set mailjet campaign ID after launch
   */
  async setMailjetCampaignId(id: number, campaignId: bigint): Promise<void> {
    await prisma.lifecycleCampaignSchedule.update({
      where: { id },
      data: { mailjetCampaignId: campaignId },
    });
  }
}
