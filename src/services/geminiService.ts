import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../index';
import { Campaign } from '../types';

export class GeminiService {
  private model: GenerativeModel | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;

    if (this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        logger.info('Gemini AI service initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Gemini AI service:', error);
      }
    } else {
      logger.warn('Gemini API key not configured');
    }
  }

  async enhanceCampaign(campaign: Campaign): Promise<Partial<Campaign>> {
    if (!this.model) {
      return {};
    }

    const prompt = `
      As a campaign management expert, enhance this marketing campaign with insights:

      Campaign: ${campaign.name}
      Type: ${campaign.type}
      Target Audience: ${campaign.target_audience}
      Goals: ${campaign.goals.join(', ')}
      Budget: ${campaign.budget ? `$${campaign.budget.amount}` : 'Not specified'}
      Channels: ${campaign.channels?.join(', ') || 'Not specified'}

      Provide specific recommendations for:
      1. Content messaging improvements
      2. Channel optimization
      3. Budget allocation suggestions
      4. Target audience refinements
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const insights = response.text();

      // Parse and structure the insights (in production, this would be more sophisticated)
      return {
        description: insights.substring(0, 500) // Take first part as description
      };
    } catch (error) {
      logger.error('Error enhancing campaign with Gemini:', error);
      return {};
    }
  }

  async analyzeCampaign(campaign: Campaign): Promise<any> {
    if (!this.model) {
      throw new Error('Gemini AI service not configured');
    }

    const prompt = `
      As a campaign analytics expert, analyze this marketing campaign:

      Campaign: ${campaign.name}
      Type: ${campaign.type}
      Status: ${campaign.status}
      Target Audience: ${campaign.target_audience}
      Goals: ${campaign.goals.join(', ')}
      Current Metrics:
      - Impressions: ${campaign.metrics?.impressions || 0}
      - Clicks: ${campaign.metrics?.clicks || 0}
      - Conversions: ${campaign.metrics?.conversions || 0}
      - Engagement Rate: ${campaign.metrics?.engagement_rate || 0}%

      Provide:
      1. Performance analysis
      2. Strengths and weaknesses
      3. Recommendations for improvement
      4. Predicted outcomes
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return {
        analysis: response.text(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error analyzing campaign:', error);
      throw error;
    }
  }

  async optimizeCampaign(campaign: Campaign, goals: string[]): Promise<any> {
    if (!this.model) {
      throw new Error('Gemini AI service not configured');
    }

    const prompt = `
      As a campaign optimization expert, optimize this marketing campaign for these goals: ${goals.join(', ')}

      Current Campaign:
      - Name: ${campaign.name}
      - Type: ${campaign.type}
      - Target Audience: ${campaign.target_audience}
      - Budget: ${campaign.budget ? `$${campaign.budget.amount}` : 'Not specified'}
      - Channels: ${campaign.channels?.join(', ') || 'Not specified'}
      - Content: ${campaign.content?.primary_message || 'Not specified'}

      Provide:
      1. Specific optimization strategies
      2. Content improvements
      3. Channel reallocation recommendations
      4. Budget optimization suggestions
      5. Timeline adjustments
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return {
        optimization_plan: response.text(),
        goals_addressed: goals,
        timestamp: new Date().toISOString(),
        recommended_changes: true
      };
    } catch (error) {
      logger.error('Error optimizing campaign:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.model !== null;
  }
}

// Export singleton instance
export const geminiService = new GeminiService();