export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: 'email' | 'social' | 'content' | 'ppc' | 'seo' | 'multi-channel';
  status: 'draft' | 'active' | 'paused' | 'scheduled' | 'completed';
  target_audience: string;
  goals: string[];
  budget?: {
    amount: number;
    currency: string;
    allocated?: number;
    spent?: number;
  };
  schedule: {
    start_date: string;
    end_date?: string;
    timezone?: string;
  };
  channels?: string[];
  content?: {
    primary_message: string;
    variations?: string[];
    assets?: string[];
  };
  metrics?: CampaignMetrics;
  created_at: string;
  updated_at: string;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  engagement_rate: number;
  roi?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
}

export interface CampaignCreateRequest {
  name: string;
  type: string;
  target_audience: string;
  goals: string[];
  budget?: number;
  start_date: string;
  end_date?: string;
  channels?: string[];
  content?: string;
}

export interface CampaignAnalysisRequest {
  campaign_id?: string;
  campaign_data?: Partial<Campaign>;
  analysis_depth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface CampaignOptimizationRequest {
  campaign_id?: string;
  campaign_data?: Partial<Campaign>;
  optimization_goals: string[];
  constraints?: {
    budget_limit?: number;
    time_limit?: string;
    channels?: string[];
  };
}

export interface CampaignResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    timestamp: string;
    [key: string]: any;
  };
}