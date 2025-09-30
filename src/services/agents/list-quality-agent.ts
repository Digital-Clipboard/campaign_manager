import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';

export interface ListQualityInput {
  campaignName: string;
  currentRound: number;
  currentStats: {
    sent: number;
    delivered: number;
    bounced: number;
    hardBounced: number;
    softBounced: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    clickRate: number;
    timeElapsed: string;
  };
  previousRoundStats?: {
    sent: number;
    delivered: number;
    bounced: number;
    hardBounced: number;
    softBounced: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    clickRate: number;
  };
  userSegment: string;
}

export interface ListQualityAssessment {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  qualityScore: number; // 0-100
  listHealthStatus: 'healthy' | 'warning' | 'critical';

  // Comparative analysis
  comparison: {
    bounceRateChange: number; // percentage change from previous round
    deliveryRateChange: number;
    engagementChange: number;
    trend: 'improving' | 'stable' | 'declining';
    significance: string; // Human-readable explanation
  };

  // Key insights
  insights: Array<{
    type: 'positive' | 'warning' | 'critical';
    metric: string;
    observation: string;
    impact: 'high' | 'medium' | 'low';
  }>;

  // Recommendations
  recommendations: string[];

  // Executive summary
  executiveSummary: string;

  // Predictions
  predictions: {
    nextRoundExpectations: string;
    listCleaningNeeded: boolean;
    estimatedHealthyContacts: number;
  };
}

export class ListQualityAgent {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Assess email list quality based on current and previous round statistics
   */
  async assessListQuality(input: ListQualityInput): Promise<ListQualityAssessment> {
    try {
      logger.info('Starting list quality assessment', {
        campaignName: input.campaignName,
        currentRound: input.currentRound,
        userSegment: input.userSegment
      });

      // Build prompt for AI analysis
      const prompt = this.buildAssessmentPrompt(input);

      // Get AI analysis
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      // Parse AI response into structured format
      const assessment = this.parseAssessmentResponse(analysisText, input);

      logger.info('List quality assessment completed', {
        overallQuality: assessment.overallQuality,
        qualityScore: assessment.qualityScore,
        listHealthStatus: assessment.listHealthStatus
      });

      return assessment;

    } catch (error) {
      logger.error('Failed to assess list quality', {
        error: error.message,
        campaignName: input.campaignName
      });

      // Return fallback assessment
      return this.generateFallbackAssessment(input);
    }
  }

