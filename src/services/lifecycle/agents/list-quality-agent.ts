/**
 * List Quality Agent
 * Analyzes list health, bounce rates, and sender reputation
 */

import { BaseAgent, AgentContext } from './base-agent';
import { logger } from '@/utils/logger';

export interface ListQualityInput {
  listId: bigint;
  totalContacts: number;
  subscribedContacts: number;
  unsubscribedContacts: number;
  blockedContacts: number;
  recentBounces: number;
  senderEmail: string;
  senderReputation?: {
    reputationScore: number;
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplaints: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  };
}

export interface ListQualityAnalysis {
  listHealthScore: number; // 0-100
  listQualityGrade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  subscriberEngagement: number; // percentage
  riskFactors: Array<{
    factor: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
  senderReputationAssessment: {
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    trend: string;
    recommendations: string[];
  };
  overallRecommendation: string;
  actionItems: string[];
  estimatedDeliverability: number; // percentage
}

export class ListQualityAgent extends BaseAgent {
  constructor() {
    super('ListQualityAgent');
  }

  async analyze(
    input: ListQualityInput,
    context: AgentContext
  ): Promise<ListQualityAnalysis> {
    logger.info('[ListQualityAgent] Analyzing list quality', {
      listId: input.listId.toString(),
      totalContacts: input.totalContacts
    });

    const systemPrompt = `You are an expert email deliverability analyst specializing in list quality assessment.

Your role is to:
1. Evaluate the health of email contact lists
2. Assess bounce rates and their impact on deliverability
3. Analyze sender reputation trends
4. Identify risk factors that could harm campaign performance
5. Provide actionable recommendations for list hygiene

Guidelines:
- Be specific and data-driven in your analysis
- Prioritize high-impact issues
- Consider industry benchmarks (typical delivery rate: 95-98%, bounce rate: <2%)
- Assess sender reputation holistically
- Provide concrete, actionable recommendations

Response must be valid JSON matching the ListQualityAnalysis interface.`;

    const userPrompt = `Analyze the following email list and sender reputation:

List Statistics:
- Total Contacts: ${input.totalContacts}
- Subscribed: ${input.subscribedContacts}
- Unsubscribed: ${input.unsubscribedContacts}
- Blocked: ${input.blockedContacts}
- Recent Bounces: ${input.recentBounces}

Sender: ${input.senderEmail}
${input.senderReputation ? `
Sender Reputation:
- Reputation Score: ${input.senderReputation.reputationScore}/100
- Total Sent: ${input.senderReputation.totalSent}
- Total Delivered: ${input.senderReputation.totalDelivered}
- Total Bounced: ${input.senderReputation.totalBounced}
- Complaints: ${input.senderReputation.totalComplaints}
- Recent Trend: ${input.senderReputation.recentTrend}
` : ''}

Provide a comprehensive list quality analysis in JSON format with:
- listHealthScore (0-100)
- listQualityGrade (excellent/good/fair/poor/critical)
- subscriberEngagement (percentage)
- riskFactors (array of risk factors with severity and recommendations)
- senderReputationAssessment (score, status, trend, recommendations)
- overallRecommendation (summary statement)
- actionItems (array of specific actions to take)
- estimatedDeliverability (percentage)`;

    const response = await this.generate(systemPrompt, userPrompt, context);
    const analysis = this.parseJSON<ListQualityAnalysis>(response);

    this.validateResponse(analysis, [
      'listHealthScore',
      'listQualityGrade',
      'subscriberEngagement',
      'riskFactors',
      'senderReputationAssessment',
      'overallRecommendation',
      'actionItems',
      'estimatedDeliverability'
    ]);

    logger.info('[ListQualityAgent] Analysis complete', {
      listHealthScore: analysis.listHealthScore,
      listQualityGrade: analysis.listQualityGrade,
      riskFactorsCount: analysis.riskFactors.length
    });

    return analysis;
  }
}
