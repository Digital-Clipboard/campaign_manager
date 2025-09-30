import { logger } from '../../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailStatistics } from '../../integrations/mcp-clients/mailjet-agent-client';

export interface CampaignAnalysisInput {
  campaignName: string;
  roundNumber: number;
  currentStats: EmailStatistics;
  previousRoundStats?: EmailStatistics;
  targetMetrics?: {
    deliveryRate?: number;
    openRate?: number;
    clickRate?: number;
    bounceRate?: number;
  };
}

export interface CampaignInsight {
  type: 'positive' | 'warning' | 'critical';
  category: 'delivery' | 'engagement' | 'performance' | 'optimization';
  message: string;
  impact: 'high' | 'medium' | 'low';
}

export interface CampaignAnalysisOutput {
  overallPerformance: 'excellent' | 'good' | 'fair' | 'poor';
  performanceScore: number; // 0-100
  insights: CampaignInsight[];
  keyMetrics: {
    delivery: { value: number; benchmark: number; status: 'above' | 'at' | 'below' };
    engagement: { value: number; benchmark: number; status: 'above' | 'at' | 'below' };
    quality: { value: number; benchmark: number; status: 'above' | 'at' | 'below' };
  };
  recommendations: string[];
  trends: {
    vsLastRound?: string;
    vsBenchmark: string;
  };
}

export class CampaignAnalyticsAgent {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Analyze campaign performance and generate insights
   */
  async analyzeCampaign(input: CampaignAnalysisInput): Promise<CampaignAnalysisOutput> {
    try {
      logger.info('Starting campaign analysis', {
        campaignName: input.campaignName,
        roundNumber: input.roundNumber
      });

      // Build the analysis prompt
      const prompt = this.buildAnalysisPrompt(input);

      // Call Gemini API
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      logger.info('Received Gemini analysis', {
        responseLength: analysisText.length
      });

      // Parse Gemini's response into structured output
      const analysis = this.parseAnalysisResponse(analysisText, input);

      logger.info('Campaign analysis completed', {
        performanceScore: analysis.performanceScore,
        insightCount: analysis.insights.length,
        recommendationCount: analysis.recommendations.length
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze campaign', {
        error: error.message,
        campaignName: input.campaignName
      });

      // Return a fallback analysis if AI fails
      return this.getFallbackAnalysis(input);
    }
  }

  /**
   * Build comprehensive analysis prompt for Gemini
   */
  private buildAnalysisPrompt(input: CampaignAnalysisInput): string {
    const { campaignName, roundNumber, currentStats, previousRoundStats, targetMetrics } = input;

    let prompt = `You are a senior marketing analytics expert analyzing an email campaign. Provide a concise, executive-level analysis.

CAMPAIGN: ${campaignName} - Round ${roundNumber}

CURRENT PERFORMANCE:
- Sent: ${currentStats.sent.toLocaleString()}
- Delivered: ${currentStats.delivered.toLocaleString()} (${currentStats.deliveryRate}%)
- Opened: ${currentStats.opened.toLocaleString()} (${currentStats.openRate}%)
- Clicked: ${currentStats.clicked.toLocaleString()} (${currentStats.clickRate}%)
- Bounced: ${currentStats.bounced} (${currentStats.bounceRate}%)
- Hard Bounces: ${currentStats.hardBounced}
- Soft Bounces: ${currentStats.softBounced}
- Spam Complaints: ${currentStats.spam}
- Unsubscribed: ${currentStats.unsubscribed}

`;

    if (previousRoundStats) {
      prompt += `PREVIOUS ROUND (Round ${roundNumber - 1}):
- Delivery Rate: ${previousRoundStats.deliveryRate}%
- Open Rate: ${previousRoundStats.openRate}%
- Click Rate: ${previousRoundStats.clickRate}%
- Bounce Rate: ${previousRoundStats.bounceRate}%

`;
    }

    if (targetMetrics) {
      prompt += `TARGET BENCHMARKS:
- Delivery Rate Target: ${targetMetrics.deliveryRate || 95}%
- Open Rate Target: ${targetMetrics.openRate || 25}%
- Click Rate Target: ${targetMetrics.clickRate || 3}%
- Bounce Rate Threshold: < ${targetMetrics.bounceRate || 5}%

`;
    }

    prompt += `ANALYSIS REQUIREMENTS:
Provide your analysis in the following JSON format:
{
  "overallPerformance": "excellent|good|fair|poor",
  "performanceScore": <0-100>,
  "insights": [
    {
      "type": "positive|warning|critical",
      "category": "delivery|engagement|performance|optimization",
      "message": "<concise insight>",
      "impact": "high|medium|low"
    }
  ],
  "keyMetrics": {
    "delivery": {"value": <deliveryRate>, "benchmark": 95, "status": "above|at|below"},
    "engagement": {"value": <openRate>, "benchmark": 25, "status": "above|at|below"},
    "quality": {"value": <100-bounceRate>, "benchmark": 95, "status": "above|at|below"}
  },
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>"
  ],
  "trends": {
    ${previousRoundStats ? '"vsLastRound": "<comparison summary>",' : ''}
    "vsBenchmark": "<benchmark comparison summary>"
  }
}

ANALYSIS GUIDELINES:
1. Focus on actionable insights - what matters most for executive decision-making
2. Compare current performance against benchmarks and previous rounds
3. Identify 3-5 key insights with business impact
4. Provide 3 specific, prioritized recommendations
5. Be concise - executives need signal, not noise
6. Highlight both strengths to maintain and areas to improve
7. Use industry benchmarks: Delivery 95%+, Open 20-30%, Click 2-5%, Bounce <5%

Return ONLY the JSON response, no additional text.`;

    return prompt;
  }