  /**
   * Build comprehensive prompt for AI analysis
   */
  private buildAssessmentPrompt(input: ListQualityInput): string {
    const hasPreviousRound = !!input.previousRoundStats;

    let prompt = `You are an email marketing data analyst specializing in list quality assessment. Analyze the following email campaign data and provide insights on list health, comparing rounds if previous data is available.

# Campaign Context
Campaign: ${input.campaignName}
Current Round: ${input.currentRound}
User Segment: ${input.userSegment}
Time Since Launch: ${input.currentStats.timeElapsed}

# Current Round Statistics (Round ${input.currentRound})
- Sent: ${input.currentStats.sent}
- Delivered: ${input.currentStats.delivered} (${input.currentStats.deliveryRate}%)
- Total Bounces: ${input.currentStats.bounced} (${input.currentStats.bounceRate}%)
- Hard Bounces: ${input.currentStats.hardBounced}
- Soft Bounces: ${input.currentStats.softBounced}
- Opens: ${input.currentStats.opened} (${input.currentStats.openRate}%)
- Clicks: ${input.currentStats.clicked} (${input.currentStats.clickRate}%)
`;

    if (hasPreviousRound) {
      const prev = input.previousRoundStats!;
      prompt += `
# Previous Round Statistics (Round ${input.currentRound - 1})
- Sent: ${prev.sent}
- Delivered: ${prev.delivered} (${prev.deliveryRate}%)
- Total Bounces: ${prev.bounced} (${prev.bounceRate}%)
- Hard Bounces: ${prev.hardBounced}
- Soft Bounces: ${prev.softBounced}
- Opens: ${prev.opened} (${prev.openRate}%)
- Clicks: ${prev.clicked} (${prev.clickRate}%)

# Your Analysis Tasks:
1. Compare Round ${input.currentRound} vs Round ${input.currentRound - 1}
2. Assess if the hypothesis "Round ${input.currentRound} has better list quality with lower hard bounces" is correct
3. Identify any concerning trends or positive improvements
4. Evaluate overall list health and cleanliness
`;
    } else {
      prompt += `
# Your Analysis Tasks:
1. Assess the quality of this email list based on current statistics
2. Evaluate list health and cleanliness
3. Identify any concerning patterns
`;
    }

    // Add context about timing
    const isEarlyReport = input.currentStats.timeElapsed &&
      (input.currentStats.timeElapsed.includes('15 minutes') ||
       input.currentStats.timeElapsed.includes('10 minutes'));

    if (isEarlyReport) {
      prompt += `
# Important Context: Early Post-Launch Report (${input.currentStats.timeElapsed})
⚠️ This assessment is being conducted shortly after campaign launch.
- Focus ONLY on deliverability metrics (delivery rate, bounce rate, hard/soft bounces)
- IGNORE engagement metrics (opens, clicks) as it's too early for meaningful data
- Opens and clicks typically take 24-48 hours to stabilize
- Zero opens/clicks at this stage is NORMAL and EXPECTED

`;
    }

    prompt += `
# Industry Benchmarks for Deliverability
- Delivery Rate: 95%+ is excellent, 90-95% is good, 85-90% is fair, <85% is poor
- Bounce Rate: <2% is excellent, 2-5% is acceptable, >5% needs attention
- Hard Bounce Rate: <0.5% is excellent, 0.5-1% is good, >1% indicates list quality issues

${!isEarlyReport ? `
# Engagement Benchmarks (only relevant after 24+ hours)
- Open Rate: 25%+ is excellent, 20-25% is good, 15-20% is fair, <15% is poor
- Click Rate: 3%+ is excellent, 2-3% is good, 1-2% is fair, <1% is poor
` : ''}

# Response Format (JSON)
Provide your analysis in the following JSON format:

\`\`\`json
{
  "overallQuality": "excellent|good|fair|poor",
  "qualityScore": <number 0-100>,
  "listHealthStatus": "healthy|warning|critical",
  "comparison": {
    "bounceRateChange": <percentage change, can be negative>,
    "deliveryRateChange": <percentage change>,
    "engagementChange": <percentage change in opens+clicks - use 0 if early report>,
    "trend": "improving|stable|declining",
    "significance": "<1-2 sentence explanation focusing on deliverability only if early report>"
  },
  "insights": [
    {
      "type": "positive|warning|critical",
      "metric": "<metric name - focus on deliverability if early report>",
      "observation": "<specific observation>",
      "impact": "high|medium|low"
    }
  ],
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>"
  ],
  "executiveSummary": "<2-3 sentence summary focusing on deliverability for early reports>",
  "predictions": {
    "nextRoundExpectations": "<what to expect for next round based on deliverability>",
    "listCleaningNeeded": <true|false>,
    "estimatedHealthyContacts": <estimated number of valid contacts>
  }
}
\`\`\`

Focus on:
1. Hard bounce rate comparison (key quality indicator)
2. Delivery rate trends
3. List health and cleanliness
${isEarlyReport ? '4. DO NOT penalize for zero opens/clicks - this is expected at 15 minutes' : '4. Engagement trends (opens and clicks)'}
`;

    return prompt;
  }

