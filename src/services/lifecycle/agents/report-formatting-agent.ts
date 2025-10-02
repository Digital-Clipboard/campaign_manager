/**
 * Report Formatting Agent
 * Formats analysis results into human-readable reports for Slack notifications
 */

import { BaseAgent, AgentContext } from './base-agent';
import { logger } from '@/utils/logger';
import { RecommendationResult } from './recommendation-agent';
import { ListQualityAnalysis } from './list-quality-agent';
import { DeliveryAnalysisResult } from './delivery-analysis-agent';
import { ComparisonResult } from './comparison-agent';

export interface ReportInput {
  listQuality: ListQualityAnalysis;
  deliveryAnalysis: DeliveryAnalysisResult;
  comparison: ComparisonResult;
  recommendations: RecommendationResult;
  stage: 'preflight' | 'wrapup';
}

export interface FormattedReport {
  // For Pre-Flight stage
  preflightSummary?: {
    readinessStatus: 'ready' | 'warning' | 'blocked';
    topIssues: string[];
    topRecommendations: string[];
    listQualityScore: number;
  };

  // For Wrap-Up stage
  wrapupSummary?: {
    performanceHighlights: string[];
    keyMetrics: {
      deliveryRate: string;
      bounceRate: string;
      openRate?: string;
      clickRate?: string;
    };
    trendIndicators: string[];
  };

  // Common fields
  aiInsights: string[];
  actionableRecommendations: string[];
  warnings: string[];
  nextSteps: string[];
}

export class ReportFormattingAgent extends BaseAgent {
  constructor() {
    super('ReportFormattingAgent');
  }

  async formatReport(
    input: ReportInput,
    context: AgentContext
  ): Promise<FormattedReport> {
    logger.info('[ReportFormattingAgent] Formatting report', {
      stage: input.stage,
      campaignName: context.campaignName
    });

    const systemPrompt = `You are an expert technical writer specializing in data visualization and executive reporting.

Your role is to:
1. Translate complex technical analyses into clear, actionable insights
2. Format reports for Slack consumption (concise, scannable)
3. Highlight the most critical information first
4. Use simple language while maintaining precision
5. Create compelling narratives from data

Formatting Guidelines:
- Keep insights concise (1-2 sentences each)
- Use bullet points for easy scanning
- Prioritize critical information
- Avoid jargon and technical terms when possible
- Focus on "what it means" and "what to do" rather than raw data
- Maximum 5-7 items per list for readability

Response must be valid JSON matching the FormattedReport interface.`;

    const stageContext = input.stage === 'preflight'
      ? `PRE-FLIGHT STAGE (T-3.25h before launch):
This report helps the team decide if the campaign is ready to launch.
Focus on: readiness checks, potential blockers, last-minute optimizations.`
      : `WRAP-UP STAGE (T+30min after launch):
This report provides post-launch insights and learnings.
Focus on: performance highlights, lessons learned, improvements for next round.`;

    const userPrompt = `${stageContext}

Format the following analyses into a ${input.stage} report:

LIST QUALITY:
- Health Score: ${input.listQuality.listHealthScore}/100 (${input.listQuality.listQualityGrade})
- Engagement: ${input.listQuality.subscriberEngagement}%
- Risk Factors: ${input.listQuality.riskFactors.map(r => `${r.severity}: ${r.factor}`).join(', ')}
- Sender Reputation: ${input.listQuality.senderReputationAssessment.status}

DELIVERY ANALYSIS:
- Performance: ${input.deliveryAnalysis.overallPerformance} (${input.deliveryAnalysis.performanceScore}/100)
- Delivery Rate: ${input.deliveryAnalysis.deliveryMetricsAssessment.deliveryRate.value.toFixed(1)}% (${input.deliveryAnalysis.deliveryMetricsAssessment.deliveryRate.status})
- Bounce Rate: ${input.deliveryAnalysis.deliveryMetricsAssessment.bounceRate.value.toFixed(1)}% (${input.deliveryAnalysis.deliveryMetricsAssessment.bounceRate.status})
- Issues: ${input.deliveryAnalysis.issuesIdentified.length} identified
- Patterns: ${input.deliveryAnalysis.patternDetection.length} detected

COMPARISON:
- Trend: ${input.comparison.trend} (${input.comparison.trendConfidence} confidence)
- Trajectory: ${input.comparison.performanceTrajectory}
- Key Findings: ${input.comparison.keyFindings.length}

RECOMMENDATIONS:
- Overall Health: ${input.recommendations.overallHealth.status} (${input.recommendations.overallHealth.score}/100)
- Critical/High Priority: ${input.recommendations.prioritizedRecommendations.filter(r => r.priority === 'critical' || r.priority === 'high').length}
- Warnings: ${input.recommendations.warnings.length}
- Opportunities: ${input.recommendations.opportunities.length}

DETAILED INSIGHTS:
Top Recommendations:
${input.recommendations.prioritizedRecommendations.slice(0, 5).map(r => `- [${r.priority}] ${r.recommendation}`).join('\n')}

Top Issues:
${input.deliveryAnalysis.issuesIdentified.slice(0, 3).map(i => `- [${i.severity}] ${i.issue}`).join('\n')}

Key Findings:
${input.comparison.keyFindings.slice(0, 3).map(f => `- [${f.type}] ${f.finding}`).join('\n')}

Format this into a ${input.stage === 'preflight' ? 'pre-flight readiness report' : 'post-launch wrap-up report'} in JSON format.

${input.stage === 'preflight' ? `
Include:
- preflightSummary with readiness status (ready/warning/blocked based on issues)
- topIssues (max 5 critical items to address)
- topRecommendations (max 5 actionable items)
` : `
Include:
- wrapupSummary with performance highlights and key metrics
- trendIndicators showing how performance is evolving
- keyMetrics with formatted percentages
`}

Always include:
- aiInsights (5-7 key insights from AI analysis)
- actionableRecommendations (5-7 specific actions)
- warnings (critical warnings only, if any)
- nextSteps (3-5 immediate next steps)`;

    const response = await this.generate(systemPrompt, userPrompt, context);
    const report = this.parseJSON<FormattedReport>(response);

    // Validate based on stage
    const commonFields = ['aiInsights', 'actionableRecommendations', 'warnings', 'nextSteps'];
    if (input.stage === 'preflight') {
      this.validateResponse(report, [...commonFields, 'preflightSummary']);
    } else {
      this.validateResponse(report, [...commonFields, 'wrapupSummary']);
    }

    logger.info('[ReportFormattingAgent] Report formatted', {
      stage: input.stage,
      insightsCount: report.aiInsights.length,
      recommendationsCount: report.actionableRecommendations.length
    });

    return report;
  }
}
