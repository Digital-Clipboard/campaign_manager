/**
 * Rebalancing Agent
 * AI agent that calculates optimal contact distribution across campaign lists
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/utils/logger';

export interface ListState {
  listId: string;
  listName: string;
  roundNumber: 1 | 2 | 3;
  currentContactCount: number;
  targetContactCount?: number;
}

export interface RebalancingContext {
  lists: [ListState, ListState, ListState]; // Exactly 3 lists
  totalContacts: number;
  suppressedCount: number;
  preserveFIFO: boolean;
}

export interface ContactMove {
  contactId: string;
  fromListId: string;
  toListId: string;
  position: number; // New position in target list (for FIFO)
  reason: string;
}

export interface RebalancingPlan {
  isBalanced: boolean;
  targetPerList: number;
  moves: ContactMove[];
  summary: string;
  rationale: string;
  balanceScore: number; // 0-100, where 100 = perfect balance
  expectedResult: {
    round1Count: number;
    round2Count: number;
    round3Count: number;
    standardDeviation: number;
  };
}

export class RebalancingAgent {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private agentName = 'RebalancingAgent';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3, // Very low temperature for deterministic calculations
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 3096,
      }
    });
  }

  /**
   * Generate rebalancing plan to equalize campaign lists
   */
  async generateRebalancingPlan(context: RebalancingContext): Promise<RebalancingPlan> {
    logger.info('[RebalancingAgent] Generating rebalancing plan', {
      totalContacts: context.totalContacts,
      list1: context.lists[0].currentContactCount,
      list2: context.lists[1].currentContactCount,
      list3: context.lists[2].currentContactCount
    });

    try {
      const systemPrompt = `You are an expert data engineer specializing in list balancing and FIFO (First-In-First-Out) ordering.

Your task is to calculate the optimal redistribution of contacts across 3 campaign lists to achieve equal distribution.

Rebalancing Rules:
1. TARGET: Each list should have ≈${Math.floor(context.totalContacts / 3)} contacts (equal thirds)
2. TOLERANCE: ±5% variance is acceptable (no rebalancing needed)
3. MINIMIZE MOVES: Only move contacts if necessary to achieve balance
4. PRESERVE FIFO: Maintain contact ordering (oldest contacts stay in earlier positions)
5. ROUND-ROBIN: When moving contacts, distribute evenly (move from largest to smallest lists)

Balance Score Calculation:
- Perfect balance (all lists within ±1 contact): 100
- Within ±5%: 90-99
- Within ±10%: 80-89
- Within ±20%: 60-79
- Greater than ±20%: <60

Standard Deviation Formula:
- Calculate mean contacts per list
- SD = sqrt(sum((list_count - mean)^2) / 3)
- Lower SD = better balance

You must respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "isBalanced": boolean,
  "targetPerList": number,
  "moves": [
    {
      "contactId": "move_from_largest_to_smallest",
      "fromListId": "string",
      "toListId": "string",
      "position": number,
      "reason": "Brief explanation"
    }
  ],
  "summary": "Brief summary of plan",
  "rationale": "Detailed explanation of decisions",
  "balanceScore": 0-100,
  "expectedResult": {
    "round1Count": number,
    "round2Count": number,
    "round3Count": number,
    "standardDeviation": number
  }
}

If lists are already balanced (within ±5%), return isBalanced=true with empty moves array.`;

      const userPrompt = `Analyze and rebalance these campaign lists:

Total Contacts: ${context.totalContacts}
Suppressed: ${context.suppressedCount}
Active Contacts: ${context.totalContacts - context.suppressedCount}
Preserve FIFO: ${context.preserveFIFO}

Current Distribution:
- Round 1 (${context.lists[0].listName}): ${context.lists[0].currentContactCount} contacts
- Round 2 (${context.lists[1].listName}): ${context.lists[1].currentContactCount} contacts
- Round 3 (${context.lists[2].listName}): ${context.lists[2].currentContactCount} contacts

Target per list: ${Math.floor((context.totalContacts - context.suppressedCount) / 3)}

Calculate the optimal rebalancing plan. If already balanced, return isBalanced=true with no moves.`;

      const result = await this.model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const plan = this.parseJSON<RebalancingPlan>(text);

      // Validate response
      this.validatePlan(plan);

      logger.info('[RebalancingAgent] Plan generated', {
        isBalanced: plan.isBalanced,
        movesCount: plan.moves.length,
        balanceScore: plan.balanceScore
      });

      return plan;
    } catch (error) {
      logger.error('[RebalancingAgent] Plan generation failed', { error });
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
      logger.error('[RebalancingAgent] JSON parsing failed', { text, error });
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Validate rebalancing plan structure
   */
  private validatePlan(plan: any): void {
    const required = [
      'isBalanced',
      'targetPerList',
      'moves',
      'summary',
      'rationale',
      'balanceScore',
      'expectedResult'
    ];

    const missing = required.filter(field => !(field in plan));
    if (missing.length > 0) {
      throw new Error(`Plan missing required fields: ${missing.join(', ')}`);
    }

    // Validate arrays
    if (!Array.isArray(plan.moves)) {
      throw new Error('moves must be an array');
    }

    // Validate balance score
    if (plan.balanceScore < 0 || plan.balanceScore > 100) {
      throw new Error(`Invalid balance score: ${plan.balanceScore}`);
    }

    // Validate each move
    for (const move of plan.moves) {
      if (!move.fromListId || !move.toListId) {
        throw new Error('Each move must have fromListId and toListId');
      }
    }

    // Validate expected result
    const result = plan.expectedResult;
    if (!result || typeof result.round1Count !== 'number') {
      throw new Error('Invalid expectedResult structure');
    }
  }
}
