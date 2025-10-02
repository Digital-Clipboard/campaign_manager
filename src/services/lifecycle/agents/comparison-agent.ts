/**
 * Comparison Agent
 * Compares metrics across campaign rounds and identifies trends
 */

import { BaseAgent, AgentContext } from './base-agent';
import { logger } from '@/utils/logger';
import { DeliveryMetrics } from './delivery-analysis-agent';

export interface RoundComparison {
  currentRound: {
    roundNumber: number;
    metrics: DeliveryMetrics;
  };
  previousRound?: {
    roundNumber: number;
    metrics: DeliveryMetrics;
  };
}

export interface ComparisonResult {
  trend: 'improving' | 'stable' | 'declining' | 'first_round';
  trendConfidence: 'high' | 'medium' | 'low';
  metricsComparison: {
    deliveryRate: {
      current: number;
      previous?: number;
      delta?: number;
      trend: 'up' | 'down' | 'stable' | 'n/a';
      significance: 'major_improvement' | 'minor_improvement' | 'stable' | 'minor_decline' | 'major_decline' | 'n/a';
    };
    bounceRate: {
      current: number;
      previous?: number;
      delta?: number;
      trend: 'up' | 'down' | 'stable' | 'n/a';
      significance: 'major_improvement' | 'minor_improvement' | 'stable' | 'minor_decline' | 'major_decline' | 'n/a';
    };
    hardBounceRate: {
      current: number;
      previous?: number;
      delta?: number;
      trend: 'up' | 'down' | 'stable' | 'n/a';
      significance: 'major_improvement' | 'minor_improvement' | 'stable' | 'minor_decline' | 'major_decline' | 'n/a';
    };
    openRate?: {
      current: number | null;
      previous?: number | null;
      delta?: number;
      trend: 'up' | 'down' | 'stable' | 'n/a';
      significance: 'major_improvement' | 'minor_improvement' | 'stable' | 'minor_decline' | 'major_decline' | 'n/a';
    };
    clickRate?: {
      current: number | null;
      previous?: number | null;
      delta?: number;
      trend: 'up' | 'down' | 'stable' | 'n/a';
      significance: 'major_improvement' | 'minor_improvement' | 'stable' | 'minor_decline' | 'major_decline' | 'n/a';
    };
  };
  keyFindings: Array<{
    finding: string;
    type: 'positive' | 'negative' | 'neutral';
    impact: 'high' | 'medium' | 'low';
  }>;
  rootCauseAnalysis: Array<{
    change: string;
    possibleCauses: string[];
    recommendedAction: string;
  }>;
  performanceTrajectory: string;
  nextRoundPrediction?: {
    expectedDeliveryRate: number;
    expectedBounceRate: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    assumptions: string[];
  };
}

export class ComparisonAgent extends BaseAgent {
  constructor() {
    super('ComparisonAgent');
  }

