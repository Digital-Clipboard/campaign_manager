import { BaseMCPClient } from './base-mcp-client';
import { logger } from '@/utils/logger';

export interface CampaignAttribution {
  campaignId: string;
  source: string;
  medium: string;
  conversions: number;
  revenue: number;
  roi: number;
  costPerAcquisition: number;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  clickThroughRate: number;
  costPerClick: number;
  revenue: number;
  roi: number;
}

export interface EmailPerformance {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface ConversionData {
  totalConversions: number;
  conversionsBySource: Record<string, number>;
  conversionsByDevice: Record<string, number>;
  conversionValue: number;
  averageOrderValue: number;
}

export class MarketingAgentClient extends BaseMCPClient {
  constructor() {
    super({
      name: 'marketing-agent',
      url: process.env.MARKETING_AGENT_URL || 'https://marketing-agent-prod.herokuapp.com',
      apiKey: process.env.MARKETING_AGENT_API_KEY,
      timeout: 30000
    });
  }

  // Campaign Performance
  async getCampaignAttribution(campaignId: string): Promise<CampaignAttribution> {
    return this.callTool<CampaignAttribution>('get_campaign_attribution', {
      campaign_id: campaignId
    });
  }

  async syncCampaignMetrics(
    campaignId: string,
    externalId: string,
    platform: string
  ): Promise<CampaignMetrics> {
    return this.callTool<CampaignMetrics>('sync_campaign_metrics', {
      campaign_id: campaignId,
      external_id: externalId,
      platform
    });
  }

  async getConversionData(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ConversionData> {
    return this.callTool<ConversionData>('get_conversion_data', {
      campaign_id: campaignId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });
  }

  async trackCampaignPerformance(
    campaignId: string,
    metrics: Partial<CampaignMetrics>
  ): Promise<boolean> {
    const result = await this.callTool<{ success: boolean }>('track_campaign_performance', {
      campaign_id: campaignId,
      metrics
    });
    return result.success;
  }

  async getROIAnalysis(campaignId: string): Promise<{
    roi: number;
    revenue: number;
    cost: number;
    profit: number;
    breakEvenPoint: Date | null;
  }> {
    return this.callTool('get_roi_analysis', { campaign_id: campaignId });
  }

  // Email Campaign Performance
  async getEmailCampaignMetrics(campaignId: string): Promise<EmailPerformance> {
    return this.callTool<EmailPerformance>('get_email_campaign_metrics', {
      campaign_id: campaignId
    });
  }

  async syncEmailStatistics(
    campaignId: string,
    mailjetCampaignId: string
  ): Promise<EmailPerformance> {
    return this.callTool<EmailPerformance>('sync_email_statistics', {
      campaign_id: campaignId,
      mailjet_campaign_id: mailjetCampaignId
    });
  }

  // Analytics and Insights
  async getCustomerSegments(campaignId: string): Promise<{
    segments: Array<{
      name: string;
      size: number;
      conversionRate: number;
      averageValue: number;
    }>;
  }> {
    return this.callTool('get_customer_segments', { campaign_id: campaignId });
  }

  async getPredictedPerformance(
    campaignType: string,
    budget: number,
    targetAudience: number
  ): Promise<{
    expectedReach: number;
    expectedConversions: number;
    expectedRevenue: number;
    confidenceScore: number;
  }> {
    return this.callTool('get_predicted_performance', {
      campaign_type: campaignType,
      budget,
      target_audience: targetAudience
    });
  }

  async getCompetitorAnalysis(industry: string, region: string): Promise<{
    averagePerformance: CampaignMetrics;
    topPerformers: Array<{
      company: string;
      performance: CampaignMetrics;
    }>;
    recommendations: string[];
  }> {
    return this.callTool('get_competitor_analysis', {
      industry,
      region
    });
  }

  // A/B Testing
  async createABTest(
    campaignId: string,
    variants: Array<{
      name: string;
      content: any;
      percentage: number;
    }>
  ): Promise<{
    testId: string;
    variants: Array<{ id: string; name: string }>;
  }> {
    return this.callTool('create_ab_test', {
      campaign_id: campaignId,
      variants
    });
  }

  async getABTestResults(testId: string): Promise<{
    winner: string | null;
    variants: Array<{
      id: string;
      name: string;
      metrics: CampaignMetrics;
      statisticalSignificance: number;
    }>;
    recommendation: string;
  }> {
    return this.callTool('get_ab_test_results', { test_id: testId });
  }

  // Lead Scoring and Attribution
  async scoreLeads(campaignId: string): Promise<{
    leads: Array<{
      id: string;
      score: number;
      tier: 'hot' | 'warm' | 'cold';
      nextBestAction: string;
    }>;
  }> {
    return this.callTool('score_leads', { campaign_id: campaignId });
  }

  async getMultiTouchAttribution(customerId: string): Promise<{
    touchpoints: Array<{
      campaign: string;
      channel: string;
      timestamp: Date;
      attributionWeight: number;
    }>;
    conversionPath: string[];
    totalTouchpoints: number;
  }> {
    return this.callTool('get_multi_touch_attribution', { customer_id: customerId });
  }

  // Helper Methods for Campaign Manager Integration

  async syncCampaignResults(
    campaignId: string,
    campaignName: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    metrics: CampaignMetrics;
    attribution: CampaignAttribution;
    emailPerformance?: EmailPerformance;
  }> {
    try {
      logger.info('Syncing campaign results from Marketing Agent', { campaignId });

      const [metrics, attribution] = await Promise.all([
        this.syncCampaignMetrics(campaignId, campaignId, 'campaign_manager'),
        this.getCampaignAttribution(campaignId)
      ]);

      // Try to get email performance if it's an email campaign
      let emailPerformance: EmailPerformance | undefined;
      try {
        emailPerformance = await this.getEmailCampaignMetrics(campaignId);
      } catch (error) {
        logger.debug('No email metrics available for campaign', { campaignId });
      }

      return {
        metrics,
        attribution,
        emailPerformance
      };

    } catch (error) {
      logger.error('Failed to sync campaign results', { campaignId, error });
      throw error;
    }
  }

  async generateCampaignReport(campaignId: string): Promise<{
    summary: string;
    metrics: CampaignMetrics;
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const [metrics, attribution, roi] = await Promise.all([
        this.syncCampaignMetrics(campaignId, campaignId, 'campaign_manager'),
        this.getCampaignAttribution(campaignId),
        this.getROIAnalysis(campaignId)
      ]);

      const insights: string[] = [];
      const recommendations: string[] = [];

      // Generate insights
      if (metrics.conversionRate < 2) {
        insights.push('Conversion rate is below industry average');
        recommendations.push('Consider A/B testing different landing pages');
      }

      if (roi.roi < 100) {
        insights.push('ROI is below target');
        recommendations.push('Optimize targeting to reduce cost per acquisition');
      }

      if (metrics.clickThroughRate < 2) {
        insights.push('Click-through rate needs improvement');
        recommendations.push('Test different ad creatives and copy');
      }

      const summary = `Campaign generated ${metrics.conversions} conversions with a ${metrics.conversionRate.toFixed(2)}% conversion rate and ${roi.roi.toFixed(0)}% ROI.`;

      return {
        summary,
        metrics,
        insights,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to generate campaign report', { campaignId, error });
      throw error;
    }
  }
}