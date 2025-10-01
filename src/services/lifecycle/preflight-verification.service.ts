/**
 * Pre-Flight Verification Service
 * Verifies campaign readiness before launch with AI-powered analysis
 */

import { PrismaClient, LifecycleCampaignSchedule } from '@prisma/client';
import { logger } from '@/utils/logger';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';
import {
  ListQualityAgent,
  DeliveryAnalysisAgent,
  ComparisonAgent,
  RecommendationAgent,
  ReportFormattingAgent,
  type AgentContext
} from './agents';
import { CampaignMetricsService } from './campaign-metrics.service';

const prisma = new PrismaClient();

export interface PreFlightResult {
  isReady: boolean;
  status: 'ready' | 'warning' | 'blocked';
  checks: {
    hasSubject: boolean;
    hasSender: boolean;
    hasContactList: boolean;
    hasContent: boolean;
    listNotEmpty: boolean;
    noBlockedContacts: boolean;
  };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
  }>;
  aiAnalysis: {
    listQualityScore: number;
    previousRoundMetrics?: {
      deliveryRate: number;
      bounceRate: number;
      openRate?: number;
    };
    recommendations: string[];
    insights: string[];
    warnings: string[];
  };
  performedAt: Date;
}

export class PreFlightVerificationService {
  private mailjetClient: MailjetAgentClient;
  private metricsService: CampaignMetricsService;

  // AI Agents
  private listQualityAgent: ListQualityAgent;
  private deliveryAnalysisAgent: DeliveryAnalysisAgent;
  private comparisonAgent: ComparisonAgent;
  private recommendationAgent: RecommendationAgent;
  private reportFormattingAgent: ReportFormattingAgent;

  constructor() {
    this.mailjetClient = new MailjetAgentClient();
    this.metricsService = new CampaignMetricsService();

    this.listQualityAgent = new ListQualityAgent();
    this.deliveryAnalysisAgent = new DeliveryAnalysisAgent();
    this.comparisonAgent = new ComparisonAgent();
    this.recommendationAgent = new RecommendationAgent();
    this.reportFormattingAgent = new ReportFormattingAgent();
  }

