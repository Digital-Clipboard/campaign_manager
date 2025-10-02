/**
 * Campaign Metrics Service
 * Collects and stores campaign metrics from MailJet API
 */

import { LifecycleCampaignMetrics } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CampaignMetricsData {
  processed: number;
  delivered: number;
  bounced: number;
  hardBounces: number;
  softBounces: number;
  blocked: number;
  queued: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;
  sendStartAt?: Date;
  sendEndAt?: Date;
}

export interface MetricDeltas {
  deliveryRate: number;
  bounceRate: number;
  hardBounceRate: number;
  openRate?: number;
  clickRate?: number;
}

export class CampaignMetricsService {
  /**
   * Save campaign metrics to database
   */
  async saveMetrics(
    campaignScheduleId: number,
    mailjetCampaignId: bigint,
    metricsData: CampaignMetricsData
  ): Promise<LifecycleCampaignMetrics> {
    // Calculate rates
    const rates = this.calculateRates(metricsData);

    return await prisma.lifecycleCampaignMetrics.create({
      data: {
        campaignScheduleId,
        mailjetCampaignId,

        // Raw metrics
        processed: metricsData.processed,
        delivered: metricsData.delivered,
        bounced: metricsData.bounced,
        hardBounces: metricsData.hardBounces,
        softBounces: metricsData.softBounces,
        blocked: metricsData.blocked,
        queued: metricsData.queued,
        opened: metricsData.opened,
        clicked: metricsData.clicked,
        unsubscribed: metricsData.unsubscribed,
        complained: metricsData.complained,

        // Calculated rates
        deliveryRate: rates.deliveryRate,
        bounceRate: rates.bounceRate,
        hardBounceRate: rates.hardBounceRate,
        softBounceRate: rates.softBounceRate,
        openRate: rates.openRate,
        clickRate: rates.clickRate,

        // Timestamps
        sendStartAt: metricsData.sendStartAt,
        sendEndAt: metricsData.sendEndAt,
      },
    });
  }

  /**
   * Get metrics for a campaign schedule
   */
  async getMetrics(campaignScheduleId: number): Promise<LifecycleCampaignMetrics | null> {
    return await prisma.lifecycleCampaignMetrics.findFirst({
      where: { campaignScheduleId },
      orderBy: { collectedAt: 'desc' },
    });
  }

  /**
   * Get metrics by MailJet campaign ID
   */
  async getMetricsByMailjetId(mailjetCampaignId: bigint): Promise<LifecycleCampaignMetrics | null> {
    return await prisma.lifecycleCampaignMetrics.findFirst({
      where: { mailjetCampaignId },
      orderBy: { collectedAt: 'desc' },
    });
  }

  /**
   * Get previous round metrics for comparison
   */
  async getPreviousRoundMetrics(
    campaignName: string,
    currentRound: number
  ): Promise<LifecycleCampaignMetrics | null> {
    if (currentRound <= 1) return null;

    const previousSchedule = await prisma.lifecycleCampaignSchedule.findFirst({
      where: {
        campaignName,
        roundNumber: currentRound - 1,
      },
      include: {
        metrics: {
          orderBy: { collectedAt: 'desc' },
          take: 1,
        },
      },
    });

    return previousSchedule?.metrics[0] || null;
  }

  /**
   * Calculate deltas between current and previous metrics
   */
  calculateDeltas(
    current: LifecycleCampaignMetrics,
    previous: LifecycleCampaignMetrics
  ): MetricDeltas {
    return {
      deliveryRate: current.deliveryRate - previous.deliveryRate,
      bounceRate: current.bounceRate - previous.bounceRate,
      hardBounceRate: current.hardBounceRate - previous.hardBounceRate,
      openRate:
        current.openRate !== null && previous.openRate !== null
          ? current.openRate - previous.openRate
          : undefined,
      clickRate:
        current.clickRate !== null && previous.clickRate !== null
          ? current.clickRate - previous.clickRate
          : undefined,
    };
  }

  /**
   * Get metrics for all rounds of a campaign
   */
  async getAllRoundMetrics(campaignName: string): Promise<LifecycleCampaignMetrics[]> {
    const schedules = await prisma.lifecycleCampaignSchedule.findMany({
      where: { campaignName },
      orderBy: { roundNumber: 'asc' },
      include: {
        metrics: {
          orderBy: { collectedAt: 'desc' },
          take: 1,
        },
      },
    });

    return schedules.flatMap((s) => s.metrics);
  }

  /**
   * Calculate rates from raw metrics
   */
  private calculateRates(metrics: CampaignMetricsData): {
    deliveryRate: number;
    bounceRate: number;
    hardBounceRate: number;
    softBounceRate: number;
    openRate: number | null;
    clickRate: number | null;
  } {
    const processed = metrics.processed || 1; // Avoid division by zero
    const delivered = metrics.delivered || 0;

    return {
      deliveryRate: (delivered / processed) * 100,
      bounceRate: (metrics.bounced / processed) * 100,
      hardBounceRate: (metrics.hardBounces / processed) * 100,
      softBounceRate: (metrics.softBounces / processed) * 100,
      openRate: delivered > 0 ? (metrics.opened / delivered) * 100 : null,
      clickRate: delivered > 0 ? (metrics.clicked / delivered) * 100 : null,
    };
  }

  /**
   * Get average metrics across all campaigns
   */
  async getAverageMetrics(): Promise<{
    avgDeliveryRate: number;
    avgBounceRate: number;
    avgOpenRate: number;
    avgClickRate: number;
  }> {
    const result = await prisma.lifecycleCampaignMetrics.aggregate({
      _avg: {
        deliveryRate: true,
        bounceRate: true,
        openRate: true,
        clickRate: true,
      },
    });

    return {
      avgDeliveryRate: result._avg.deliveryRate || 0,
      avgBounceRate: result._avg.bounceRate || 0,
      avgOpenRate: result._avg.openRate || 0,
      avgClickRate: result._avg.clickRate || 0,
    };
  }

  /**
   * Get metrics summary for a campaign (all rounds combined)
   */
  async getCampaignSummary(campaignName: string): Promise<{
    totalProcessed: number;
    totalDelivered: number;
    totalBounced: number;
    avgDeliveryRate: number;
    avgBounceRate: number;
    avgOpenRate: number;
    roundCount: number;
  }> {
    const metrics = await this.getAllRoundMetrics(campaignName);

    if (metrics.length === 0) {
      return {
        totalProcessed: 0,
        totalDelivered: 0,
        totalBounced: 0,
        avgDeliveryRate: 0,
        avgBounceRate: 0,
        avgOpenRate: 0,
        roundCount: 0,
      };
    }

    const totals = metrics.reduce(
      (acc, m) => ({
        processed: acc.processed + m.processed,
        delivered: acc.delivered + m.delivered,
        bounced: acc.bounced + m.bounced,
        deliveryRate: acc.deliveryRate + m.deliveryRate,
        bounceRate: acc.bounceRate + m.bounceRate,
        openRate: acc.openRate + (m.openRate || 0),
      }),
      { processed: 0, delivered: 0, bounced: 0, deliveryRate: 0, bounceRate: 0, openRate: 0 }
    );

    return {
      totalProcessed: totals.processed,
      totalDelivered: totals.delivered,
      totalBounced: totals.bounced,
      avgDeliveryRate: totals.deliveryRate / metrics.length,
      avgBounceRate: totals.bounceRate / metrics.length,
      avgOpenRate: totals.openRate / metrics.length,
      roundCount: metrics.length,
    };
  }
}
