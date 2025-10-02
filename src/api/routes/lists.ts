/**
 * List Management API Routes
 * RESTful API endpoints for contact list management
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { ListType } from '@prisma/client';
import {
  ListManagementService,
  ContactService,
  SuppressionService
} from '@/services/lists';
import {
  ListHealthAgent,
  OptimizationAgent,
  RebalancingAgent
} from '@/services/lists/agents';

const router = Router();

// Import singleton prisma client
import { prisma } from '@/lib/prisma';

// Initialize services
const listService = new ListManagementService();
const contactService = new ContactService();
const suppressionService = new SuppressionService();

// Initialize AI agents
const healthAgent = new ListHealthAgent();
const optimizationAgent = new OptimizationAgent();
const rebalancingAgent = new RebalancingAgent();

// ============================================
// LIST MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /api/lists
 * Create a new contact list
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, mailjetListId, description } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        error: 'Missing required fields: name and type'
      });
    }

    // Validate list type
    if (!Object.values(ListType).includes(type)) {
      return res.status(400).json({
        error: `Invalid list type. Must be one of: ${Object.values(ListType).join(', ')}`
      });
    }

    const list = await listService.createList({
      name,
      type,
      mailjetListId: mailjetListId ? BigInt(mailjetListId) : undefined,
      description
    });

    res.status(201).json({
      success: true,
      list
    });
  } catch (error) {
    logger.error('[Lists API] Failed to create list', { error });
    res.status(500).json({
      error: 'Failed to create list',
      details: String(error)
    });
  }
});

/**
 * GET /api/lists
 * Get all lists
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const lists = await listService.getAllLists(includeInactive);

    res.json({
      success: true,
      lists,
      count: lists.length
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get lists', { error });
    res.status(500).json({
      error: 'Failed to get lists',
      details: String(error)
    });
  }
});

/**
 * GET /api/lists/:id
 * Get list by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = await listService.getList(id);

    if (!list) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    res.json({
      success: true,
      list
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get list', { error });
    res.status(500).json({
      error: 'Failed to get list',
      details: String(error)
    });
  }
});

/**
 * PUT /api/lists/:id
 * Update list
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const list = await listService.updateList(id, {
      name,
      description,
      isActive
    });

    res.json({
      success: true,
      list
    });
  } catch (error) {
    logger.error('[Lists API] Failed to update list', { error });
    res.status(500).json({
      error: 'Failed to update list',
      details: String(error)
    });
  }
});

/**
 * DELETE /api/lists/:id
 * Soft delete list
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = await listService.deleteList(id);

    res.json({
      success: true,
      message: 'List deleted successfully',
      list
    });
  } catch (error) {
    logger.error('[Lists API] Failed to delete list', { error });
    res.status(500).json({
      error: 'Failed to delete list',
      details: String(error)
    });
  }
});

/**
 * POST /api/lists/:id/sync
 * Sync list from MailJet
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = await listService.syncListFromMailjet(id);

    res.json({
      success: true,
      message: 'List synced successfully',
      list
    });
  } catch (error) {
    logger.error('[Lists API] Failed to sync list', { error });
    res.status(500).json({
      error: 'Failed to sync list',
      details: String(error)
    });
  }
});

// ============================================
// CONTACT MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /api/lists/:id/contacts
 * Add contacts to list
 */
router.post('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        error: 'contacts must be a non-empty array'
      });
    }

    const result = await contactService.bulkImportContacts(id, contacts);

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Lists API] Failed to add contacts', { error });
    res.status(500).json({
      error: 'Failed to add contacts',
      details: String(error)
    });
  }
});

/**
 * GET /api/lists/:id/contacts
 * Get contacts in list (paginated)
 */
router.get('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;

    const result = await contactService.getListContacts(id, page, pageSize);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get contacts', { error });
    res.status(500).json({
      error: 'Failed to get contacts',
      details: String(error)
    });
  }
});

/**
 * DELETE /api/lists/:id/contacts/:contactId
 * Remove contact from list
 */
router.delete('/:id/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const { id, contactId } = req.params;
    const membership = await contactService.removeContactFromList(contactId, id);

    res.json({
      success: true,
      message: 'Contact removed from list',
      membership
    });
  } catch (error) {
    logger.error('[Lists API] Failed to remove contact', { error });
    res.status(500).json({
      error: 'Failed to remove contact',
      details: String(error)
    });
  }
});

/**
 * POST /api/lists/:id/import
 * Bulk import from CSV data
 */
router.post('/:id/import', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        error: 'contacts must be an array'
      });
    }

    const result = await contactService.bulkImportContacts(id, contacts);

    res.json({
      success: true,
      message: `Imported ${result.success} contacts, ${result.failed} failed`,
      ...result
    });
  } catch (error) {
    logger.error('[Lists API] Failed to import contacts', { error });
    res.status(500).json({
      error: 'Failed to import contacts',
      details: String(error)
    });
  }
});

// ============================================
// SUPPRESSION MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/suppression
 * Get all suppressed contacts (paginated)
 */
