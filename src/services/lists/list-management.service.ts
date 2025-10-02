/**
 * List Management Service
 * Core CRUD operations for ContactList management
 */

import { ContactList, ListType } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface CreateListParams {
  name: string;
  type: ListType;
  mailjetListId?: bigint;
  description?: string;
}

export interface UpdateListParams {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListMetadata {
  listId: string;
  name: string;
  type: ListType;
  contactCount: number;
  bounceRate: number | null;
  deliveryRate: number | null;
  healthScore: number | null;
  lastSyncedAt: Date | null;
}

export class ListManagementService {
  private mailjetClient: MailjetAgentClient;

  constructor() {
    this.mailjetClient = new MailjetAgentClient();
  }

  /**
   * Create a new contact list
   */
  async createList(params: CreateListParams): Promise<ContactList> {
    logger.info('[ListManagementService] Creating list', { name: params.name, type: params.type });

    try {
      const list = await prisma.contactList.create({
        data: {
          name: params.name,
          type: params.type,
          mailjetListId: params.mailjetListId,
          description: params.description
        }
      });

      // Invalidate cache
      await this.invalidateListCache(list.id);

      logger.info('[ListManagementService] List created', { listId: list.id });

      return list;
    } catch (error) {
      logger.error('[ListManagementService] Failed to create list', { error });
      throw error;
    }
  }

  /**
   * Get list by ID
   */
  async getList(listId: string): Promise<ContactList | null> {
    try {
      return await prisma.contactList.findUnique({
        where: { id: listId },
        include: {
          memberships: {
            where: { isActive: true },
            take: 10 // Preview only
          }
        }
      });
    } catch (error) {
      logger.error('[ListManagementService] Failed to get list', { listId, error });
      throw error;
    }
  }

  /**
   * Get list by MailJet ID
   */
  async getListByMailjetId(mailjetListId: bigint): Promise<ContactList | null> {
    try {
      return await prisma.contactList.findUnique({
        where: { mailjetListId }
      });
    } catch (error) {
      logger.error('[ListManagementService] Failed to get list by MailJet ID', { mailjetListId, error });
      throw error;
    }
  }

