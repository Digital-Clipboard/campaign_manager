import { logger } from '@/utils/logger';

export interface MCPConfig {
  name: string;
  url: string;
  apiKey?: string;
  timeout?: number;
}

export interface MCPToolCall {
  tool: string;
  params?: Record<string, any>;
}

export interface MCPResponse<T = any> {
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class BaseMCPClient {
  protected name: string;
  protected url: string;
  protected apiKey?: string;
  protected timeout: number;

  constructor(config: MCPConfig) {
    this.name = config.name;
    this.url = config.url;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000; // 30 seconds default
  }

  protected async callTool<T = any>(
    tool: string,
    params?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      logger.info(`Calling MCP tool ${this.name}.${tool}`, { params });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({ tool, params }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
      }

      const data: MCPResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`MCP tool error: ${data.error.message}`);
      }

      const duration = Date.now() - startTime;
      logger.info(`MCP tool ${this.name}.${tool} completed`, { duration });

      return data.result as T;

    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error(`MCP tool ${this.name}.${tool} timed out`, { duration, timeout: this.timeout });
          throw new Error(`MCP call timed out after ${this.timeout}ms`);
        }
      }

      logger.error(`MCP tool ${this.name}.${tool} failed`, { error, duration });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/health`, {
        method: 'GET',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      const isHealthy = response.ok;

      if (isHealthy) {
        logger.info(`MCP connection to ${this.name} successful`);
      } else {
        logger.warn(`MCP connection to ${this.name} unhealthy`, { status: response.status });
      }

      return isHealthy;

    } catch (error) {
      logger.error(`Failed to connect to MCP service ${this.name}`, { error });
      return false;
    }
  }

  async listTools(): Promise<any[]> {
    try {
      const response = await fetch(`${this.url}/mcp/tools`, {
        method: 'GET',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list tools: ${response.status}`);
      }

      const data = await response.json();
      return data.tools || [];

    } catch (error) {
      logger.error(`Failed to list tools for ${this.name}`, { error });
      return [];
    }
  }
}