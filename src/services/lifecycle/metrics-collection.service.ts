/**
 * Metrics Collection Service
 * Collects and stores campaign metrics from MailJet with AI analysis
 */

import { LifecycleCampaignSchedule, LifecycleCampaignMetrics } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';
import {
  DeliveryAnalysisAgent,
  ComparisonAgent,
  RecommendationAgent,
  ReportFormattingAgent,
  type AgentContext,
  type DeliveryMetrics
} from './agents';
import { CampaignMetricsService } from './campaign-metrics.service';

export interface MetricsCollectionResult {
  metrics: LifecycleCampaignMetrics;
  aiAnalysis: {
    deliveryAnalysis: {
      overallPerformance: string;
      performanceScore: number;
      issues: number;
    };
    comparison?: {
      trend: string;
      deliveryRateDelta?: number;
      bounceRateDelta?: number;
    };
    recommendations: string[];
    insights: string[];
  };
  collectedAt: Date;
}

export class MetricsCollectionService {
  private mailjetClient: MailjetAgentClient;
  private metricsService: CampaignMetricsService;

  // AI Agents
  private deliveryAnalysisAgent: DeliveryAnalysisAgent;
  private comparisonAgent: ComparisonAgent;
  private recommendationAgent: RecommendationAgent;
  private reportFormattingAgent: ReportFormattingAgent;

  constructor() {
    this.mailjetClient = new MailjetAgentClient();
    this.metricsService = new CampaignMetricsService();

    this.deliveryAnalysisAgent = new DeliveryAnalysisAgent();
    this.comparisonAgent = new ComparisonAgent();
    this.recommendationAgent = new RecommendationAgent();
    this.reportFormattingAgent = new ReportFormattingAgent();
  }