  /**
   * Parse AI response into structured assessment
   */
  private parseAssessmentResponse(
    analysisText: string,
    input: ListQualityInput
  ): ListQualityAssessment {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;

      const parsed = JSON.parse(jsonText);

      // Validate and ensure all required fields exist
      return {
        overallQuality: parsed.overallQuality || 'good',
        qualityScore: parsed.qualityScore || 75,
        listHealthStatus: parsed.listHealthStatus || 'healthy',
        comparison: parsed.comparison || {
          bounceRateChange: 0,
          deliveryRateChange: 0,
          engagementChange: 0,
          trend: 'stable',
          significance: 'Insufficient data for comparison'
        },
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || ['Monitor campaign performance'],
        executiveSummary: parsed.executiveSummary || 'List quality assessment completed.',
        predictions: parsed.predictions || {
          nextRoundExpectations: 'Continue monitoring',
          listCleaningNeeded: false,
          estimatedHealthyContacts: input.currentStats.delivered
        }
      };

    } catch (error) {
      logger.error('Failed to parse AI assessment response', {
        error: error.message,
        analysisText: analysisText.substring(0, 500)
      });

      // Return rule-based assessment as fallback
      return this.generateFallbackAssessment(input);
    }
  }

  /**
   * Generate fallback assessment using rule-based logic
   */
  private generateFallbackAssessment(input: ListQualityInput): ListQualityAssessment {
    const stats = input.currentStats;
    const prev = input.previousRoundStats;

    // Calculate quality score
    const deliveryScore = (stats.deliveryRate / 95) * 40;
    const bounceScore = Math.max(0, (1 - stats.bounceRate / 5) * 30);
    const engagementScore = ((stats.openRate / 25) * 20) + ((stats.clickRate / 3) * 10);
    const qualityScore = Math.round(Math.min(100, deliveryScore + bounceScore + engagementScore));

    // Determine overall quality
    let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
    if (qualityScore >= 85) overallQuality = 'excellent';
    else if (qualityScore >= 70) overallQuality = 'good';
    else if (qualityScore >= 55) overallQuality = 'fair';
    else overallQuality = 'poor';

    // Determine health status
    let listHealthStatus: 'healthy' | 'warning' | 'critical';
    if (stats.bounceRate <= 2 && stats.deliveryRate >= 95) listHealthStatus = 'healthy';
    else if (stats.bounceRate <= 5 && stats.deliveryRate >= 90) listHealthStatus = 'warning';
    else listHealthStatus = 'critical';

    // Build comparison if previous round exists
    const comparison = prev ? {
      bounceRateChange: Number((stats.bounceRate - prev.bounceRate).toFixed(2)),
      deliveryRateChange: Number((stats.deliveryRate - prev.deliveryRate).toFixed(2)),
      engagementChange: Number(((stats.openRate + stats.clickRate) - (prev.openRate + prev.clickRate)).toFixed(2)),
      trend: (stats.bounceRate < prev.bounceRate && stats.deliveryRate >= prev.deliveryRate) ? 'improving' as const :
             (stats.bounceRate > prev.bounceRate || stats.deliveryRate < prev.deliveryRate) ? 'declining' as const :
             'stable' as const,
      significance: `Round ${input.currentRound} shows ${stats.bounceRate < prev.bounceRate ? 'improved' : 'similar'} deliverability compared to Round ${input.currentRound - 1}`
    } : {
      bounceRateChange: 0,
      deliveryRateChange: 0,
      engagementChange: 0,
      trend: 'stable' as const,
      significance: 'First round - no comparison data available'
    };

    // Generate insights
    const insights: Array<{
      type: 'positive' | 'warning' | 'critical';
      metric: string;
      observation: string;
      impact: 'high' | 'medium' | 'low';
    }> = [];

    if (stats.hardBounced / stats.sent > 0.01) {
      insights.push({
        type: 'warning',
        metric: 'Hard Bounces',
        observation: `Hard bounce rate of ${((stats.hardBounced / stats.sent) * 100).toFixed(2)}% indicates list quality issues`,
        impact: 'high'
      });
    }

    if (stats.deliveryRate >= 95) {
      insights.push({
        type: 'positive',
        metric: 'Delivery Rate',
        observation: `Excellent delivery rate of ${stats.deliveryRate}%`,
        impact: 'medium'
      });
    }

    if (prev && stats.bounceRate < prev.bounceRate) {
      insights.push({
        type: 'positive',
        metric: 'Bounce Rate Improvement',
        observation: `Bounce rate improved by ${(prev.bounceRate - stats.bounceRate).toFixed(2)}% compared to previous round`,
        impact: 'high'
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (stats.bounceRate > 5) {
      recommendations.push('Implement list cleaning to remove invalid addresses');
    }
    if (stats.openRate < 20) {
      recommendations.push('Review subject lines and sender reputation');
    }
    if (prev && stats.bounceRate > prev.bounceRate) {
      recommendations.push('Investigate list quality degradation between rounds');
    }

    return {
      overallQuality,
      qualityScore,
      listHealthStatus,
      comparison,
      insights,
      recommendations: recommendations.length > 0 ? recommendations : ['Continue monitoring campaign performance'],
      executiveSummary: `Round ${input.currentRound} list quality is ${overallQuality} with ${stats.deliveryRate}% delivery rate and ${stats.bounceRate}% bounce rate.${prev ? ` Bounce rate ${comparison.bounceRateChange < 0 ? 'decreased' : 'increased'} by ${Math.abs(comparison.bounceRateChange)}% vs Round ${input.currentRound - 1}.` : ''}`,
      predictions: {
        nextRoundExpectations: comparison.trend === 'improving' ? 'Expect continued improvement in next round' :
                               comparison.trend === 'declining' ? 'Monitor closely for further decline' :
                               'Expect similar performance in next round',
        listCleaningNeeded: stats.bounceRate > 5 || stats.hardBounced / stats.sent > 0.01,
        estimatedHealthyContacts: Math.round(stats.sent * (1 - stats.bounceRate / 100))
      }
    };
  }

  /**
   * Health check for AI agent
   */
  async healthCheck(): Promise<{ available: boolean; error?: string }> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return {
          available: false,
          error: 'GEMINI_API_KEY not configured'
        };
      }

      return { available: true };

    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}