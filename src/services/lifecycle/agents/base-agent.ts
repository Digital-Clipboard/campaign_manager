/**
 * Base Agent
 * Foundation for all lifecycle AI agents using Google Gemini 2.0 Flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/utils/logger';

export interface AgentContext {
  campaignName: string;
  roundNumber: number;
  timestamp: Date;
}

export abstract class BaseAgent {
  protected genAI: GoogleGenerativeAI;
  protected model: any;
  protected agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;

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
   * Generate AI response using structured prompt
   */
  protected async generate(
    systemPrompt: string,
    userPrompt: string,
    context: AgentContext
  ): Promise<string> {
    try {
      const fullPrompt = `${systemPrompt}

Campaign Context:
- Campaign: ${context.campaignName}
- Round: ${context.roundNumber}
- Timestamp: ${context.timestamp.toISOString()}

${userPrompt}`;

      logger.debug(`[${this.agentName}] Generating AI response`, {
        campaignName: context.campaignName,
        roundNumber: context.roundNumber
      });

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      logger.debug(`[${this.agentName}] AI response generated`, {
        responseLength: text.length
      });

      return text;

    } catch (error) {
      logger.error(`[${this.agentName}] AI generation failed`, { error });
      throw new Error(`${this.agentName} AI generation failed: ${error}`);
    }
  }

  /**
   * Parse JSON from AI response
   * Handles markdown code blocks and extracts JSON
   */
  protected parseJSON<T>(text: string): T {
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
      logger.error(`[${this.agentName}] JSON parsing failed`, { text, error });
      throw new Error(`Failed to parse JSON from ${this.agentName}: ${error}`);
    }
  }

  /**
   * Validate required fields in response
   */
  protected validateResponse<T extends Record<string, any>>(
    response: T,
    requiredFields: string[]
  ): void {
    const missing = requiredFields.filter(field => !(field in response));
    if (missing.length > 0) {
      throw new Error(`${this.agentName} response missing fields: ${missing.join(', ')}`);
    }
  }
}