  async compare(
    comparison: RoundComparison,
    context: AgentContext
  ): Promise<ComparisonResult> {
    logger.info('[ComparisonAgent] Comparing rounds', {
      currentRound: comparison.currentRound.roundNumber,
      previousRound: comparison.previousRound?.roundNumber
    });

    const systemPrompt = `You are an expert data analyst specializing in comparative campaign performance analysis.

Your role is to:
1. Compare metrics across campaign rounds to identify trends
2. Determine statistical significance of changes
3. Identify root causes of performance changes
4. Predict future performance based on trends
5. Provide insights on what's driving improvements or declines

Analysis Guidelines:
- Delta significance thresholds:
  - Major: >5% absolute change
  - Minor: 1-5% absolute change
  - Stable: <1% absolute change
- Consider context: Round 1 vs 2 vs 3 patterns
- Look for consistent patterns vs anomalies
- Factor in list degradation over rounds
- Assess confidence based on data quality

Response must be valid JSON matching the ComparisonResult interface.`;

    const userPrompt = comparison.previousRound
      ? `Compare the following campaign rounds:

CURRENT ROUND ${comparison.currentRound.roundNumber}:
- Processed: ${comparison.currentRound.metrics.processed}
- Delivered: ${comparison.currentRound.metrics.delivered} (${comparison.currentRound.metrics.deliveryRate.toFixed(2)}%)
- Bounced: ${comparison.currentRound.metrics.bounced} (${comparison.currentRound.metrics.bounceRate.toFixed(2)}%)
  - Hard: ${comparison.currentRound.metrics.hardBounces} (${comparison.currentRound.metrics.hardBounceRate.toFixed(2)}%)
  - Soft: ${comparison.currentRound.metrics.softBounces} (${comparison.currentRound.metrics.softBounceRate.toFixed(2)}%)
- Blocked: ${comparison.currentRound.metrics.blocked}
- Opened: ${comparison.currentRound.metrics.opened}${comparison.currentRound.metrics.openRate !== null ? ` (${comparison.currentRound.metrics.openRate.toFixed(2)}%)` : ''}
- Clicked: ${comparison.currentRound.metrics.clicked}${comparison.currentRound.metrics.clickRate !== null ? ` (${comparison.currentRound.metrics.clickRate.toFixed(2)}%)` : ''}

PREVIOUS ROUND ${comparison.previousRound.roundNumber}:
- Processed: ${comparison.previousRound.metrics.processed}
- Delivered: ${comparison.previousRound.metrics.delivered} (${comparison.previousRound.metrics.deliveryRate.toFixed(2)}%)
- Bounced: ${comparison.previousRound.metrics.bounced} (${comparison.previousRound.metrics.bounceRate.toFixed(2)}%)
  - Hard: ${comparison.previousRound.metrics.hardBounces} (${comparison.previousRound.metrics.hardBounceRate.toFixed(2)}%)
  - Soft: ${comparison.previousRound.metrics.softBounces} (${comparison.previousRound.metrics.softBounceRate.toFixed(2)}%)
- Blocked: ${comparison.previousRound.metrics.blocked}
- Opened: ${comparison.previousRound.metrics.opened}${comparison.previousRound.metrics.openRate !== null ? ` (${comparison.previousRound.metrics.openRate.toFixed(2)}%)` : ''}
- Clicked: ${comparison.previousRound.metrics.clicked}${comparison.previousRound.metrics.clickRate !== null ? ` (${comparison.previousRound.metrics.clickRate.toFixed(2)}%)` : ''}

Provide a comprehensive comparison analysis in JSON format with all required fields.`
      : `Analyze the first round of this campaign:

ROUND ${comparison.currentRound.roundNumber}:
- Processed: ${comparison.currentRound.metrics.processed}
- Delivered: ${comparison.currentRound.metrics.delivered} (${comparison.currentRound.metrics.deliveryRate.toFixed(2)}%)
- Bounced: ${comparison.currentRound.metrics.bounced} (${comparison.currentRound.metrics.bounceRate.toFixed(2)}%)
  - Hard: ${comparison.currentRound.metrics.hardBounces} (${comparison.currentRound.metrics.hardBounceRate.toFixed(2)}%)
  - Soft: ${comparison.currentRound.metrics.softBounces} (${comparison.currentRound.metrics.softBounceRate.toFixed(2)}%)
- Opened: ${comparison.currentRound.metrics.opened}${comparison.currentRound.metrics.openRate !== null ? ` (${comparison.currentRound.metrics.openRate.toFixed(2)}%)` : ''}
- Clicked: ${comparison.currentRound.metrics.clicked}${comparison.currentRound.metrics.clickRate !== null ? ` (${comparison.currentRound.metrics.clickRate.toFixed(2)}%)` : ''}

This is the first round, so provide a baseline analysis with trend set to 'first_round' and predict performance for Round 2.`;

    const response = await this.generate(systemPrompt, userPrompt, context);
    const analysis = this.parseJSON<ComparisonResult>(response);

    this.validateResponse(analysis, [
      'trend',
      'trendConfidence',
      'metricsComparison',
      'keyFindings',
      'rootCauseAnalysis',
      'performanceTrajectory'
    ]);

    logger.info('[ComparisonAgent] Comparison complete', {
      trend: analysis.trend,
      trendConfidence: analysis.trendConfidence,
      keyFindingsCount: analysis.keyFindings.length
    });

    return analysis;
  }
}
