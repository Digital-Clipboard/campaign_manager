/**
 * Recommendation Agent
 * Synthesizes insights from other agents and provides strategic recommendations
 */

import { BaseAgent, AgentContext } from './base-agent';
import { logger } from '@/utils/logger';
import { ListQualityAnalysis } from './list-quality-agent';
import { DeliveryAnalysisResult } from './delivery-analysis-agent';
import { ComparisonResult } from './comparison-agent';

export interface RecommendationInput {
  listQualityAnalysis: ListQualityAnalysis;
  deliveryAnalysis: DeliveryAnalysisResult;
  comparisonAnalysis: ComparisonResult;
  campaignMetadata: {
    campaignName: string;
    roundNumber: number;
    totalRounds: number;
    recipientCount: number;
    nextRoundScheduled?: Date;
  };
}

export interface RecommendationResult {
  executiveSummary: string;
  overallHealth: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    trend: 'improving' | 'stable' | 'declining';
  };
  prioritizedRecommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: 'list_hygiene' | 'delivery_optimization' | 'engagement' | 'sender_reputation' | 'technical';
    recommendation: string;
    rationale: string;
    expectedImpact: string;
    implementationSteps: string[];
    timeframe: 'immediate' | 'before_next_round' | 'long_term';
  }>;
  nextRoundStrategy?: {
    focus: string;
    keyActions: string[];
    successMetrics: string[];
    riskMitigation: string[];
  };
  warnings: Array<{
    severity: 'critical' | 'high' | 'medium';
    warning: string;
    consequence: string;
    action: string;
  }>;
  opportunities: Array<{
    opportunity: string;
    potentialGain: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  benchmarkComparison: {
    vsIndustryStandard: string;
    vsPreviousRounds: string;
    positionAssessment: string;
  };
}

export class RecommendationAgent extends BaseAgent {
  constructor() {
    super('RecommendationAgent');
  }

  async generateRecommendations(
    input: RecommendationInput,
    context: AgentContext
  ): Promise<RecommendationResult> {
    logger.info('[RecommendationAgent] Generating strategic recommendations', {
      campaignName: input.campaignMetadata.campaignName,
      roundNumber: input.campaignMetadata.roundNumber
    });

    const systemPrompt = `You are a senior email marketing strategist with expertise in campaign optimization and deliverability.

Your role is to:
1. Synthesize insights from list quality, delivery, and comparison analyses
2. Provide strategic, actionable recommendations prioritized by impact
3. Identify critical issues that need immediate attention
4. Develop strategies for improving future rounds
5. Balance short-term fixes with long-term improvements

Recommendation Guidelines:
- Prioritize based on impact and urgency
- Be specific and actionable
- Consider resource constraints
- Focus on what will move the needle
- Account for campaign lifecycle (which round, how many remaining)
- Address root causes, not just symptoms

Priority Levels:
- Critical: Immediate action required, significant risk if not addressed
- High: Important for next round success
- Medium: Beneficial but not urgent
- Low: Nice-to-have optimizations

Response must be valid JSON matching the RecommendationResult interface.`;

    const userPrompt = `Synthesize the following analyses and provide strategic recommendations:

CAMPAIGN METADATA:
- Campaign: ${input.campaignMetadata.campaignName}
- Round: ${input.campaignMetadata.roundNumber} of ${input.campaignMetadata.totalRounds}
- Recipients: ${input.campaignMetadata.recipientCount}
${input.campaignMetadata.nextRoundScheduled ? `- Next Round: ${input.campaignMetadata.nextRoundScheduled.toLocaleDateString()}` : ''}

LIST QUALITY ANALYSIS:
- List Health Score: ${input.listQualityAnalysis.listHealthScore}/100
- Quality Grade: ${input.listQualityAnalysis.listQualityGrade}
- Subscriber Engagement: ${input.listQualityAnalysis.subscriberEngagement}%
- Estimated Deliverability: ${input.listQualityAnalysis.estimatedDeliverability}%
- Risk Factors: ${input.listQualityAnalysis.riskFactors.length} identified
- Sender Reputation: ${input.listQualityAnalysis.senderReputationAssessment.status} (${input.listQualityAnalysis.senderReputationAssessment.score}/100)

DELIVERY ANALYSIS:
- Overall Performance: ${input.deliveryAnalysis.overallPerformance}
- Performance Score: ${input.deliveryAnalysis.performanceScore}/100
- Delivery Rate Status: ${input.deliveryAnalysis.deliveryMetricsAssessment.deliveryRate.status}
- Bounce Rate Status: ${input.deliveryAnalysis.deliveryMetricsAssessment.bounceRate.status}
- Engagement Status: ${input.deliveryAnalysis.deliveryMetricsAssessment.engagementRate.status}
- Issues Identified: ${input.deliveryAnalysis.issuesIdentified.length}
- Patterns Detected: ${input.deliveryAnalysis.patternDetection.length}

COMPARISON ANALYSIS:
- Trend: ${input.comparisonAnalysis.trend}
- Confidence: ${input.comparisonAnalysis.trendConfidence}
- Performance Trajectory: ${input.comparisonAnalysis.performanceTrajectory}
- Key Findings: ${input.comparisonAnalysis.keyFindings.length}
${input.comparisonAnalysis.nextRoundPrediction ? `
Next Round Prediction:
- Expected Delivery Rate: ${input.comparisonAnalysis.nextRoundPrediction.expectedDeliveryRate}%
- Expected Bounce Rate: ${input.comparisonAnalysis.nextRoundPrediction.expectedBounceRate}%
- Confidence: ${input.comparisonAnalysis.nextRoundPrediction.confidenceLevel}
` : ''}

Provide comprehensive strategic recommendations in JSON format with all required fields.
${input.campaignMetadata.roundNumber < input.campaignMetadata.totalRounds ? 'Include nextRoundStrategy with specific focus areas and actions.' : 'This is the final round, focus on overall campaign learnings.'}`;

    const response = await this.generate(systemPrompt, userPrompt, context);
    const recommendations = this.parseJSON<RecommendationResult>(response);

    this.validateResponse(recommendations, [
      'executiveSummary',
      'overallHealth',
      'prioritizedRecommendations',
      'warnings',
      'opportunities',
      'benchmarkComparison'
    ]);

    logger.info('[RecommendationAgent] Recommendations generated', {
      overallHealthScore: recommendations.overallHealth.score,
      recommendationsCount: recommendations.prioritizedRecommendations.length,
      warningsCount: recommendations.warnings.length
    });

    return recommendations;
  }
}
