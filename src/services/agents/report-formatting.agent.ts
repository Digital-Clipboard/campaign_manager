import { logger } from '../../utils/logger';
import { CampaignAnalysisOutput, CampaignInsight } from './campaign-analytics.agent';
import { EmailStatistics } from '../../integrations/mcp-clients/mailjet-agent-client';

export interface FormattedCampaignReport {
  text: string; // Plain text summary for notifications
  blocks: any[]; // Slack blocks for rich formatting
  summary: string; // One-line executive summary
}

export class ReportFormattingAgent {
  private readonly STATUS_INDICATORS = {
    excellent: '🟢',
    good: '🟢',
    fair: '🟡',
    poor: '🔴',
    positive: '🟢',
    warning: '🟡',
    critical: '🔴',
    above: '🟢',
    at: '🟡',
    below: '🔴'
  };

  /**
   * Format campaign analysis into executive-ready report
   */
  formatExecutiveReport(
    campaignName: string,
    roundNumber: number,
    statistics: EmailStatistics,
    analysis: CampaignAnalysisOutput
  ): FormattedCampaignReport {
    try {
      logger.info('Formatting executive report', {
        campaignName,
        roundNumber,
        performanceScore: analysis.performanceScore
      });

      // Generate one-line summary
      const summary = this.generateSummary(campaignName, roundNumber, analysis);

      // Generate Slack blocks (rich formatting)
      const blocks = this.generateSlackBlocks(
        campaignName,
        roundNumber,
        statistics,
        analysis
      );

      // Generate plain text version
      const text = this.generatePlainText(
        campaignName,
        roundNumber,
        statistics,
        analysis
      );

      return {
        summary,
        blocks,
        text
      };

    } catch (error) {
      logger.error('Failed to format report', {
        error: error.message,
        campaignName,
        roundNumber
      });

      // Return basic formatted report
      return this.generateFallbackReport(campaignName, roundNumber, statistics);
    }
  }

  /**
   * Generate one-line executive summary
   */
  private generateSummary(
    campaignName: string,
    roundNumber: number,
    analysis: CampaignAnalysisOutput
  ): string {
    const performanceEmoji = this.STATUS_INDICATORS[analysis.overallPerformance];
    const scoreText = `${analysis.performanceScore}/100`;

    return `${performanceEmoji} ${campaignName} Round ${roundNumber}: ${analysis.overallPerformance.toUpperCase()} performance (${scoreText})`;
  }