  /**
   * Perform comprehensive pre-flight verification
   */
  async verify(campaignScheduleId: number): Promise<PreFlightResult> {
    logger.info('[PreFlightVerification] Starting verification', { campaignScheduleId });

    const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id: campaignScheduleId }
    });

    if (!schedule) {
      throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
    }

    // Step 1: Basic readiness checks via MailJet
    const readinessResult = schedule.mailjetDraftId
      ? await this.mailjetClient.verifyCampaignReadiness(schedule.mailjetDraftId)
      : {
          isReady: false,
          checks: {
            hasSubject: false,
            hasSender: false,
            hasContactList: false,
            hasContent: false,
            listNotEmpty: false,
            noBlockedContacts: false
          },
          issues: [{ severity: 'error' as const, message: 'No draft ID configured' }]
        };

    // Step 2: Get list statistics for AI analysis
    const listStats = await this.mailjetClient.getListStatistics(schedule.listId);

    // Step 3: Get sender reputation
    const senderReputation = await this.mailjetClient.getSenderReputation(schedule.senderEmail);

    // Step 4: Run AI agents for analysis
    const agentContext: AgentContext = {
      campaignName: schedule.campaignName,
      roundNumber: schedule.roundNumber,
      timestamp: new Date()
    };

    // List Quality Analysis
    const listQualityAnalysis = await this.listQualityAgent.analyze(
      {
        listId: schedule.listId,
        totalContacts: listStats.totalContacts,
        subscribedContacts: listStats.subscribedContacts,
        unsubscribedContacts: listStats.unsubscribedContacts,
        blockedContacts: listStats.blockedContacts,
        recentBounces: listStats.recentBounces,
        senderEmail: schedule.senderEmail,
        senderReputation
      },
      agentContext
    );

    // Get previous round metrics if available
    let previousRoundMetrics = null;
    let comparisonAnalysis = null;
    let deliveryAnalysis = null;

    if (schedule.roundNumber > 1) {
      const previousMetrics = await this.metricsService.getPreviousRoundMetrics(
        schedule.campaignName,
        schedule.roundNumber
      );

      if (previousMetrics) {
        previousRoundMetrics = {
          deliveryRate: previousMetrics.deliveryRate,
          bounceRate: previousMetrics.bounceRate,
          openRate: previousMetrics.openRate || undefined
        };

        // Run delivery analysis on previous round
        deliveryAnalysis = await this.deliveryAnalysisAgent.analyze(
          {
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
            clickRate: previousMetrics.clickRate,
            sendStartAt: previousMetrics.sendStartAt || undefined,
            sendEndAt: previousMetrics.sendEndAt || undefined
          },
          agentContext
        );

        // Run comparison analysis (simulated current vs previous)
        // Note: For pre-flight, we're comparing previous round to the one before it
        comparisonAnalysis = await this.comparisonAgent.compare(
          {
            currentRound: {
              roundNumber: schedule.roundNumber - 1,
              metrics: {
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
              }
            }
          },
          agentContext
        );
      }
    }

    // If we have all analyses, generate recommendations
    let recommendations = null;
    let formattedReport = null;

    if (deliveryAnalysis && comparisonAnalysis) {
      recommendations = await this.recommendationAgent.generateRecommendations(
        {
          listQualityAnalysis,
          deliveryAnalysis,
          comparisonAnalysis,
          campaignMetadata: {
            campaignName: schedule.campaignName,
            roundNumber: schedule.roundNumber,
            totalRounds: 3,
            recipientCount: schedule.recipientCount,
            nextRoundScheduled: schedule.scheduledDate
          }
        },
        agentContext
      );

      formattedReport = await this.reportFormattingAgent.formatReport(
        {
          listQuality: listQualityAnalysis,
          deliveryAnalysis,
          comparison: comparisonAnalysis,
          recommendations,
          stage: 'preflight'
        },
        agentContext
      );
    }

    // Determine overall status
    const hasErrors = readinessResult.issues.some(i => i.severity === 'error');
    const hasWarnings = readinessResult.issues.some(i => i.severity === 'warning');
    const listQualityPoor = listQualityAnalysis.listHealthScore < 50;
    const allChecksPassed = Object.values(readinessResult.checks).every(v => v === true);

    let status: 'ready' | 'warning' | 'blocked';
    if (hasErrors || !allChecksPassed || listQualityPoor) {
      status = 'blocked';
    } else if (hasWarnings || listQualityAnalysis.listHealthScore < 70) {
      status = 'warning';
    } else {
      status = 'ready';
    }

    const result: PreFlightResult = {
      isReady: status === 'ready',
      status,
      checks: readinessResult.checks,
      issues: readinessResult.issues,
      aiAnalysis: {
        listQualityScore: listQualityAnalysis.listHealthScore,
        previousRoundMetrics,
        recommendations: formattedReport?.actionableRecommendations || listQualityAnalysis.actionItems,
        insights: formattedReport?.aiInsights || [listQualityAnalysis.overallRecommendation],
        warnings: formattedReport?.warnings || listQualityAnalysis.riskFactors.map(r => r.description)
      },
      performedAt: new Date()
    };

    logger.info('[PreFlightVerification] Verification complete', {
      campaignScheduleId,
      status,
      isReady: result.isReady,
      listQualityScore: listQualityAnalysis.listHealthScore
    });

    return result;
  }

  /**
   * Quick verification without AI analysis (for manual checks)
   */
  async quickVerify(campaignScheduleId: number): Promise<{
    isReady: boolean;
    checks: PreFlightResult['checks'];
    issues: PreFlightResult['issues'];
  }> {
    logger.info('[PreFlightVerification] Quick verification', { campaignScheduleId });

    const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
      where: { id: campaignScheduleId }
    });

    if (!schedule) {
      throw new Error(`Campaign schedule ${campaignScheduleId} not found`);
    }

    if (!schedule.mailjetDraftId) {
      return {
        isReady: false,
        checks: {
          hasSubject: false,
          hasSender: false,
          hasContactList: false,
          hasContent: false,
          listNotEmpty: false,
          noBlockedContacts: false
        },
        issues: [{ severity: 'error', message: 'No draft ID configured' }]
      };
    }

    const result = await this.mailjetClient.verifyCampaignReadiness(schedule.mailjetDraftId);

    return {
      isReady: result.isReady,
      checks: result.checks,
      issues: result.issues
    };
  }
}
