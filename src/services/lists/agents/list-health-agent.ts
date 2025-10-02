/**
 * List Health Agent
 * AI agent that analyzes list health metrics and provides assessment
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/utils/logger';

export interface ListHealthMetrics {
  listName: string;
  contactCount: number;
  activeContactCount: number;
  bounceRate: number;
  hardBounceRate: number;
  softBounceRate: number;
  deliveryRate: number;
  spamRate?: number;
  unsubscribeRate?: number;
  senderReputation?: number;
}

export interface ListHealthAssessment {
  healthScore: number; // 0-100
  healthGrade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  summary: string;
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    action: string;
    expectedImpact: string;
  }>;
  trendAssessment: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export class ListHealthAgent {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private agentName = 'ListHealthAgent';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });
  }

  /**
   * Analyze list health and provide comprehensive assessment
   */
  async analyzeListHealth(metrics: ListHealthMetrics): Promise<ListHealthAssessment> {
    logger.info('[ListHealthAgent] Analyzing list health', { listName: metrics.listName });

    try {
      const systemPrompt = `You are an expert email deliverability analyst specializing in list health assessment.

Your task is to analyze email list health metrics and provide a comprehensive assessment.

Industry Benchmarks:
- Excellent: Bounce rate <1%, Delivery rate >99%
- Good: Bounce rate 1-2%, Delivery rate 97-99%
- Fair: Bounce rate 2-5%, Delivery rate 94-97%
- Poor: Bounce rate 5-10%, Delivery rate 90-94%
- Critical: Bounce rate >10%, Delivery rate <90%

Risk Factors to Consider:
- Hard bounce rate >2% - Indicates invalid/outdated addresses
- Soft bounce rate >5% - Suggests temporary delivery issues
- Spam rate >0.1% - Major sender reputation risk
- Unsubscribe rate >0.5% - Content/targeting issues
- Delivery rate <95% - Urgent attention needed

You must respond with ONLY a valid JSON object (no markdown formatting, no code blocks) with this exact structure:
{
  "healthScore": 0-100,
  "healthGrade": "excellent|good|fair|poor|critical",
  "summary": "Brief 1-2 sentence assessment",
  "riskFactors": [
    {
      "factor": "Risk name",
      "severity": "low|medium|high|critical",
      "description": "What this means"
    }
  ],
  "recommendations": [
    {
      "priority": "low|medium|high|critical",
      "action": "Specific action to take",
      "expectedImpact": "What will improve"
    }
  ],
  "trendAssessment": "Overall trend description",
  "urgency": "low|medium|high|critical"
}`;

      const userPrompt = `Analyze this email list:

List: ${metrics.listName}
Total Contacts: ${metrics.contactCount}
Active Contacts: ${metrics.activeContactCount}
Bounce Rate: ${(metrics.bounceRate * 100).toFixed(2)}%
Hard Bounce Rate: ${(metrics.hardBounceRate * 100).toFixed(2)}%
Soft Bounce Rate: ${(metrics.softBounceRate * 100).toFixed(2)}%
Delivery Rate: ${(metrics.deliveryRate * 100).toFixed(2)}%
${metrics.spamRate !== undefined ? `Spam Rate: ${(metrics.spamRate * 100).toFixed(2)}%` : ''}
${metrics.unsubscribeRate !== undefined ? `Unsubscribe Rate: ${(metrics.unsubscribeRate * 100).toFixed(2)}%` : ''}
${metrics.senderReputation !== undefined ? `Sender Reputation: ${metrics.senderReputation}/100` : ''}

Provide a comprehensive health assessment with actionable recommendations.`;

      const result = await this.model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const assessment = this.parseJSON<ListHealthAssessment>(text);

      // Validate response
      this.validateAssessment(assessment);

      logger.info('[ListHealthAgent] Analysis complete', {
        listName: metrics.listName,
        healthScore: assessment.healthScore,
        healthGrade: assessment.healthGrade
      });

      return assessment;
    } catch (error) {
      logger.error('[ListHealthAgent] Analysis failed', { error });
      throw error;
    }
  }

  /**
   * Parse JSON from AI response
   */
  private parseJSON<T>(text: string): T {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return JSON.parse(cleaned);
    } catch (error) {
      logger.error('[ListHealthAgent] JSON parsing failed', { text, error });
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Validate assessment structure
   */
  private validateAssessment(assessment: any): void {
    const required = [
      'healthScore',
      'healthGrade',
      'summary',
      'riskFactors',
      'recommendations',
      'trendAssessment',
      'urgency'
    ];

    const missing = required.filter(field => !(field in assessment));
    if (missing.length > 0) {
      throw new Error(`Assessment missing required fields: ${missing.join(', ')}`);
    }

    // Validate ranges
    if (assessment.healthScore < 0 || assessment.healthScore > 100) {
      throw new Error(`Invalid health score: ${assessment.healthScore}`);
    }

    // Validate arrays
    if (!Array.isArray(assessment.riskFactors)) {
      throw new Error('riskFactors must be an array');
    }

    if (!Array.isArray(assessment.recommendations)) {
      throw new Error('recommendations must be an array');
    }
  }
}
