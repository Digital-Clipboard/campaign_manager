import { logger } from '../../utils/logger';
import { CampaignAnalyticsAgent, CampaignAnalysisInput } from './campaign-analytics.agent';
import { ReportFormattingAgent, FormattedCampaignReport } from './report-formatting.agent';
import { MailjetAgentClient, EmailStatistics } from '../../integrations/mcp-clients/mailjet-agent-client';

export interface CampaignReportInput {
  campaignName: string;
  roundNumber: number;
  mailjetCampaignId?: string;
  currentStats?: EmailStatistics;
  previousRoundStats?: EmailStatistics;
}

export class CampaignReportOrchestrator {
  private analyticsAgent: CampaignAnalyticsAgent;
  private formattingAgent: ReportFormattingAgent;
  private mailjetClient: MailjetAgentClient;

  constructor() {
    this.analyticsAgent = new CampaignAnalyticsAgent();
    this.formattingAgent = new ReportFormattingAgent();
    this.mailjetClient = new MailjetAgentClient();
  }

  /**
   * Generate complete AI-enhanced campaign report
   * This orchestrates the full workflow: fetch stats → analyze → format
   */
  async generateCampaignReport(input: CampaignReportInput): Promise<FormattedCampaignReport> {
    try {
      logger.info('Starting campaign report generation', {
        campaignName: input.campaignName,
        roundNumber: input.roundNumber
      });

      // Step 1: Fetch current campaign statistics from MailJet (if not provided)
      let currentStats = input.currentStats;
      if (!currentStats && input.mailjetCampaignId) {
        logger.info('Fetching campaign statistics from MailJet', {
          campaignId: input.mailjetCampaignId
        });

        currentStats = await this.mailjetClient.getEmailStatistics(input.mailjetCampaignId);
      }

      // If we still don't have stats, return error
      if (!currentStats) {
        throw new Error('No campaign statistics available');
      }

      // Step 2: Run analytics agent to generate insights
      logger.info('Running analytics agent');

      const analysisInput: CampaignAnalysisInput = {
        campaignName: input.campaignName,
        roundNumber: input.roundNumber,
        currentStats,
        previousRoundStats: input.previousRoundStats,
        targetMetrics: {
          deliveryRate: 95,
          openRate: 25,
          clickRate: 3,
          bounceRate: 5
        }
      };

      const analysis = await this.analyticsAgent.analyzeCampaign(analysisInput);

      logger.info('Analytics complete', {
        performanceScore: analysis.performanceScore,
        overallPerformance: analysis.overallPerformance,
        insightCount: analysis.insights.length
      });

      // Step 3: Run formatting agent to create executive report
      logger.info('Running formatting agent');

      const report = this.formattingAgent.formatExecutiveReport(
        input.campaignName,
        input.roundNumber,
        currentStats,
        analysis
      );

      logger.info('Campaign report generated successfully', {
        summaryLength: report.summary.length,
        blockCount: report.blocks.length
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate campaign report', {
        error: error.message,
        campaignName: input.campaignName,
        roundNumber: input.roundNumber
      });

      // Return fallback report
      return this.generateFallbackReport(input);
    }
  }

  /**
   * Generate fallback report when AI agents fail
   */
  private generateFallbackReport(input: CampaignReportInput): FormattedCampaignReport {
    const stats = input.currentStats;

    if (!stats) {
      return {
        summary: `Campaign ${input.campaignName} Round ${input.roundNumber} completed - detailed statistics unavailable`,
        text: `Campaign ${input.campaignName} Round ${input.roundNumber} completed. Statistics are being processed.`,
        blocks: [
          { type: 'divider' },
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'CAMPAIGN COMPLETED'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${input.campaignName} - Round ${input.roundNumber}*\n\n` +
                    `Campaign completed. Detailed statistics will be available shortly.`
            }
          },
          { type: 'divider' }
        ]
      };
    }

    // Use formatting agent with basic analysis
    const basicReport = this.formattingAgent.formatExecutiveReport(
      input.campaignName,
      input.roundNumber,
      stats,
      {
        overallPerformance: stats.deliveryRate >= 95 ? 'good' : 'fair',
        performanceScore: Math.round(
          (stats.deliveryRate / 95) * 40 +
          (stats.openRate / 25) * 40 +
          (stats.clickRate / 3) * 20
        ),
        insights: [],
        keyMetrics: {
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
        },
        recommendations: ['Monitor campaign performance over next 48 hours'],
        trends: {
          vsBenchmark: 'Basic statistics available'
        }
      }
    );

    return basicReport;
  }

  /**
   * Quick check if AI agents are available
   */
  async healthCheck(): Promise<{ available: boolean; error?: string }> {
    try {
      // Check if Gemini API key is configured
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