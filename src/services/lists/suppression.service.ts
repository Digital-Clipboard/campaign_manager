/**
 * Suppression Service
 * Manages contact suppression list and history
 */

import { Contact, ContactStatus, SuppressionHistoryEntry } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { ContactService } from './contact.service';
import { ListManagementService } from './list-management.service';
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface SuppressContactParams {
  contactId: string;
  reason: string;
  suppressedBy: string; // 'ai' or user identifier
  aiRationale?: string;
  confidence?: number; // 0-1
  sourceCampaignId?: string;
  metadata?: Record<string, any>;
}

export interface SuppressionCheck {
  isSuppressed: boolean;
  reason?: string;
  suppressedAt?: Date;
  suppressedBy?: string;
}

export class SuppressionService {
  private contactService: ContactService;
  private listService: ListManagementService;

  constructor() {
    this.contactService = new ContactService();
    this.listService = new ListManagementService();
  }

  /**
   * Suppress a contact
   * Adds to suppression history and updates contact status
   */
  async suppressContact(params: SuppressContactParams): Promise<SuppressionHistoryEntry> {
    logger.info('[SuppressionService] Suppressing contact', {
      contactId: params.contactId,
      reason: params.reason
    });

    try {
      // Create suppression history entry
      const suppression = await prisma.suppressionHistoryEntry.create({
        data: {
          contactId: params.contactId,
          reason: params.reason,
          suppressedBy: params.suppressedBy,
          aiRationale: params.aiRationale,
          confidence: params.confidence,
          sourceCampaignId: params.sourceCampaignId,
          metadata: params.metadata
        }
      });

      // Update contact status
      await this.contactService.updateContact(params.contactId, {
        status: ContactStatus.SUPPRESSED
      });

      // Add to suppression list if exists
      const suppressionList = await this.listService.getSuppressionList();

      if (suppressionList) {
        try {
          await this.contactService.addContactToList({
            contactId: params.contactId,
            listId: suppressionList.id
          });
        } catch (error) {
          logger.warn('[SuppressionService] Failed to add to suppression list', {
            contactId: params.contactId,
            error
          });
          // Don't fail if list add fails
        }
      }

      // Update cache
      await this.cacheSuppressionStatus(params.contactId, true);

      logger.info('[SuppressionService] Contact suppressed', {
        contactId: params.contactId,
        suppressionId: suppression.id
      });

      return suppression;
    } catch (error) {
      logger.error('[SuppressionService] Failed to suppress contact', {
        contactId: params.contactId,
        error
      });
      throw error;
    }
  }

