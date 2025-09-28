import { logger } from '../utils/logger';

export interface SlackManagerMCPResponse {
  result?: any;
  error?: string;
}

export interface SlackMessageOptions {
  channel: string;
  text: string;
  blocks?: any[];
}

export class SlackManagerMCPService {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.SLACK_MANAGER_URL || 'https://slack-manager.herokuapp.com';
    this.apiToken = process.env.SLACK_MANAGER_API_TOKEN || '';

    if (!this.apiToken) {
      logger.warn('Slack Manager API token not configured - Slack notifications will be disabled');
    }
  }

  async callMCPTool(tool: string, params: any): Promise<SlackManagerMCPResponse> {
    if (!this.apiToken) {
      logger.warn('Slack Manager API token not configured, skipping MCP call');
      return { error: 'API token not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: JSON.stringify({
          tool,
          params
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Slack Manager MCP request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error calling Slack Manager MCP service', {
        tool,
        params,
        error: error.message
      });
      return { error: error.message };
    }
  }

  async getChannelId(channelName: string): Promise<string | null> {
    const cleanChannelName = channelName.startsWith('#') ? channelName.slice(1) : channelName;

    const response = await this.callMCPTool('get_channel_id', {
      channel_name: cleanChannelName
    });

    if (response.error) {
      logger.error('Failed to get channel ID', { channelName, error: response.error });
      return null;
    }

    return response.result?.channel_id || null;
  }

  async sendMessage(options: SlackMessageOptions): Promise<boolean> {
    const { channel, text, blocks } = options;

    // First, get the channel ID if we have a channel name
    let channelId = channel;
    if (channel.startsWith('#')) {
      channelId = await this.getChannelId(channel);
      if (!channelId) {
        logger.error('Could not resolve channel name to ID', { channel });
        return false;
      }
    }

    // IMPORTANT: Following Stripe Health Monitor pattern - send only text, no blocks
    // The Slack Manager MCP endpoint handles markdown-formatted text better than Block Kit
    const messageParams: any = {
      channel_id: channelId,
      text: text  // Send only the text, no blocks - let Slack handle markdown formatting
    };

    const response = await this.callMCPTool('send_message', messageParams);

    if (response.error) {
      logger.error('Failed to send Slack message', {
        channel,
        channelId,
        error: response.error
      });
      return false;
    }

    logger.info('Slack message sent successfully', {
      channel,
      channelId,
      messageId: response.result?.ts
    });

    return true;
  }

  async testConnection(): Promise<boolean> {
    const response = await this.callMCPTool('get_gateway_health', {});
    return !response.error && response.result?.status === 'healthy';
  }
}