  /**
   * Get all lists
   */
  async getAllLists(includeInactive: boolean = false): Promise<ContactList[]> {
    try {
      return await prisma.contactList.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [
          { type: 'asc' },
          { createdAt: 'desc' }
        ]
      });
    } catch (error) {
      logger.error('[ListManagementService] Failed to get all lists', { error });
      throw error;
    }
  }

  /**
   * Get lists by type
   */
  async getListsByType(type: ListType): Promise<ContactList[]> {
    try {
      return await prisma.contactList.findMany({
        where: { type, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('[ListManagementService] Failed to get lists by type', { type, error });
      throw error;
    }
  }

  /**
   * Update list
   */
  async updateList(listId: string, params: UpdateListParams): Promise<ContactList> {
    logger.info('[ListManagementService] Updating list', { listId, params });

    try {
      const list = await prisma.contactList.update({
        where: { id: listId },
        data: params
      });

      // Invalidate cache
      await this.invalidateListCache(listId);

      return list;
    } catch (error) {
      logger.error('[ListManagementService] Failed to update list', { listId, error });
      throw error;
    }
  }

  /**
   * Soft delete list
   */
  async deleteList(listId: string): Promise<ContactList> {
    logger.info('[ListManagementService] Deleting list', { listId });

    try {
      const list = await prisma.contactList.update({
        where: { id: listId },
        data: { isActive: false }
      });

      // Invalidate cache
      await this.invalidateListCache(listId);

      return list;
    } catch (error) {
      logger.error('[ListManagementService] Failed to delete list', { listId, error });
      throw error;
    }
  }

  /**
   * Sync list from MailJet
   * Fetches latest metadata and updates cached values
   */
  async syncListFromMailjet(listId: string): Promise<ContactList> {
    logger.info('[ListManagementService] Syncing list from MailJet', { listId });

    try {
      const list = await this.getList(listId);

      if (!list) {
        throw new Error(`List ${listId} not found`);
      }

      if (!list.mailjetListId) {
        throw new Error(`List ${listId} has no MailJet list ID`);
      }

      // Fetch stats from MailJet
      const stats = await this.mailjetClient.getListStatistics(list.mailjetListId);

      // Update list with fresh data
      const updatedList = await prisma.contactList.update({
        where: { id: listId },
        data: {
          contactCount: stats.totalContacts,
          bounceRate: stats.recentBounces / Math.max(stats.totalContacts, 1),
          healthScore: stats.listHealth,
          lastSyncedAt: new Date()
        }
      });

      // Update cache
      await this.setCachedListMetadata(listId, {
        listId: updatedList.id,
        name: updatedList.name,
        type: updatedList.type,
        contactCount: updatedList.contactCount,
        bounceRate: updatedList.bounceRate,
        deliveryRate: updatedList.deliveryRate,
        healthScore: updatedList.healthScore,
        lastSyncedAt: updatedList.lastSyncedAt
      });

      logger.info('[ListManagementService] List synced', { listId, contactCount: updatedList.contactCount });

      return updatedList;
    } catch (error) {
      logger.error('[ListManagementService] Failed to sync list', { listId, error });
      throw error;
    }
  }

  /**
   * Sync all lists from MailJet
   * Used in weekly health check
   */
  async syncAllListsFromMailjet(): Promise<ContactList[]> {
    logger.info('[ListManagementService] Syncing all lists from MailJet');

    try {
      const lists = await prisma.contactList.findMany({
        where: {
          isActive: true,
          mailjetListId: { not: null }
        }
      });

      const syncedLists: ContactList[] = [];

      for (const list of lists) {
        try {
          const synced = await this.syncListFromMailjet(list.id);
          syncedLists.push(synced);
        } catch (error) {
          logger.error('[ListManagementService] Failed to sync list', { listId: list.id, error });
          // Continue with other lists
        }
      }

      logger.info('[ListManagementService] All lists synced', { count: syncedLists.length });

      return syncedLists;
    } catch (error) {
      logger.error('[ListManagementService] Failed to sync all lists', { error });
      throw error;
    }
  }

  /**
   * Get cached list metadata
   */
  async getCachedListMetadata(listId: string): Promise<ListMetadata | null> {
    const cacheKey = `list:metadata:${listId}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Cache miss - fetch from DB and cache
      const list = await this.getList(listId);

      if (!list) {
        return null;
      }

      const metadata: ListMetadata = {
        listId: list.id,
        name: list.name,
        type: list.type,
        contactCount: list.contactCount,
        bounceRate: list.bounceRate,
        deliveryRate: list.deliveryRate,
        healthScore: list.healthScore,
        lastSyncedAt: list.lastSyncedAt
      };

      await this.setCachedListMetadata(listId, metadata);

      return metadata;
    } catch (error) {
      logger.error('[ListManagementService] Failed to get cached list metadata', { listId, error });
      // Return null on cache failure - service can fallback to DB
      return null;
    }
  }

  /**
   * Set cached list metadata
   */
  async setCachedListMetadata(listId: string, metadata: ListMetadata): Promise<void> {
    const cacheKey = `list:metadata:${listId}`;
    const ttl = 3600; // 1 hour

    try {
      await redis.setex(cacheKey, ttl, JSON.stringify(metadata));
    } catch (error) {
      logger.error('[ListManagementService] Failed to cache list metadata', { listId, error });
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Invalidate list cache
   */
  async invalidateListCache(listId: string): Promise<void> {
    const cacheKey = `list:metadata:${listId}`;

    try {
      await redis.del(cacheKey);
    } catch (error) {
      logger.error('[ListManagementService] Failed to invalidate cache', { listId, error });
      // Don't throw - cache invalidation is non-critical
    }
  }

  /**
   * Get master list
   */
  async getMasterList(): Promise<ContactList | null> {
    try {
      const lists = await this.getListsByType(ListType.MASTER);
      return lists[0] || null;
    } catch (error) {
      logger.error('[ListManagementService] Failed to get master list', { error });
      throw error;
    }
  }

  /**
   * Get campaign lists (all 3 rounds)
   */
  async getCampaignLists(): Promise<{
    round1: ContactList | null;
    round2: ContactList | null;
    round3: ContactList | null;
  }> {
    try {
      const [round1Lists, round2Lists, round3Lists] = await Promise.all([
        this.getListsByType(ListType.CAMPAIGN_ROUND_1),
        this.getListsByType(ListType.CAMPAIGN_ROUND_2),
        this.getListsByType(ListType.CAMPAIGN_ROUND_3)
      ]);

      return {
        round1: round1Lists[0] || null,
        round2: round2Lists[0] || null,
        round3: round3Lists[0] || null
      };
    } catch (error) {
      logger.error('[ListManagementService] Failed to get campaign lists', { error });
      throw error;
    }
  }

  /**
   * Get suppression list
   */
  async getSuppressionList(): Promise<ContactList | null> {
    try {
      const lists = await this.getListsByType(ListType.SUPPRESSION);
      return lists[0] || null;
    } catch (error) {
      logger.error('[ListManagementService] Failed to get suppression list', { error });
      throw error;
    }
  }
}