  /**
   * Generate Slack blocks for rich formatting
   */
  private generateSlackBlocks(
    campaignName: string,
    roundNumber: number,
    statistics: EmailStatistics,
    analysis: CampaignAnalysisOutput
  ): any[] {
    const blocks: any[] = [];

    // Divider
    blocks.push({ type: 'divider' });

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 CAMPAIGN PERFORMANCE REPORT'
      }
    });

    // Campaign info
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${campaignName} - Round ${roundNumber}*\n` +
              `${this.STATUS_INDICATORS[analysis.overallPerformance]} *${analysis.overallPerformance.toUpperCase()} PERFORMANCE* (Score: ${analysis.performanceScore}/100)`
      }
    });

    // Executive Summary section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🎯 EXECUTIVE SUMMARY*'
      }
    });

    // Key metrics in grid
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Delivery:* ${this.STATUS_INDICATORS[analysis.keyMetrics.delivery.status]} ${analysis.keyMetrics.delivery.value}%`
        },
        {
          type: 'mrkdwn',
          text: `*Engagement:* ${this.STATUS_INDICATORS[analysis.keyMetrics.engagement.status]} ${analysis.keyMetrics.engagement.value}% open`
        },
        {
          type: 'mrkdwn',
          text: `*Quality:* ${this.STATUS_INDICATORS[analysis.keyMetrics.quality.status]} ${analysis.keyMetrics.quality.value}%`
        },
        {
          type: 'mrkdwn',
          text: `*Emails Sent:* ${statistics.sent.toLocaleString()}`
        }
      ]
    });

    // Top insights (limit to 3 most important)
    if (analysis.insights && analysis.insights.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 KEY INSIGHTS*'
        }
      });

      const topInsights = this.prioritizeInsights(analysis.insights).slice(0, 3);
      const insightsText = topInsights.map((insight, index) => {
        const emoji = this.STATUS_INDICATORS[insight.type];
        return `${index + 1}. ${emoji} *${insight.category.toUpperCase()}:* ${insight.message}`;
      }).join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: insightsText
        }
      });
    }

    // Recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*✅ RECOMMENDED ACTIONS*'
        }
      });

      const recommendationsText = analysis.recommendations
        .slice(0, 3)
        .map((rec, index) => `${index + 1}. ${rec}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: recommendationsText
        }
      });
    }

    // Trends comparison
    if (analysis.trends) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📈 PERFORMANCE TRENDS*'
        }
      });

      let trendsText = `• *vs Benchmark:* ${analysis.trends.vsBenchmark}`;
      if (analysis.trends.vsLastRound) {
        trendsText += `\n• *vs Previous Round:* ${analysis.trends.vsLastRound}`;
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: trendsText
        }
      });
    }

    // Detailed metrics (compact)
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📋 DETAILED METRICS*'
      }
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• Delivered: ${statistics.delivered.toLocaleString()} (${statistics.deliveryRate}%)\n` +
              `• Opened: ${statistics.opened.toLocaleString()} (${statistics.openRate}%)\n` +
              `• Clicked: ${statistics.clicked.toLocaleString()} (${statistics.clickRate}%)\n` +
              `• Bounced: ${statistics.bounced} (${statistics.bounceRate}% - ${statistics.hardBounced} hard, ${statistics.softBounced} soft)\n` +
              `• Spam: ${statistics.spam} | Unsubscribed: ${statistics.unsubscribed}`
      }
    });

    // Final divider
    blocks.push({ type: 'divider' });

    return blocks;
  }

  /**
   * Generate plain text version of report
   */
  private generatePlainText(
    campaignName: string,
    roundNumber: number,
    statistics: EmailStatistics,
    analysis: CampaignAnalysisOutput
  ): string {
    let text = `CAMPAIGN PERFORMANCE REPORT\n`;
    text += `${campaignName} - Round ${roundNumber}\n`;
    text += `Performance: ${analysis.overallPerformance.toUpperCase()} (${analysis.performanceScore}/100)\n\n`;

    text += `EXECUTIVE SUMMARY\n`;
    text += `• Delivery: ${analysis.keyMetrics.delivery.value}% (${analysis.keyMetrics.delivery.status} benchmark)\n`;
    text += `• Engagement: ${analysis.keyMetrics.engagement.value}% open (${analysis.keyMetrics.engagement.status} benchmark)\n`;
    text += `• Quality: ${analysis.keyMetrics.quality.value}% (${analysis.keyMetrics.quality.status} benchmark)\n`;
    text += `• Total Sent: ${statistics.sent.toLocaleString()}\n\n`;

    if (analysis.insights && analysis.insights.length > 0) {
      text += `KEY INSIGHTS\n`;
      const topInsights = this.prioritizeInsights(analysis.insights).slice(0, 3);
      topInsights.forEach((insight, index) => {
        text += `${index + 1}. ${insight.message}\n`;
      });
      text += `\n`;
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      text += `RECOMMENDED ACTIONS\n`;
      analysis.recommendations.slice(0, 3).forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
    }

    return text;
  }

  /**
   * Prioritize insights by impact and type
   */
  private prioritizeInsights(insights: CampaignInsight[]): CampaignInsight[] {
    return insights.sort((a, b) => {
      // Priority order: critical > warning > positive
      const typeOrder = { critical: 3, warning: 2, positive: 1 };
      const impactOrder = { high: 3, medium: 2, low: 1 };

      const aScore = (typeOrder[a.type] || 0) * 10 + (impactOrder[a.impact] || 0);
      const bScore = (typeOrder[b.type] || 0) * 10 + (impactOrder[b.impact] || 0);

      return bScore - aScore;
    });
  }

  /**
   * Generate fallback report if formatting fails
   */
  private generateFallbackReport(
    campaignName: string,
    roundNumber: number,
    statistics: EmailStatistics
  ): FormattedCampaignReport {
    const summary = `${campaignName} Round ${roundNumber} - ${statistics.sent.toLocaleString()} sent, ${statistics.deliveryRate}% delivered`;

    const text = `CAMPAIGN REPORT: ${campaignName} Round ${roundNumber}\n` +
      `Sent: ${statistics.sent.toLocaleString()}\n` +
      `Delivered: ${statistics.delivered.toLocaleString()} (${statistics.deliveryRate}%)\n` +
      `Opened: ${statistics.opened.toLocaleString()} (${statistics.openRate}%)\n` +
      `Clicked: ${statistics.clicked.toLocaleString()} (${statistics.clickRate}%)\n` +
      `Bounced: ${statistics.bounced} (${statistics.bounceRate}%)`;

    const blocks = [
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
          text: `*${campaignName} - Round ${roundNumber}*`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sent:* ${statistics.sent.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Delivered:* ${statistics.deliveryRate}%` },
          { type: 'mrkdwn', text: `*Opened:* ${statistics.openRate}%` },
          { type: 'mrkdwn', text: `*Clicked:* ${statistics.clickRate}%` }
        ]
      },
      { type: 'divider' }
    ];

    return { summary, text, blocks };
  }
}