  /**
   * Parse Gemini's JSON response into structured output
   */
  private parseAnalysisResponse(responseText: string, input: CampaignAnalysisInput): CampaignAnalysisOutput {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();

      // Remove markdown code block markers if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.substring(3);
      }

      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }

      jsonText = jsonText.trim();

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Validate and return
      return {
        overallPerformance: parsed.overallPerformance || 'good',
        performanceScore: parsed.performanceScore || 75,
        insights: parsed.insights || [],
        keyMetrics: parsed.keyMetrics || this.calculateKeyMetrics(input.currentStats),
        recommendations: parsed.recommendations || [],
        trends: parsed.trends || { vsBenchmark: 'Performance analysis unavailable' }
      };

    } catch (error) {
      logger.error('Failed to parse Gemini response', { error: error.message });

      // If parsing fails, use fallback analysis
      return this.getFallbackAnalysis(input);
    }
  }

  /**
   * Calculate key metrics from statistics
   */
  private calculateKeyMetrics(stats: EmailStatistics) {
    return {
      delivery: {
        value: stats.deliveryRate,
        benchmark: 95,
        status: stats.deliveryRate >= 95 ? 'above' : stats.deliveryRate >= 90 ? 'at' : 'below'
      },
      engagement: {
        value: stats.openRate,
        benchmark: 25,
        status: stats.openRate >= 25 ? 'above' : stats.openRate >= 20 ? 'at' : 'below'
      },
      quality: {
        value: 100 - stats.bounceRate,
        benchmark: 95,
        status: stats.bounceRate <= 5 ? 'above' : stats.bounceRate <= 10 ? 'at' : 'below'
      }
    } as const;
  }

  /**
   * Fallback analysis when AI is unavailable
   */
  private getFallbackAnalysis(input: CampaignAnalysisInput): CampaignAnalysisOutput {
    const { currentStats, previousRoundStats } = input;
    const insights: CampaignInsight[] = [];
    const recommendations: string[] = [];

    // Basic rule-based insights
    if (currentStats.deliveryRate >= 95) {
      insights.push({
        type: 'positive',
        category: 'delivery',
        message: `Excellent delivery rate of ${currentStats.deliveryRate}% - infrastructure performing well`,
        impact: 'high'
      });
    } else if (currentStats.deliveryRate < 90) {
      insights.push({
        type: 'critical',
        category: 'delivery',
        message: `Low delivery rate of ${currentStats.deliveryRate}% - immediate investigation required`,
        impact: 'high'
      });
      recommendations.push('Investigate deliverability issues and email list quality');
    }

    if (currentStats.openRate >= 25) {
      insights.push({
        type: 'positive',
        category: 'engagement',
        message: `Strong open rate of ${currentStats.openRate}% exceeds industry benchmark`,
        impact: 'medium'
      });
    } else if (currentStats.openRate < 20) {
      insights.push({
        type: 'warning',
        category: 'engagement',
        message: `Open rate of ${currentStats.openRate}% below target - subject line optimization needed`,
        impact: 'medium'
      });
      recommendations.push('A/B test subject lines to improve open rates');
    }

    if (currentStats.bounceRate > 5) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: `Bounce rate of ${currentStats.bounceRate}% above threshold - list hygiene required`,
        impact: 'high'
      });
      recommendations.push('Clean email list and remove invalid addresses');
    }

    // Compare with previous round if available
    if (previousRoundStats) {
      if (currentStats.openRate < previousRoundStats.openRate - 2) {
        insights.push({
          type: 'warning',
          category: 'engagement',
          message: `Open rate declined ${(previousRoundStats.openRate - currentStats.openRate).toFixed(1)}% from previous round`,
          impact: 'medium'
        });
      }
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring key metrics for consistency');
      recommendations.push('Maintain current sending practices and infrastructure');
      recommendations.push('Track opens and clicks over next 48 hours for full picture');
    }

    // Calculate performance score
    let score = 0;
    if (currentStats.deliveryRate >= 95) score += 35;
    else if (currentStats.deliveryRate >= 90) score += 25;
    else score += 15;

    if (currentStats.openRate >= 25) score += 35;
    else if (currentStats.openRate >= 20) score += 25;
    else score += 15;

    if (currentStats.clickRate >= 3) score += 20;
    else if (currentStats.clickRate >= 2) score += 15;
    else score += 10;

    if (currentStats.bounceRate <= 5) score += 10;

    return {
      overallPerformance: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
      performanceScore: score,
      insights,
      keyMetrics: this.calculateKeyMetrics(currentStats),
      recommendations,
      trends: {
        vsLastRound: previousRoundStats
          ? `Delivery ${currentStats.deliveryRate >= previousRoundStats.deliveryRate ? 'maintained' : 'declined'}, ` +
            `engagement ${currentStats.openRate >= previousRoundStats.openRate ? 'improved' : 'declined'}`
          : undefined,
        vsBenchmark: `Delivery ${currentStats.deliveryRate >= 95 ? 'exceeds' : 'below'} target, ` +
          `engagement ${currentStats.openRate >= 25 ? 'above' : 'at'} industry standard`
      }
    };
  }
}