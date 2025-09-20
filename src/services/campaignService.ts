import { v4 as uuidv4 } from 'uuid';
import { Campaign, CampaignCreateRequest, CampaignMetrics } from '../types';
import { geminiService } from './geminiService';
import { logger } from '../index';

export class CampaignService {
  private campaigns: Map<string, Campaign> = new Map();

  async createCampaign(request: CampaignCreateRequest): Promise<Campaign> {
    const campaignId = uuidv4();
    const now = new Date().toISOString();

    const campaign: Campaign = {
      id: campaignId,
      name: request.name,
      type: request.type as Campaign['type'],
      status: 'draft',
      target_audience: request.target_audience,
      goals: request.goals,
      budget: request.budget ? {
        amount: request.budget,
        currency: 'USD',
        allocated: 0,
        spent: 0
      } : undefined,
      schedule: {
        start_date: request.start_date,
        end_date: request.end_date
      },
      channels: request.channels,
      content: request.content ? {
        primary_message: request.content
      } : undefined,
      metrics: this.initializeMetrics(),
      created_at: now,
      updated_at: now
    };

    // Use Gemini to enhance campaign with AI insights
    if (geminiService.isConfigured()) {
      try {
        const enhancement = await geminiService.enhanceCampaign(campaign);
        Object.assign(campaign, enhancement);
      } catch (error) {
        logger.warn('Failed to enhance campaign with AI:', error);
      }
    }

    this.campaigns.set(campaignId, campaign);
    logger.info(`Campaign created: ${campaignId}`);

    return campaign;
  }

  async analyzeCampaign(campaignId: string): Promise<any> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!geminiService.isConfigured()) {
      return {
        campaign_id: campaignId,
        analysis: 'AI analysis not available. Configure Gemini API key.',
        metrics: campaign.metrics
      };
    }

    const analysis = await geminiService.analyzeCampaign(campaign);
    return {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      ...analysis
    };
  }

  async optimizeCampaign(campaignId: string, goals: string[]): Promise<any> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!geminiService.isConfigured()) {
      return {
        campaign_id: campaignId,
        optimization: 'AI optimization not available. Configure Gemini API key.',
        current_metrics: campaign.metrics
      };
    }

    const optimization = await geminiService.optimizeCampaign(campaign, goals);

    // Apply some optimizations to the campaign
    if (optimization.recommended_changes) {
      campaign.updated_at = new Date().toISOString();
      this.campaigns.set(campaignId, campaign);
    }

    return {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      ...optimization
    };
  }

  getCampaign(campaignId: string): Campaign | undefined {
    return this.campaigns.get(campaignId);
  }

  listCampaigns(filters?: { status?: string; type?: string }): Campaign[] {
    let campaigns = Array.from(this.campaigns.values());

    if (filters) {
      if (filters.status) {
        campaigns = campaigns.filter(c => c.status === filters.status);
      }
      if (filters.type) {
        campaigns = campaigns.filter(c => c.type === filters.type);
      }
    }

    return campaigns;
  }

  updateCampaignStatus(campaignId: string, status: Campaign['status']): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    campaign.status = status;
    campaign.updated_at = new Date().toISOString();
    this.campaigns.set(campaignId, campaign);

    logger.info(`Campaign ${campaignId} status updated to ${status}`);
    return campaign;
  }

  deleteCampaign(campaignId: string): boolean {
    const deleted = this.campaigns.delete(campaignId);
    if (deleted) {
      logger.info(`Campaign deleted: ${campaignId}`);
    }
    return deleted;
  }

  private initializeMetrics(): CampaignMetrics {
    return {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      engagement_rate: 0,
      roi: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0
    };
  }
}

// Export singleton instance
export const campaignService = new CampaignService();