  /**
   * Bulk suppress multiple contacts
   */
  async bulkSuppressContacts(
    suppressions: SuppressContactParams[]
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ contactId: string; error: string }>;
  }> {
    logger.info('[SuppressionService] Bulk suppressing contacts', {
      count: suppressions.length
    });

    const result = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ contactId: string; error: string }>
    };

    for (const params of suppressions) {
      try {
        await this.suppressContact(params);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          contactId: params.contactId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info('[SuppressionService] Bulk suppression completed', result);

    return result;
  }

  /**
   * Reactivate a suppressed contact
   */
  async reactivateContact(
    contactId: string,
    reactivatedBy: string,
    reason?: string
  ): Promise<Contact> {
    logger.info('[SuppressionService] Reactivating contact', { contactId });

    try {
      // Deactivate suppression history entries
      await prisma.suppressionHistoryEntry.updateMany({
        where: {
          contactId,
          isActive: true
        },
        data: {
          isActive: false,
          reactivatedAt: new Date(),
          reactivatedBy,
          metadata: reason ? { reactivationReason: reason } : undefined
        }
      });

      // Update contact status to active
      const contact = await this.contactService.updateContact(contactId, {
        status: ContactStatus.ACTIVE
      });

      // Update cache
      await this.cacheSuppressionStatus(contactId, false);

      logger.info('[SuppressionService] Contact reactivated', { contactId });

      return contact;
    } catch (error) {
      logger.error('[SuppressionService] Failed to reactivate contact', {
        contactId,
        error
      });
      throw error;
    }
  }

  /**
   * Check if contact is suppressed (with caching)
   */
  async isContactSuppressed(contactIdOrEmail: string): Promise<SuppressionCheck> {
    try {
      // Check cache first
      const cached = await this.getCachedSuppressionStatus(contactIdOrEmail);

      if (cached !== null) {
        if (!cached) {
          return { isSuppressed: false };
        }
      }

      // Cache miss - check database
      let contact: Contact | null = null;

      // Try to find by ID first
      if (contactIdOrEmail.includes('@')) {
        contact = await this.contactService.getContactByEmail(contactIdOrEmail);
      } else {
        contact = await this.contactService.getContact(contactIdOrEmail);
      }

      if (!contact) {
        return { isSuppressed: false };
      }

      // Check if contact has active suppression
      const suppression = await prisma.suppressionHistoryEntry.findFirst({
        where: {
          contactId: contact.id,
          isActive: true
        },
        orderBy: {
          suppressedAt: 'desc'
        }
      });

      const isSuppressed = suppression !== null || contact.status === ContactStatus.SUPPRESSED;

      // Update cache
      await this.cacheSuppressionStatus(contact.id, isSuppressed);

      return {
        isSuppressed,
        reason: suppression?.reason,
        suppressedAt: suppression?.suppressedAt,
        suppressedBy: suppression?.suppressedBy
      };
    } catch (error) {
      logger.error('[SuppressionService] Failed to check suppression', {
        contactIdOrEmail,
        error
      });
      // Return false on error to avoid blocking
      return { isSuppressed: false };
    }
  }

  /**
   * Get suppression history for contact
   */
  async getSuppressionHistory(contactId: string): Promise<SuppressionHistoryEntry[]> {
    try {
      return await prisma.suppressionHistoryEntry.findMany({
        where: { contactId },
        orderBy: { suppressedAt: 'desc' }
      });
    } catch (error) {
      logger.error('[SuppressionService] Failed to get suppression history', {
        contactId,
        error
      });
      throw error;
    }
  }

  /**
   * Get all currently suppressed contacts
   */
  async getAllSuppressedContacts(
    page: number = 1,
    pageSize: number = 100
  ): Promise<{
    contacts: Contact[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * pageSize;

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where: {
            status: ContactStatus.SUPPRESSED
          },
          include: {
            suppressionHistory: {
              where: { isActive: true },
              orderBy: { suppressedAt: 'desc' },
              take: 1
            }
          },
          skip,
          take: pageSize,
          orderBy: { updatedAt: 'desc' }
        }),
        prisma.contact.count({
          where: {
            status: ContactStatus.SUPPRESSED
          }
        })
      ]);

      return {
        contacts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('[SuppressionService] Failed to get suppressed contacts', { error });
      throw error;
    }
  }

  /**
   * Get suppression statistics
   */
  async getSuppressionStats(): Promise<{
    totalSuppressed: number;
    suppressedByAI: number;
    suppressedManually: number;
    hardBounces: number;
    softBounces: number;
    spamComplaints: number;
    recentSuppressions: number; // Last 7 days
  }> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        totalSuppressed,
        suppressedByAI,
        suppressedManually,
        hardBounces,
        softBounces,
        spamComplaints,
        recentSuppressions
      ] = await Promise.all([
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true }
        }),
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true, suppressedBy: 'ai' }
        }),
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true, suppressedBy: { not: 'ai' } }
        }),
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true, reason: { contains: 'hard_bounce' } }
        }),
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true, reason: { contains: 'soft_bounce' } }
        }),
        prisma.suppressionHistoryEntry.count({
          where: { isActive: true, reason: { contains: 'spam' } }
        }),
        prisma.suppressionHistoryEntry.count({
          where: {
            isActive: true,
            suppressedAt: { gte: sevenDaysAgo }
          }
        })
      ]);

      return {
        totalSuppressed,
        suppressedByAI,
        suppressedManually,
        hardBounces,
        softBounces,
        spamComplaints,
        recentSuppressions
      };
    } catch (error) {
      logger.error('[SuppressionService] Failed to get suppression stats', { error });
      throw error;
    }
  }

  /**
   * Cache suppression status in Redis
   */
  private async cacheSuppressionStatus(contactId: string, isSuppressed: boolean): Promise<void> {
    const cacheKey = `suppression:contact:${contactId}`;
    const ttl = 86400; // 24 hours

    try {
      await redis.setex(cacheKey, ttl, isSuppressed ? '1' : '0');
    } catch (error) {
      logger.error('[SuppressionService] Failed to cache suppression status', {
        contactId,
        error
      });
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Get cached suppression status
   */
  private async getCachedSuppressionStatus(contactId: string): Promise<boolean | null> {
    const cacheKey = `suppression:contact:${contactId}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached === null) {
        return null; // Cache miss
      }

      return cached === '1';
    } catch (error) {
      logger.error('[SuppressionService] Failed to get cached suppression status', {
        contactId,
        error
      });
      return null; // Return cache miss on error
    }
  }

  /**
   * Clear suppression cache for contact
   */
  async clearSuppressionCache(contactId: string): Promise<void> {
    const cacheKey = `suppression:contact:${contactId}`;

    try {
      await redis.del(cacheKey);
    } catch (error) {
      logger.error('[SuppressionService] Failed to clear suppression cache', {
        contactId,
        error
      });
      // Don't throw
    }
  }
}
