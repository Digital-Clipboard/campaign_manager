import { redis } from '@/utils/redis';
import { logger } from '@/utils/logger';
import { Campaign, Task, TeamMember } from '@/types';

export class CacheService {
  private ttls = {
    campaign: 3600,      // 1 hour
    task: 1800,          // 30 minutes
    team: 7200,          // 2 hours
    dashboard: 300,      // 5 minutes
    readiness: 600,      // 10 minutes
    user_session: 86400, // 24 hours
  };

  // Campaign caching
  async getCampaign(id: string): Promise<Campaign | null> {
    try {
      const key = `campaign:${id}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug('Campaign cache hit', { campaignId: id });
        return JSON.parse(cached);
      }

      logger.debug('Campaign cache miss', { campaignId: id });
      return null;
    } catch (error) {
      logger.error('Cache get error for campaign', {
        campaignId: id,
        error: (error as Error).message
      });
      return null; // Graceful degradation
    }
  }

  async setCampaign(campaign: Campaign): Promise<void> {
    try {
      const key = `campaign:${campaign.id}`;
      await redis.setex(key, this.ttls.campaign, JSON.stringify(campaign));

      logger.debug('Campaign cached', { campaignId: campaign.id });
    } catch (error) {
      logger.error('Cache set error for campaign', {
        campaignId: campaign.id,
        error: (error as Error).message
      });
    }
  }

  async invalidateCampaign(id: string): Promise<void> {
    try {
      const key = `campaign:${id}`;
      await redis.del(key);

      // Also invalidate related caches
      await this.invalidatePattern(`campaign:${id}:*`);
      await this.invalidatePattern('dashboard:*');

      // Publish cache invalidation event
      await redis.publish('cache:invalidate', JSON.stringify({
        type: 'campaign',
        id
      }));

      logger.debug('Campaign cache invalidated', { campaignId: id });
    } catch (error) {
      logger.error('Cache invalidation error for campaign', {
        campaignId: id,
        error: (error as Error).message
      });
    }
  }

  // Task caching
  async getTask(id: string): Promise<Task | null> {
    try {
      const key = `task:${id}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug('Task cache hit', { taskId: id });
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error for task', {
        taskId: id,
        error: (error as Error).message
      });
      return null;
    }
  }

  async setTask(task: Task): Promise<void> {
    try {
      const key = `task:${task.id}`;
      await redis.setex(key, this.ttls.task, JSON.stringify(task));

      logger.debug('Task cached', { taskId: task.id });
    } catch (error) {
      logger.error('Cache set error for task', {
        taskId: task.id,
        error: (error as Error).message
      });
    }
  }

  async invalidateTask(id: string): Promise<void> {
    try {
      const key = `task:${id}`;
      await redis.del(key);

      // Invalidate related caches
      await this.invalidatePattern('dashboard:*');

      await redis.publish('cache:invalidate', JSON.stringify({
        type: 'task',
        id
      }));

      logger.debug('Task cache invalidated', { taskId: id });
    } catch (error) {
      logger.error('Cache invalidation error for task', {
        taskId: id,
        error: (error as Error).message
      });
    }
  }

  // Team member caching
  async getTeamMember(id: string): Promise<TeamMember | null> {
    try {
      const key = `team:${id}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug('Team member cache hit', { memberId: id });
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error for team member', {
        memberId: id,
        error: (error as Error).message
      });
      return null;
    }
  }

  async setTeamMember(member: TeamMember): Promise<void> {
    try {
      const key = `team:${member.id}`;
      await redis.setex(key, this.ttls.team, JSON.stringify(member));

      logger.debug('Team member cached', { memberId: member.id });
    } catch (error) {
      logger.error('Cache set error for team member', {
        memberId: member.id,
        error: (error as Error).message
      });
    }
  }

  // Dashboard caching
  async getDashboard(userId: string): Promise<any | null> {
    try {
      const key = `dashboard:${userId}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug('Dashboard cache hit', { userId });
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error for dashboard', {
        userId,
        error: (error as Error).message
      });
      return null;
    }
  }

  async setDashboard(userId: string, data: any): Promise<void> {
    try {
      const key = `dashboard:${userId}`;
      await redis.setex(key, this.ttls.dashboard, JSON.stringify(data));

      logger.debug('Dashboard cached', { userId });
    } catch (error) {
      logger.error('Cache set error for dashboard', {
        userId,
        error: (error as Error).message
      });
    }
  }

  // Campaign readiness score caching
  async getReadinessScore(campaignId: string): Promise<number | null> {
    try {
      const key = `readiness:${campaignId}`;
      const cached = await redis.get(key);

      if (cached !== null) {
        logger.debug('Readiness score cache hit', { campaignId });
        return parseInt(cached, 10);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error for readiness score', {
        campaignId,
        error: (error as Error).message
      });
      return null;
    }
  }

  async setReadinessScore(campaignId: string, score: number): Promise<void> {
    try {
      const key = `readiness:${campaignId}`;
      await redis.setex(key, this.ttls.readiness, score.toString());

      logger.debug('Readiness score cached', { campaignId, score });
    } catch (error) {
      logger.error('Cache set error for readiness score', {
        campaignId,
        score,
        error: (error as Error).message
      });
    }
  }

  // Generic operations
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      logger.error('Generic cache get error', {
        key,
        error: (error as Error).message
      });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await redis.setex(key, ttl, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      logger.error('Generic cache set error', {
        key,
        error: (error as Error).message
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Generic cache delete error', {
        key,
        error: (error as Error).message
      });
    }
  }

  // Pattern-based operations
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Pattern invalidated', { pattern, keyCount: keys.length });
      }
    } catch (error) {
      logger.error('Pattern invalidation error', {
        pattern,
        error: (error as Error).message
      });
    }
  }

  // Cache statistics
  async getStats(): Promise<any> {
    try {
      const info = await redis.info('memory');
      const keyCount = await redis.dbsize();

      return {
        connected: true,
        keyCount,
        memoryInfo: this.parseRedisInfo(info),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Cache stats error', { error: (error as Error).message });
      return {
        connected: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Utility methods
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }

    return result;
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache health check failed', { error: (error as Error).message });
      return false;
    }
  }
}