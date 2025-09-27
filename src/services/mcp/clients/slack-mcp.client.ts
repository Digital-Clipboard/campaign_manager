import axios, { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';
import { CacheService } from '@/services/cache/cache.service';

export interface SlackUser {
  id: string;
  name: string;
  email: string;
  realName: string;
  deleted: boolean;
  isBot: boolean;
  isAdmin: boolean;
  timezone?: string;
  status?: {
    text: string;
    emoji: string;
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
  memberCount?: number;
  topic?: string;
  purpose?: string;
}

export interface SlackMessage {
  channel?: string;
  userId?: string;
  text: string;
  blocks?: any[];
  threadTs?: string;
}

export interface SlackMessageResult {
  ts: string;
  channel: string;
  message?: string;
}

/**
 * SlackMCPClient - Client for Slack Manager MCP integration
 */
export class SlackMCPClient {
  private client: AxiosInstance;
  private botToken: string;
  private appToken: string;

  constructor(private cache: CacheService) {
    this.botToken = process.env.SLACK_BOT_TOKEN || '';
    this.appToken = process.env.SLACK_APP_TOKEN || '';

    // For now, we'll use direct Slack API
    // In production, this would connect to the Slack Manager MCP server
    this.client = axios.create({
      baseURL: 'https://slack.com/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.botToken}`
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        if (response.data && !response.data.ok) {
          throw new Error(response.data.error || 'Slack API error');
        }
        return response;
      },
      (error) => {
        logger.error('Slack API request failed', {
          error: error.message,
          url: error.config?.url,
          status: error.response?.status
        });
        throw error;
      }
    );
  }

  /**
   * Post a message to Slack
   */
  async postMessage(message: SlackMessage): Promise<SlackMessageResult> {
    try {
      const payload: any = {
        text: message.text,
        ...(message.blocks && { blocks: message.blocks }),
        ...(message.threadTs && { thread_ts: message.threadTs })
      };

      // Determine target
      if (message.channel) {
        payload.channel = message.channel;
      } else if (message.userId) {
        // Open DM conversation first
        const dmChannel = await this.openDirectMessage(message.userId);
        payload.channel = dmChannel;
      } else {
        throw new Error('Either channel or userId must be specified');
      }

      const response = await this.client.post('/chat.postMessage', payload);

      return {
        ts: response.data.ts,
        channel: response.data.channel,
        message: response.data.message?.text
      };

    } catch (error) {
      logger.error('Failed to post Slack message', {
        error: (error as Error).message,
        channel: message.channel,
        userId: message.userId
      });
      throw error;
    }
  }

  /**
   * Update an existing message
   */
  async updateMessage(channel: string, ts: string, text: string, blocks?: any[]): Promise<void> {
    try {
      await this.client.post('/chat.update', {
        channel,
        ts,
        text,
        ...(blocks && { blocks })
      });

    } catch (error) {
      logger.error('Failed to update Slack message', {
        error: (error as Error).message,
        channel,
        ts
      });
      throw error;
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
    try {
      await this.client.post('/reactions.add', {
        channel,
        timestamp: ts,
        name: emoji.replace(/:/g, '') // Remove colons from emoji
      });

    } catch (error) {
      logger.error('Failed to add reaction', {
        error: (error as Error).message,
        channel,
        ts,
        emoji
      });
    }
  }

  /**
   * List all users in workspace
   */
  async listUsers(): Promise<SlackUser[]> {
    try {
      // Check cache first
      const cacheKey = 'slack:users:all';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.client.get('/users.list', {
        params: {
          limit: 1000
        }
      });

      const users: SlackUser[] = response.data.members
        .filter((member: any) => !member.is_bot && !member.deleted)
        .map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.profile?.email || '',
          realName: member.real_name || member.name,
          deleted: member.deleted,
          isBot: member.is_bot,
          isAdmin: member.is_admin,
          timezone: member.tz,
          status: member.profile?.status_text ? {
            text: member.profile.status_text,
            emoji: member.profile.status_emoji
          } : undefined
        }));

      // Cache for 1 hour
      await this.cache.set(cacheKey, JSON.stringify(users), 3600);

      return users;

    } catch (error) {
      logger.error('Failed to list Slack users', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get user info by ID
   */
  async getUserInfo(userId: string): Promise<SlackUser | null> {
    try {
      // Check cache
      const cacheKey = `slack:user:${userId}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.client.get('/users.info', {
        params: { user: userId }
      });

      if (!response.data.user) {
        return null;
      }

      const member = response.data.user;
      const user: SlackUser = {
        id: member.id,
        name: member.name,
        email: member.profile?.email || '',
        realName: member.real_name || member.name,
        deleted: member.deleted,
        isBot: member.is_bot,
        isAdmin: member.is_admin,
        timezone: member.tz,
        status: member.profile?.status_text ? {
          text: member.profile.status_text,
          emoji: member.profile.status_emoji
        } : undefined
      };

      // Cache for 30 minutes
      await this.cache.set(cacheKey, JSON.stringify(user), 1800);

      return user;

    } catch (error) {
      logger.error('Failed to get Slack user info', {
        error: (error as Error).message,
        userId
      });
      return null;
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const response = await this.client.get('/users.lookupByEmail', {
        params: { email }
      });

      if (!response.data.user) {
        return null;
      }

      const member = response.data.user;
      return {
        id: member.id,
        name: member.name,
        email: member.profile?.email || email,
        realName: member.real_name || member.name,
        deleted: member.deleted,
        isBot: member.is_bot,
        isAdmin: member.is_admin,
        timezone: member.tz
      };

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error === 'users_not_found') {
        return null;
      }
      logger.error('Failed to find Slack user by email', {
        error: (error as Error).message,
        email
      });
      return null;
    }
  }

  /**
   * List channels
   */
  async listChannels(includeArchived = false): Promise<SlackChannel[]> {
    try {
      // Check cache
      const cacheKey = `slack:channels:${includeArchived ? 'all' : 'active'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.client.get('/conversations.list', {
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: !includeArchived,
          limit: 1000
        }
      });

      const channels: SlackChannel[] = response.data.channels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isArchived: channel.is_archived,
        memberCount: channel.num_members,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value
      }));

      // Cache for 30 minutes
      await this.cache.set(cacheKey, JSON.stringify(channels), 1800);

      return channels;

    } catch (error) {
      logger.error('Failed to list Slack channels', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(channelId: string): Promise<SlackChannel | null> {
    try {
      const response = await this.client.get('/conversations.info', {
        params: { channel: channelId }
      });

      if (!response.data.channel) {
        return null;
      }

      const channel = response.data.channel;
      return {
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isArchived: channel.is_archived,
        memberCount: channel.num_members,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value
      };

    } catch (error) {
      logger.error('Failed to get Slack channel info', {
        error: (error as Error).message,
        channelId
      });
      return null;
    }
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, isPrivate = false): Promise<SlackChannel> {
    try {
      const response = await this.client.post('/conversations.create', {
        name,
        is_private: isPrivate
      });

      const channel = response.data.channel;
      return {
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isArchived: false
      };

    } catch (error) {
      logger.error('Failed to create Slack channel', {
        error: (error as Error).message,
        name,
        isPrivate
      });
      throw error;
    }
  }

  /**
   * Invite users to a channel
   */
  async inviteToChannel(channelId: string, userIds: string[]): Promise<void> {
    try {
      await this.client.post('/conversations.invite', {
        channel: channelId,
        users: userIds.join(',')
      });

    } catch (error) {
      logger.error('Failed to invite users to channel', {
        error: (error as Error).message,
        channelId,
        userCount: userIds.length
      });
      throw error;
    }
  }

  /**
   * Open a direct message conversation
   */
  private async openDirectMessage(userId: string): Promise<string> {
    try {
      const response = await this.client.post('/conversations.open', {
        users: userId
      });

      return response.data.channel.id;

    } catch (error) {
      logger.error('Failed to open direct message', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  /**
   * Send ephemeral message (only visible to one user)
   */
  async sendEphemeralMessage(channel: string, userId: string, text: string): Promise<void> {
    try {
      await this.client.post('/chat.postEphemeral', {
        channel,
        user: userId,
        text
      });

    } catch (error) {
      logger.error('Failed to send ephemeral message', {
        error: (error as Error).message,
        channel,
        userId
      });
    }
  }

  /**
   * Get channel members
   */
  async getChannelMembers(channelId: string): Promise<string[]> {
    try {
      const response = await this.client.get('/conversations.members', {
        params: {
          channel: channelId,
          limit: 1000
        }
      });

      return response.data.members || [];

    } catch (error) {
      logger.error('Failed to get channel members', {
        error: (error as Error).message,
        channelId
      });
      return [];
    }
  }

  /**
   * Archive a channel
   */
  async archiveChannel(channelId: string): Promise<void> {
    try {
      await this.client.post('/conversations.archive', {
        channel: channelId
      });

    } catch (error) {
      logger.error('Failed to archive channel', {
        error: (error as Error).message,
        channelId
      });
      throw error;
    }
  }

  /**
   * Set channel topic
   */
  async setChannelTopic(channelId: string, topic: string): Promise<void> {
    try {
      await this.client.post('/conversations.setTopic', {
        channel: channelId,
        topic
      });

    } catch (error) {
      logger.error('Failed to set channel topic', {
        error: (error as Error).message,
        channelId,
        topic
      });
    }
  }
}