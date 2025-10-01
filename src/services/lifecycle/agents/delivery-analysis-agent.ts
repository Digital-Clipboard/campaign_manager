/**
 * Delivery Analysis Agent
 * Analyzes campaign delivery metrics and identifies patterns
 */

import { BaseAgent, AgentContext } from './base-agent';
import { logger } from '@/utils/logger';

export interface DeliveryMetrics {
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
  deliveryRate: number;
  bounceRate: number;
  hardBounceRate: number;
  softBounceRate: number;
  openRate: number | null;
  clickRate: number | null;
  sendStartAt?: Date;
  sendEndAt?: Date;
}

export interface DeliveryAnalysisResult {
  overallPerformance: 'excellent' | 'good' | 'average' | 'poor' | 'critical';
  performanceScore: number; // 0-100
  deliveryMetricsAssessment: {
    deliveryRate: {
      value: number;
      status: 'excellent' | 'good' | 'warning' | 'critical';
      benchmark: string;
    };
    bounceRate: {
      value: number;
      status: 'excellent' | 'good' | 'warning' | 'critical';
      breakdown: {
        hardBounces: number;
        softBounces: number;
      };
      primaryCauses: string[];
    };
    engagementRate: {
      openRate: number | null;
      clickRate: number | null;
      status: 'excellent' | 'good' | 'average' | 'poor' | 'unknown';
    };
  };
  patternDetection: Array<{
    pattern: string;
    description: string;
    significance: 'high' | 'medium' | 'low';
    implication: string;
  }>;
  issuesIdentified: Array<{
    issue: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    impact: string;
    suggestedFix: string;
  }>;
  positiveIndicators: string[];
  recommendations: string[];
}

export class DeliveryAnalysisAgent extends BaseAgent {
  constructor() {
    super('DeliveryAnalysisAgent');
  }

  async analyze(
    metrics: DeliveryMetrics,
    context: AgentContext
  ): Promise<DeliveryAnalysisResult> {
    logger.info('[DeliveryAnalysisAgent] Analyzing delivery metrics', {
      processed: metrics.processed,
      delivered: metrics.delivered,
      deliveryRate: metrics.deliveryRate
    });

    const systemPrompt = `You are an expert email campaign analyst specializing in delivery metrics and performance analysis.

Your role is to:
1. Assess campaign delivery performance against industry benchmarks
2. Identify patterns in bounce rates, blocks, and engagement
3. Detect anomalies or concerning trends
4. Provide insights into what's working and what needs improvement
5. Offer specific, actionable recommendations

Industry Benchmarks:
- Delivery Rate: 95-98% (excellent), 90-95% (good), 85-90% (average), <85% (poor)
- Bounce Rate: <2% (excellent), 2-5% (good), 5-10% (warning), >10% (critical)
- Hard Bounce Rate: <0.5% (excellent), 0.5-1% (good), 1-2% (warning), >2% (critical)
- Open Rate: >20% (excellent), 15-20% (good), 10-15% (average), <10% (poor)
- Click Rate: >3% (excellent), 2-3% (good), 1-2% (average), <1% (poor)

Response must be valid JSON matching the DeliveryAnalysisResult interface.`;

    const userPrompt = `Analyze the following campaign delivery metrics:

Campaign Metrics:
- Processed: ${metrics.processed}
- Delivered: ${metrics.delivered} (${metrics.deliveryRate.toFixed(2)}%)
- Bounced: ${metrics.bounced} (${metrics.bounceRate.toFixed(2)}%)
  - Hard Bounces: ${metrics.hardBounces} (${metrics.hardBounceRate.toFixed(2)}%)
  - Soft Bounces: ${metrics.softBounces} (${metrics.softBounceRate.toFixed(2)}%)
- Blocked: ${metrics.blocked}
- Queued: ${metrics.queued}
- Opened: ${metrics.opened}${metrics.openRate !== null ? ` (${metrics.openRate.toFixed(2)}%)` : ''}
- Clicked: ${metrics.clicked}${metrics.clickRate !== null ? ` (${metrics.clickRate.toFixed(2)}%)` : ''}
- Unsubscribed: ${metrics.unsubscribed}
- Complained: ${metrics.complained}
${metrics.sendStartAt && metrics.sendEndAt ? `
Send Window:
- Started: ${metrics.sendStartAt.toISOString()}
- Ended: ${metrics.sendEndAt.toISOString()}
- Duration: ${Math.round((metrics.sendEndAt.getTime() - metrics.sendStartAt.getTime()) / 60000)} minutes
` : ''}

Provide a comprehensive delivery analysis in JSON format with:
- overallPerformance (excellent/good/average/poor/critical)
- performanceScore (0-100)
- deliveryMetricsAssessment (detailed assessment of delivery, bounce, and engagement rates)
- patternDetection (array of patterns detected in the metrics)
- issuesIdentified (array of issues with severity and suggested fixes)
- positiveIndicators (array of things that are working well)
- recommendations (array of specific recommendations)`;

    const response = await this.generate(systemPrompt, userPrompt, context);
    const analysis = this.parseJSON<DeliveryAnalysisResult>(response);

    this.validateResponse(analysis, [
      'overallPerformance',
      'performanceScore',
      'deliveryMetricsAssessment',
      'patternDetection',
      'issuesIdentified',
      'positiveIndicators',
      'recommendations'
    ]);

    logger.info('[DeliveryAnalysisAgent] Analysis complete', {
      overallPerformance: analysis.overallPerformance,
      performanceScore: analysis.performanceScore,
      issuesCount: analysis.issuesIdentified.length
    });

    return analysis;
  }
}