  /**
   * Collect metrics for a campaign schedule with AI analysis
   */
  async collectMetrics(campaignScheduleId: number): Promise<MetricsCollectionResult> {
    logger.info('[MetricsCollection] Collecting metrics', { campaignScheduleId });

    const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id: campaignScheduleId }
    });

    if (!schedule) {
      throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
    }

    if (!schedule.mailjetCampaignId) {
      throw new Error(`Campaign ${campaignScheduleId} has not been sent yet`);
    }

    // Step 1: Fetch metrics from MailJet
    const mailjetMetrics = await this.mailjetClient.getDetailedCampaignStatistics(
      schedule.mailjetCampaignId
    );

    // Step 2: Save metrics to database
    const savedMetrics = await this.metricsService.saveMetrics(
      campaignScheduleId,
      schedule.mailjetCampaignId,
      {
        processed: mailjetMetrics.processed,
        delivered: mailjetMetrics.delivered,
        bounced: mailjetMetrics.bounced,
        hardBounces: mailjetMetrics.hardBounces,
        softBounces: mailjetMetrics.softBounces,
        blocked: mailjetMetrics.blocked,
        queued: mailjetMetrics.queued,
        opened: mailjetMetrics.opened,
        clicked: mailjetMetrics.clicked,
        unsubscribed: mailjetMetrics.unsubscribed,
        complained: mailjetMetrics.complained,
        sendStartAt: mailjetMetrics.sendStartAt,
        sendEndAt: mailjetMetrics.sendEndAt
      }
    );

    // Step 3: Run AI analysis
    const agentContext: AgentContext = {
      campaignName: schedule.campaignName,
      roundNumber: schedule.roundNumber,
      timestamp: new Date()
    };

    const deliveryMetrics: DeliveryMetrics = {
      processed: savedMetrics.processed,
      delivered: savedMetrics.delivered,
      bounced: savedMetrics.bounced,
      hardBounces: savedMetrics.hardBounces,
      softBounces: savedMetrics.softBounces,
      blocked: savedMetrics.blocked,
      queued: savedMetrics.queued,
      opened: savedMetrics.opened,
      clicked: savedMetrics.clicked,
      unsubscribed: savedMetrics.unsubscribed,
      complained: savedMetrics.complained,
      deliveryRate: savedMetrics.deliveryRate,
      bounceRate: savedMetrics.bounceRate,
      hardBounceRate: savedMetrics.hardBounceRate,
      softBounceRate: savedMetrics.softBounceRate,
      openRate: savedMetrics.openRate,
      clickRate: savedMetrics.clickRate,
      sendStartAt: savedMetrics.sendStartAt || undefined,
      sendEndAt: savedMetrics.sendEndAt || undefined
    };

    // Delivery Analysis
    const deliveryAnalysis = await this.deliveryAnalysisAgent.analyze(
      deliveryMetrics,
      agentContext
    );

    // Comparison Analysis (if previous round exists)
    let comparisonAnalysis = null;
    let comparisonSummary = null;

    if (schedule.roundNumber > 1) {
      const previousMetrics = await this.metricsService.getPreviousRoundMetrics(
        schedule.campaignName,
        schedule.roundNumber
      );

      if (previousMetrics) {
        const previousDeliveryMetrics: DeliveryMetrics = {
          processed: previousMetrics.processed,
          delivered: previousMetrics.delivered,
          bounced: previousMetrics.bounced,
          hardBounces: previousMetrics.hardBounces,
          softBounces: previousMetrics.softBounces,
          blocked: previousMetrics.blocked,
          queued: previousMetrics.queued,
          opened: previousMetrics.opened,
          clicked: previousMetrics.clicked,
          unsubscribed: previousMetrics.unsubscribed,
          complained: previousMetrics.complained,
          deliveryRate: previousMetrics.deliveryRate,
          bounceRate: previousMetrics.bounceRate,
          hardBounceRate: previousMetrics.hardBounceRate,
          softBounceRate: previousMetrics.softBounceRate,
          openRate: previousMetrics.openRate,
          clickRate: previousMetrics.clickRate
        };

        comparisonAnalysis = await this.comparisonAgent.compare(
          {
            currentRound: {
              roundNumber: schedule.roundNumber,
              metrics: deliveryMetrics
            },
            previousRound: {
              roundNumber: schedule.roundNumber - 1,
              metrics: previousDeliveryMetrics
            }
          },
          agentContext
        );

        // Calculate deltas
        const deltas = await this.metricsService.calculateDeltas(
          savedMetrics.id,
          previousMetrics.id
        );

        comparisonSummary = {
          trend: comparisonAnalysis.trend,
          deliveryRateDelta: deltas.deliveryRate,
          bounceRateDelta: deltas.bounceRate
        };
      }
    } else {
      // First round - no comparison, just baseline
      comparisonAnalysis = await this.comparisonAgent.compare(
        {
          currentRound: {
            roundNumber: schedule.roundNumber,
            metrics: deliveryMetrics
          }
        },
        agentContext
      );
    }

    // Generate recommendations if we have comparison data
    let formattedReport = null;

    if (comparisonAnalysis) {
      // For recommendations, we need a list quality analysis
      // For wrap-up, we'll use a simplified version based on delivery metrics
      const simplifiedListQuality = {
        listHealthScore: deliveryAnalysis.performanceScore,
        listQualityGrade: this.performanceToGrade(deliveryAnalysis.overallPerformance),
        subscriberEngagement: savedMetrics.openRate || 0,
        riskFactors: deliveryAnalysis.issuesIdentified.map(issue => ({
          factor: issue.issue,
          severity: issue.severity === 'critical' || issue.severity === 'high' ? 'high' as const :
                   issue.severity === 'medium' ? 'medium' as const : 'low' as const,
          description: issue.impact,
          recommendation: issue.suggestedFix
        })),
        senderReputationAssessment: {
          score: deliveryAnalysis.performanceScore,
          status: deliveryAnalysis.performanceScore > 80 ? 'healthy' as const :
                  deliveryAnalysis.performanceScore > 60 ? 'warning' as const : 'critical' as const,
          trend: comparisonAnalysis.trend,
          recommendations: deliveryAnalysis.recommendations
        },
        overallRecommendation: `Campaign performance: ${deliveryAnalysis.overallPerformance}`,
        actionItems: deliveryAnalysis.recommendations,
        estimatedDeliverability: savedMetrics.deliveryRate
      };

      const recommendations = await this.recommendationAgent.generateRecommendations(
        {
          listQualityAnalysis: simplifiedListQuality,
          deliveryAnalysis,
          comparisonAnalysis,
          campaignMetadata: {
            campaignName: schedule.campaignName,
            roundNumber: schedule.roundNumber,
            totalRounds: 3,
            recipientCount: schedule.recipientCount,
            nextRoundScheduled: schedule.roundNumber < 3 ?
              await this.getNextRoundScheduledDate(schedule.campaignName, schedule.roundNumber + 1) :
              undefined
          }
        },
        agentContext
      );

      formattedReport = await this.reportFormattingAgent.formatReport(
        {
          listQuality: simplifiedListQuality,
          deliveryAnalysis,
          comparison: comparisonAnalysis,
          recommendations,
          stage: 'wrapup'
        },
        agentContext
      );
    }

    const result: MetricsCollectionResult = {
      metrics: savedMetrics,
      aiAnalysis: {
        deliveryAnalysis: {
          overallPerformance: deliveryAnalysis.overallPerformance,
          performanceScore: deliveryAnalysis.performanceScore,
          issues: deliveryAnalysis.issuesIdentified.length
        },
        comparison: comparisonSummary || undefined,
        recommendations: formattedReport?.actionableRecommendations || deliveryAnalysis.recommendations,
        insights: formattedReport?.aiInsights || [
          ...deliveryAnalysis.positiveIndicators,
          ...deliveryAnalysis.issuesIdentified.map(i => i.issue)
        ]
      },
      collectedAt: new Date()
    };

    logger.info('[MetricsCollection] Metrics collected and analyzed', {
      campaignScheduleId,
      deliveryRate: savedMetrics.deliveryRate,
      bounceRate: savedMetrics.bounceRate,
      performanceScore: deliveryAnalysis.performanceScore
    });

    return result;
  }

  /**
   * Collect metrics without AI analysis (faster)
   */
  async collectMetricsOnly(campaignScheduleId: number): Promise<LifecycleCampaignMetrics> {
    logger.info('[MetricsCollection] Collecting metrics only', { campaignScheduleId });

    const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id: campaignScheduleId }
    });

    if (!schedule) {
      throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
    }

    if (!schedule.mailjetCampaignId) {
      throw new Error(`Campaign ${campaignScheduleId} has not been sent yet`);
    }

    const mailjetMetrics = await this.mailjetClient.getDetailedCampaignStatistics(
      schedule.mailjetCampaignId
    );

    const savedMetrics = await this.metricsService.saveMetrics(
      campaignScheduleId,
      schedule.mailjetCampaignId,
      {
        processed: mailjetMetrics.processed,
        delivered: mailjetMetrics.delivered,
        bounced: mailjetMetrics.bounced,
        hardBounces: mailjetMetrics.hardBounces,
        softBounces: mailjetMetrics.softBounces,
        blocked: mailjetMetrics.blocked,
        queued: mailjetMetrics.queued,
        opened: mailjetMetrics.opened,
        clicked: mailjetMetrics.clicked,
        unsubscribed: mailjetMetrics.unsubscribed,
        complained: mailjetMetrics.complained,
        sendStartAt: mailjetMetrics.sendStartAt,
        sendEndAt: mailjetMetrics.sendEndAt
      }
    );

    return savedMetrics;
  }

  /**
   * Helper: Convert performance string to grade
   */
  private performanceToGrade(performance: string): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    switch (performance) {
      case 'excellent': return 'excellent';
      case 'good': return 'good';
      case 'average': return 'fair';
      case 'poor': return 'poor';
      case 'critical': return 'critical';
      default: return 'fair';
    }
  }

  /**
   * Helper: Get next round scheduled date
   */
  private async getNextRoundScheduledDate(
    campaignName: string,
    nextRoundNumber: number
  ): Promise<Date | undefined> {
    const nextSchedule = await prisma.lifecycleCampaignSchedule.findFirst({
      where: {
        campaignName,
        roundNumber: nextRoundNumber
      }
    });

    return nextSchedule?.scheduledDate;
  }
}