router.get('/suppression/all', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;

    const result = await suppressionService.getAllSuppressedContacts(page, pageSize);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get suppressed contacts', { error });
    res.status(500).json({
      error: 'Failed to get suppressed contacts',
      details: String(error)
    });
  }
});

/**
 * GET /api/suppression/stats
 * Get suppression statistics
 */
router.get('/suppression/stats', async (req: Request, res: Response) => {
  try {
    const stats = await suppressionService.getSuppressionStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get suppression stats', { error });
    res.status(500).json({
      error: 'Failed to get suppression stats',
      details: String(error)
    });
  }
});

/**
 * POST /api/suppression
 * Suppress a contact
 */
router.post('/suppression', async (req: Request, res: Response) => {
  try {
    const {
      contactId,
      reason,
      suppressedBy,
      aiRationale,
      confidence,
      sourceCampaignId,
      metadata
    } = req.body;

    if (!contactId || !reason || !suppressedBy) {
      return res.status(400).json({
        error: 'Missing required fields: contactId, reason, suppressedBy'
      });
    }

    const suppression = await suppressionService.suppressContact({
      contactId,
      reason,
      suppressedBy,
      aiRationale,
      confidence,
      sourceCampaignId,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'Contact suppressed successfully',
      suppression
    });
  } catch (error) {
    logger.error('[Lists API] Failed to suppress contact', { error });
    res.status(500).json({
      error: 'Failed to suppress contact',
      details: String(error)
    });
  }
});

/**
 * DELETE /api/suppression/:contactId
 * Reactivate a suppressed contact
 */
router.delete('/suppression/:contactId', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { reactivatedBy, reason } = req.body;

    if (!reactivatedBy) {
      return res.status(400).json({
        error: 'reactivatedBy is required'
      });
    }

    const contact = await suppressionService.reactivateContact(
      contactId,
      reactivatedBy,
      reason
    );

    res.json({
      success: true,
      message: 'Contact reactivated successfully',
      contact
    });
  } catch (error) {
    logger.error('[Lists API] Failed to reactivate contact', { error });
    res.status(500).json({
      error: 'Failed to reactivate contact',
      details: String(error)
    });
  }
});

/**
 * GET /api/suppression/:contactId/history
 * Get suppression history for contact
 */
router.get('/suppression/:contactId/history', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const history = await suppressionService.getSuppressionHistory(contactId);

    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get suppression history', { error });
    res.status(500).json({
      error: 'Failed to get suppression history',
      details: String(error)
    });
  }
});

/**
 * GET /api/suppression/check/:emailOrId
 * Check if contact is suppressed
 */
router.get('/suppression/check/:emailOrId', async (req: Request, res: Response) => {
  try {
    const { emailOrId } = req.params;
    const result = await suppressionService.isContactSuppressed(emailOrId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Lists API] Failed to check suppression', { error });
    res.status(500).json({
      error: 'Failed to check suppression',
      details: String(error)
    });
  }
});

// ============================================
// LIST HEALTH & ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/lists/:id/health
 * Get current health metrics for list
 */
router.get('/:id/health', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get list metadata
    const metadata = await listService.getCachedListMetadata(id);

    if (!metadata) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    res.json({
      success: true,
      health: {
        listId: metadata.listId,
        listName: metadata.name,
        contactCount: metadata.contactCount,
        bounceRate: metadata.bounceRate,
        deliveryRate: metadata.deliveryRate,
        healthScore: metadata.healthScore,
        lastSyncedAt: metadata.lastSyncedAt
      }
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get list health', { error });
    res.status(500).json({
      error: 'Failed to get list health',
      details: String(error)
    });
  }
});

/**
 * POST /api/lists/:id/health/analyze
 * Run AI health analysis on list
 */
router.post('/:id/health/analyze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const list = await listService.getList(id);

    if (!list) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    // Prepare metrics for AI analysis
    const metrics = {
      listName: list.name,
      contactCount: list.contactCount,
      activeContactCount: list.contactCount, // TODO: Calculate active count
      bounceRate: list.bounceRate || 0,
      hardBounceRate: (list.bounceRate || 0) * 0.7, // Estimate
      softBounceRate: (list.bounceRate || 0) * 0.3, // Estimate
      deliveryRate: list.deliveryRate || 1.0
    };

    const assessment = await healthAgent.analyzeListHealth(metrics);

    res.json({
      success: true,
      assessment
    });
  } catch (error) {
    logger.error('[Lists API] Failed to analyze list health', { error });
    res.status(500).json({
      error: 'Failed to analyze list health',
      details: String(error)
    });
  }
});

/**
 * GET /api/lists/campaign/status
 * Get status of all campaign lists
 */
router.get('/campaign/status', async (req: Request, res: Response) => {
  try {
    const campaignLists = await listService.getCampaignLists();

    res.json({
      success: true,
      campaignLists
    });
  } catch (error) {
    logger.error('[Lists API] Failed to get campaign lists status', { error });
    res.status(500).json({
      error: 'Failed to get campaign lists status',
      details: String(error)
    });
  }
});

export default router;
