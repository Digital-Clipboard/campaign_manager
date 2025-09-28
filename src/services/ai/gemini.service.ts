import { logger } from '../../utils/logger';

export interface ActivityData {
  name: string;
  activityType: string;
  dayOfWeek: string;
  time: string;
  recipientCount?: number;
  segment?: string;
  details?: string;
  status: string;
  campaign?: {
    name: string;
    type: string;
    objectives: string[];
    budget?: number;
    metadata?: any;
  };
}

export interface EnhancedActivityDescription {
  enhancedDescription: string;
  businessContext: string;
  targets: string[];
  keyMetrics: string[];
}

export interface WeeklySummaryEnhancement {
  weekSummary: string;
  keyInsights: string[];
  businessImpact: string;
  recommendedActions: string[];
}

export class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Gemini API key not configured - AI enhancements will be disabled');
    }
  }

  async enhanceActivityDescription(activity: ActivityData): Promise<EnhancedActivityDescription> {
    if (!this.apiKey) {
      return this.createFallbackDescription(activity);
    }

    try {
      const prompt = this.buildActivityEnhancementPrompt(activity);
      const response = await this.callGemini(prompt);
      return this.parseActivityResponse(response, activity);
    } catch (error) {
      logger.error('Failed to enhance activity description with Gemini', {
        error: error.message,
        activity: activity.name
      });
      return this.createFallbackDescription(activity);
    }
  }

  async generateWeeklySummaryInsights(activities: ActivityData[]): Promise<WeeklySummaryEnhancement> {
    if (!this.apiKey) {
      return this.createFallbackWeeklySummary(activities);
    }

    try {
      const prompt = this.buildWeeklySummaryPrompt(activities);
      const response = await this.callGemini(prompt);
      return this.parseWeeklySummaryResponse(response, activities);
    } catch (error) {
      logger.error('Failed to generate weekly summary insights', {
        error: error.message,
        activitiesCount: activities.length
      });
      return this.createFallbackWeeklySummary(activities);
    }
  }

  private buildActivityEnhancementPrompt(activity: ActivityData): string {
    return `You are a marketing campaign analyst. Transform this basic activity into a professional business description with context and targets.

Activity: ${activity.name}
Type: ${activity.activityType}
Day: ${activity.dayOfWeek} at ${activity.time}
Recipients: ${activity.recipientCount || 'Unknown'}
Segment: ${activity.segment || 'General'}
Details: ${activity.details || 'None provided'}
Campaign Context: ${activity.campaign ? JSON.stringify(activity.campaign) : 'None'}

Provide a JSON response with these fields:
{
  "enhancedDescription": "Professional 2-3 sentence description with business context",
  "businessContext": "Why this activity matters to the business (1-2 sentences)",
  "targets": ["Specific measurable targets based on activity type and historical data"],
  "keyMetrics": ["Key performance indicators to track"]
}

Focus on:
- Business value and strategic importance
- Realistic targets based on activity type (email campaigns typically 20-30% open rates, demo requests 2-5% of recipients)
- Clear, professional language suitable for executive summaries
- Specific metrics that matter for this type of activity`;
  }

  private buildWeeklySummaryPrompt(activities: ActivityData[]): string {
    const activitiesText = activities.map(a =>
      `${a.name} (${a.activityType}) - ${a.dayOfWeek} ${a.time} - ${a.recipientCount || 0} recipients`
    ).join('\n');

    return `You are a marketing operations analyst creating a weekly traction summary for executives.

This Week's Activities:
${activitiesText}

Total Recipients: ${activities.reduce((sum, a) => sum + (a.recipientCount || 0), 0)}
Active Campaigns: ${activities.length}

Provide a JSON response with:
{
  "weekSummary": "Executive-level summary of the week's traction activities (2-3 sentences)",
  "keyInsights": ["3-4 key business insights about this week's activities"],
  "businessImpact": "Overall business impact and strategic value (1-2 sentences)",
  "recommendedActions": ["2-3 specific actionable recommendations based on this week's schedule"]
}

Focus on:
- Strategic business value and traction generation
- Cross-campaign relationships and synergies
- Resource allocation and timing optimization
- Measurable business outcomes`;
  }

  private async callGemini(prompt: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private parseActivityResponse(response: string, activity: ActivityData): EnhancedActivityDescription {
    try {
      const parsed = JSON.parse(response);
      return {
        enhancedDescription: parsed.enhancedDescription || this.createFallbackDescription(activity).enhancedDescription,
        businessContext: parsed.businessContext || 'Strategic marketing activity',
        targets: parsed.targets || this.generateFallbackTargets(activity),
        keyMetrics: parsed.keyMetrics || ['Engagement rate', 'Conversion rate', 'ROI']
      };
    } catch (error) {
      logger.warn('Failed to parse Gemini activity response, using fallback');
      return this.createFallbackDescription(activity);
    }
  }

  private parseWeeklySummaryResponse(response: string, activities: ActivityData[]): WeeklySummaryEnhancement {
    try {
      const parsed = JSON.parse(response);
      return {
        weekSummary: parsed.weekSummary || `${activities.length} strategic marketing activities planned`,
        keyInsights: parsed.keyInsights || ['Multiple touchpoints planned', 'Diverse audience segments targeted'],
        businessImpact: parsed.businessImpact || 'Supporting customer acquisition and engagement goals',
        recommendedActions: parsed.recommendedActions || ['Monitor performance metrics', 'Optimize timing based on results']
      };
    } catch (error) {
      logger.warn('Failed to parse Gemini weekly summary response, using fallback');
      return this.createFallbackWeeklySummary(activities);
    }
  }

  private createFallbackDescription(activity: ActivityData): EnhancedActivityDescription {
    const targets = this.generateFallbackTargets(activity);

    return {
      enhancedDescription: `${activity.name} targeting ${activity.recipientCount || 'qualified'} prospects via ${activity.activityType.toLowerCase()}`,
      businessContext: 'Strategic marketing activity supporting customer acquisition and engagement objectives',
      targets,
      keyMetrics: this.generateFallbackMetrics(activity)
    };
  }

  private createFallbackWeeklySummary(activities: ActivityData[]): WeeklySummaryEnhancement {
    const totalRecipients = activities.reduce((sum, a) => sum + (a.recipientCount || 0), 0);

    return {
      weekSummary: `${activities.length} strategic marketing activities planned reaching ${totalRecipients.toLocaleString()} total prospects`,
      keyInsights: [
        'Multiple touchpoints scheduled across the week',
        'Diverse activity types supporting different funnel stages',
        'Balanced approach to customer acquisition and engagement'
      ],
      businessImpact: 'Supporting quarterly traction goals through targeted customer outreach and engagement',
      recommendedActions: [
        'Monitor key performance metrics throughout execution',
        'Adjust timing based on early performance indicators'
      ]
    };
  }

  private generateFallbackTargets(activity: ActivityData): string[] {
    const recipientCount = activity.recipientCount || 0;

    switch (activity.activityType.toLowerCase()) {
      case 'email':
      case 'email_blast':
        return [
          `${Math.round(recipientCount * 0.25)} opens (25% open rate)`,
          `${Math.round(recipientCount * 0.03)} clicks (3% click rate)`,
          `${Math.round(recipientCount * 0.005)} conversions (0.5% conversion rate)`
        ];
      case 'launch':
      case 'product_launch':
        return [
          `${Math.round(recipientCount * 0.15)} demo requests`,
          `${Math.round(recipientCount * 0.08)} qualified leads`,
          '20% improvement in product awareness'
        ];
      case 'webinar':
        return [
          `${Math.round(recipientCount * 0.3)} registrations`,
          `${Math.round(recipientCount * 0.15)} attendees`,
          `${Math.round(recipientCount * 0.02)} follow-up meetings`
        ];
      default:
        return [
          'Improve engagement metrics by 15%',
          'Generate qualified leads',
          'Support quarterly traction goals'
        ];
    }
  }

  private generateFallbackMetrics(activity: ActivityData): string[] {
    switch (activity.activityType.toLowerCase()) {
      case 'email':
      case 'email_blast':
        return ['Open rate', 'Click rate', 'Conversion rate', 'Unsubscribe rate'];
      case 'launch':
      case 'product_launch':
        return ['Demo requests', 'Qualified leads', 'Product awareness', 'Media mentions'];
      case 'webinar':
        return ['Registration rate', 'Attendance rate', 'Engagement score', 'Follow-up conversion'];
      default:
        return ['Engagement rate', 'Conversion rate', 'ROI', 'Customer satisfaction'];
    }
  }
}