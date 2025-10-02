/**
 * Contact Service
 * Manages individual contacts and their list memberships
 */

import { Contact, ContactStatus, ListMembership } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { ListManagementService } from './list-management.service';

export interface CreateContactParams {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  mailjetContactId?: bigint;
  properties?: Record<string, any>;
}

export interface UpdateContactParams {
  name?: string;
  firstName?: string;
  lastName?: string;
  status?: ContactStatus;
  properties?: Record<string, any>;
}

export interface AddToListParams {
  contactId: string;
  listId: string;
  position?: number; // For FIFO ordering
}

export interface BulkImportContact {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, any>;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
  contacts: Contact[];
}

export class ContactService {
  private listService: ListManagementService;

  constructor() {
    this.listService = new ListManagementService();
  }

  /**
   * Create or get contact by email
   */
  async createOrGetContact(params: CreateContactParams): Promise<Contact> {
    try {
      // Try to find existing contact
      const existing = await prisma.contact.findUnique({
        where: { email: params.email }
      });

      if (existing) {
        return existing;
      }

      // Create new contact
      logger.info('[ContactService] Creating contact', { email: params.email });

      const contact = await prisma.contact.create({
        data: {
          email: params.email,
          name: params.name,
          firstName: params.firstName,
          lastName: params.lastName,
          mailjetContactId: params.mailjetContactId,
          properties: params.properties
        }
      });

      return contact;
    } catch (error) {
      logger.error('[ContactService] Failed to create contact', { email: params.email, error });
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: string): Promise<Contact | null> {
    try {
      return await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          memberships: {
            where: { isActive: true },
            include: { list: true }
          },
          suppressionHistory: {
            where: { isActive: true },
            orderBy: { suppressedAt: 'desc' }
          }
        }
      });
    } catch (error) {
      logger.error('[ContactService] Failed to get contact', { contactId, error });
      throw error;
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email: string): Promise<Contact | null> {
    try {
      return await prisma.contact.findUnique({
        where: { email },
        include: {
          memberships: {
            where: { isActive: true },
            include: { list: true }
          }
        }
      });
    } catch (error) {
      logger.error('[ContactService] Failed to get contact by email', { email, error });
      throw error;
    }
  }

  /**
   * Update contact
   */
  async updateContact(contactId: string, params: UpdateContactParams): Promise<Contact> {
    logger.info('[ContactService] Updating contact', { contactId });

    try {
      return await prisma.contact.update({
        where: { id: contactId },
        data: params
      });
    } catch (error) {
      logger.error('[ContactService] Failed to update contact', { contactId, error });
      throw error;
    }
  }

  /**
   * Add contact to list
   */
  async addContactToList(params: AddToListParams): Promise<ListMembership> {
    logger.info('[ContactService] Adding contact to list', params);

    try {
      // Check if already a member
      const existing = await prisma.listMembership.findUnique({
        where: {
          contactId_listId: {
            contactId: params.contactId,
            listId: params.listId
          }
        }
      });

      if (existing) {
        // Reactivate if inactive
        if (!existing.isActive) {
          return await prisma.listMembership.update({
            where: { id: existing.id },
            data: { isActive: true, removedAt: null }
          });
        }
        return existing;
      }

      // Determine position for FIFO ordering
      let position = params.position;

      if (position === undefined) {
        // Get last position in list
        const lastMember = await prisma.listMembership.findFirst({
          where: { listId: params.listId },
          orderBy: { position: 'desc' }
        });

        position = (lastMember?.position || 0) + 1;
      }

      // Create membership
      const membership = await prisma.listMembership.create({
        data: {
          contactId: params.contactId,
          listId: params.listId,
          position
        }
      });

      // Update list contact count
      await this.updateListContactCount(params.listId);

      // Invalidate list cache
      await this.listService.invalidateListCache(params.listId);

      return membership;
    } catch (error) {
      logger.error('[ContactService] Failed to add contact to list', { params, error });
      throw error;
    }
  }

  /**
   * Remove contact from list (soft delete)
   */
  async removeContactFromList(contactId: string, listId: string): Promise<ListMembership> {
    logger.info('[ContactService] Removing contact from list', { contactId, listId });

    try {
      const membership = await prisma.listMembership.update({
        where: {
          contactId_listId: {
            contactId,
            listId
          }
        },
        data: {
          isActive: false,
          removedAt: new Date()
        }
      });

      // Update list contact count
      await this.updateListContactCount(listId);

      // Invalidate list cache
      await this.listService.invalidateListCache(listId);

      return membership;
    } catch (error) {
      logger.error('[ContactService] Failed to remove contact from list', { contactId, listId, error });
      throw error;
    }
  }

  /**
   * Bulk import contacts from array
   */
  async bulkImportContacts(
    listId: string,
    contacts: BulkImportContact[]
  ): Promise<BulkImportResult> {
    logger.info('[ContactService] Bulk importing contacts', {
      listId,
      count: contacts.length
    });

    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      contacts: []
    };

    try {
      for (const contactData of contacts) {
        try {
          // Create or get contact
          const contact = await this.createOrGetContact(contactData);

          // Add to list
          await this.addContactToList({
            contactId: contact.id,
            listId
          });

          result.success++;
          result.contacts.push(contact);
        } catch (error) {
          result.failed++;
          result.errors.push({
            email: contactData.email,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('[ContactService] Bulk import completed', {
        listId,
        success: result.success,
        failed: result.failed
      });

      return result;
    } catch (error) {
      logger.error('[ContactService] Bulk import failed', { listId, error });
      throw error;
    }
  }

  /**
   * Get contact's list memberships
   */
  async getContactLists(contactId: string): Promise<ListMembership[]> {
    try {
      return await prisma.listMembership.findMany({
        where: {
          contactId,
          isActive: true
        },
        include: {
          list: true
        },
        orderBy: { addedAt: 'desc' }
      });
    } catch (error) {
      logger.error('[ContactService] Failed to get contact lists', { contactId, error });
      throw error;
    }
  }

  /**
   * Get contacts in a list (paginated)
   */
  async getListContacts(
    listId: string,
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

      const [memberships, total] = await Promise.all([
        prisma.listMembership.findMany({
          where: {
            listId,
            isActive: true
          },
          include: {
            contact: true
          },
          orderBy: { position: 'asc' }, // FIFO order
          skip,
          take: pageSize
        }),
        prisma.listMembership.count({
          where: {
            listId,
            isActive: true
          }
        })
      ]);

      const contacts = memberships.map(m => m.contact);

      return {
        contacts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('[ContactService] Failed to get list contacts', { listId, error });
      throw error;
    }
  }

  /**
   * Update list contact count
   */
  private async updateListContactCount(listId: string): Promise<void> {
    try {
      const count = await prisma.listMembership.count({
        where: {
          listId,
          isActive: true
        }
      });

      await prisma.contactList.update({
        where: { id: listId },
        data: { contactCount: count }
      });
    } catch (error) {
      logger.error('[ContactService] Failed to update list contact count', { listId, error });
      // Don't throw - this is a cache update
    }
  }

  /**
   * Record bounce for contact
   */
  async recordBounce(
    contactId: string,
    bounceType: 'hard' | 'soft' | 'spam'
  ): Promise<Contact> {
    logger.info('[ContactService] Recording bounce', { contactId, bounceType });

    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId }
      });

      if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
      }

      // Update contact
      const newBounceCount = contact.bounceCount + 1;
      let newStatus = contact.status;

      // Determine new status
      if (bounceType === 'hard' || bounceType === 'spam') {
        newStatus = ContactStatus.BOUNCED_HARD;
      } else if (bounceType === 'soft') {
        // After 3 soft bounces, mark as hard
        if (newBounceCount >= 3) {
          newStatus = ContactStatus.BOUNCED_HARD;
        } else {
          newStatus = ContactStatus.BOUNCED_SOFT;
        }
      }

      return await prisma.contact.update({
        where: { id: contactId },
        data: {
          bounceCount: newBounceCount,
          lastBounceDate: new Date(),
          lastBounceType: bounceType,
          status: newStatus
        }
      });
    } catch (error) {
      logger.error('[ContactService] Failed to record bounce', { contactId, error });
      throw error;
    }
  }

  /**
   * Get contact history (bounces, suppressions, list changes)
   */
  async getContactHistory(contactId: string): Promise<{
    contact: Contact;
    bounces: number;
    suppressions: number;
    listMemberships: number;
  }> {
    try {
      const [contact, suppressions, memberships] = await Promise.all([
        this.getContact(contactId),
        prisma.suppressionHistoryEntry.count({
          where: { contactId, isActive: true }
        }),
        prisma.listMembership.count({
          where: { contactId, isActive: true }
        })
      ]);

      if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
      }

      return {
        contact,
        bounces: contact.bounceCount,
        suppressions,
        listMemberships: memberships
      };
    } catch (error) {
      logger.error('[ContactService] Failed to get contact history', { contactId, error });
      throw error;
    }
  }
}
