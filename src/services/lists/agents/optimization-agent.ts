/**
 * Optimization Agent
 * AI agent that recommends contact suppressions and list optimizations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/utils/logger';

export interface BounceData {
  contactId: string;
  email: string;
  bounceType: 'hard' | 'soft' | 'spam';
  bounceCount: number;
  lastBounceDate: Date;
  firstBounceDate?: Date;
}

export interface OptimizationContext {
  campaignName?: string;
  listName: string;
  bounces: BounceData[];
  currentDeliveryRate: number;
  targetDeliveryRate?: number;
}

export interface SuppressionRecommendation {
  contactId: string;
  email: string;
  reason: string;
  confidence: number; // 0-1
  rationale: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationPlan {
  totalBounces: number;
  recommendedSuppressions: number;
  suppressions: SuppressionRecommendation[];
  summary: string;
  expectedImpact: {
    deliveryRateImprovement: number;
    bounceRateReduction: number;
    healthScoreIncrease: number;
  };
  confidence: number; // 0-1
}

export class OptimizationAgent {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private agentName = 'OptimizationAgent';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.5, // Lower temperature for more consistent recommendations
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Larger output for detailed plans
      }
    });
  }

  /**
   * Generate suppression recommendations based on bounce data
   */
  async generateSuppressionPlan(context: OptimizationContext): Promise<OptimizationPlan> {
    logger.info('[OptimizationAgent] Generating suppression plan', {
      listName: context.listName,
      bouncesCount: context.bounces.length
    });

    try {
      const systemPrompt = `You are an expert email deliverability engineer specializing in list optimization and suppression strategies.

Your task is to analyze bounce data and recommend which contacts should be suppressed to improve list health.

Suppression Rules:
1. HARD BOUNCES (Invalid/Non-existent emails):
   - Suppress immediately (100% confidence)
   - Priority: CRITICAL
   - Reason: "Invalid email address - hard bounce"

2. SPAM COMPLAINTS:
   - Suppress immediately (100% confidence)
   - Priority: CRITICAL
   - Reason: "Spam complaint - sender reputation risk"

3. SOFT BOUNCES (Temporary issues):
   - 1-2 soft bounces: Monitor only (do NOT suppress)
   - 3+ soft bounces over 30 days: Suppress (80% confidence)
   - 5+ soft bounces: Suppress (95% confidence)
   - Priority: HIGH for 3-4 bounces, CRITICAL for 5+
   - Reason: "Repeated soft bounces - likely permanent issue"

4. CONSERVATIVE APPROACH:
   - When in doubt, do NOT suppress
   - Better to keep a contact than suppress incorrectly
   - Only suppress when confident it will improve deliverability

Expected Impact Calculation:
- Delivery Rate = (Total Contacts - Bounces) / Total Contacts
- After Suppression = (Total Contacts - Suppressions - Remaining Bounces) / (Total Contacts - Suppressions)

You must respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "totalBounces": number,
  "recommendedSuppressions": number,
  "suppressions": [
    {
      "contactId": "string",
      "email": "string",
      "reason": "string",
      "confidence": 0-1,
      "rationale": "1-2 sentence explanation",
      "priority": "low|medium|high|critical"
    }
  ],
  "summary": "Brief summary of recommendations",
  "expectedImpact": {
    "deliveryRateImprovement": number (percentage points),
    "bounceRateReduction": number (percentage points),
    "healthScoreIncrease": number (0-100 scale)
  },
  "confidence": 0-1
}`;

      const bounceSummary = context.bounces.map(b => ({
        contactId: b.contactId,
        email: b.email,
        type: b.bounceType,
        count: b.bounceCount,
        lastBounce: b.lastBounceDate.toISOString().split('T')[0],
        daysSinceFirst: b.firstBounceDate
          ? Math.floor((Date.now() - b.firstBounceDate.getTime()) / (1000 * 60 * 60 * 24))
          : null
      }));

      const userPrompt = `Analyze bounces and recommend suppressions:

${context.campaignName ? `Campaign: ${context.campaignName}` : ''}
List: ${context.listName}
Total Bounces: ${context.bounces.length}
Current Delivery Rate: ${(context.currentDeliveryRate * 100).toFixed(2)}%
${context.targetDeliveryRate ? `Target Delivery Rate: ${(context.targetDeliveryRate * 100).toFixed(2)}%` : ''}

Bounce Data:
${JSON.stringify(bounceSummary, null, 2)}

Provide suppression recommendations following the rules above. Be conservative - only recommend suppression when confident it will improve deliverability.`;

      const result = await this.model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const plan = this.parseJSON<OptimizationPlan>(text);

      // Validate response
      this.validatePlan(plan);

      logger.info('[OptimizationAgent] Plan generated', {
        listName: context.listName,
        recommendedSuppressions: plan.recommendedSuppressions,
        confidence: plan.confidence
      });

      return plan;
    } catch (error) {
      logger.error('[OptimizationAgent] Plan generation failed', { error });
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
      logger.error('[OptimizationAgent] JSON parsing failed', { text, error });
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Validate optimization plan structure
   */
  private validatePlan(plan: any): void {
    const required = [
      'totalBounces',
      'recommendedSuppressions',
      'suppressions',
      'summary',
      'expectedImpact',
      'confidence'
    ];

    const missing = required.filter(field => !(field in plan));
    if (missing.length > 0) {
      throw new Error(`Plan missing required fields: ${missing.join(', ')}`);
    }

    // Validate arrays
    if (!Array.isArray(plan.suppressions)) {
      throw new Error('suppressions must be an array');
    }

    // Validate confidence
    if (plan.confidence < 0 || plan.confidence > 1) {
      throw new Error(`Invalid confidence: ${plan.confidence}`);
    }

    // Validate each suppression
    for (const suppression of plan.suppressions) {
      if (!suppression.contactId || !suppression.email || !suppression.reason) {
        throw new Error('Each suppression must have contactId, email, and reason');
      }

      if (suppression.confidence < 0 || suppression.confidence > 1) {
        throw new Error(`Invalid suppression confidence: ${suppression.confidence}`);
      }
    }
  }
}
