import { Queue, Worker, Job } from 'bullmq';
import { queueRedis } from '../utils/redis';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import axios from 'axios';

// Bounce cleanup job data interface
export interface BounceCleanupJobData {
  campaignName: string;
  roundNumber: number;
  batchListId: number; // Mailjet list ID
  batchListName: string; // e.g., "campaign_batch_001"
  campaignId?: string; // Mailjet campaign ID
  delayHours?: number; // Hours to wait after campaign send before cleanup
}

// Create queue for bounce cleanup
export const bounceCleanupQueue = new Queue<BounceCleanupJobData>('bounce-cleanup', {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      count: 100
    },
    removeOnFail: {
      count: 50
    }
  }
});

// Mailjet configuration
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_SUPPRESSION_LIST_ID = process.env.MAILJET_SUPPRESSION_LIST_ID;
const MASTER_LIST_ID = 5776; // Master "users" list

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

/**
 * Fetch bounce events for a campaign from Mailjet
 */
async function fetchBounceEvents(campaignId?: string, listId?: number): Promise<any[]> {
  try {
    let allEvents: any[] = [];
    let offset = 0;
    const limit = 1000;

    // If we have a campaign ID, fetch bounce events for that campaign
    if (campaignId) {
      while (true) {
        const response = await axios.get(
          'https://api.mailjet.com/v3/REST/messageeventlist',
          {
            headers: {
              'Authorization': `Basic ${mailjetAuth}`,
              'Content-Type': 'application/json'
            },
            params: {
              CampaignID: campaignId,
              Event: 'bounce',
              Limit: limit,
              Offset: offset
            }
          }
        );

        const events = response.data.Data || [];
        allEvents = allEvents.concat(events);

        if (events.length < limit) break;
        offset += limit;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Also fetch blocked events
      offset = 0;
      while (true) {
        const response = await axios.get(
          'https://api.mailjet.com/v3/REST/messageeventlist',
          {
            headers: {
              'Authorization': `Basic ${mailjetAuth}`,
              'Content-Type': 'application/json'
            },
            params: {
              CampaignID: campaignId,
              Event: 'blocked',
              Limit: limit,
              Offset: offset
            }
          }
        );

        const events = response.data.Data || [];
        allEvents = allEvents.concat(events);

        if (events.length < limit) break;
        offset += limit;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allEvents;

  } catch (error) {
    logger.error('Error fetching bounce events', {
      error: error.message,
      campaignId
    });
    throw error;
  }
}

/**
 * Categorize bounce by type (hard or soft)
 */
function categorizeBounce(event: any): 'hard' | 'soft' {
  const hardBounceKeywords = [
    'user unknown', 'mailbox not found', 'invalid recipient',
    'does not exist', 'recipient rejected', 'address rejected',
    'no such user', 'unknown user', 'invalid address'
  ];

  const errorMessage = (event.StateDesc || event.Comment || '').toLowerCase();
  const eventPermanent = event.StatePermanent === true;
  const blocked = event.Blocked === true;

  if (eventPermanent || blocked) return 'hard';

  if (hardBounceKeywords.some(keyword => errorMessage.includes(keyword))) {
    return 'hard';
  }

  return 'soft';
}

/**
 * Remove contact from a Mailjet list
 */
async function removeContactFromList(listId: number, contactId: number): Promise<boolean> {
  try {
    await axios.post(
      `https://api.mailjet.com/v3/REST/contactslist/${listId}/managecontact`,
      {
        Action: 'remove',
        ContactID: contactId
      },
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return true;
  } catch (error) {
    logger.error('Error removing contact from list', {
      listId,
      contactId,
      error: error.message
    });
    return false;
  }
}

/**
 * Add contact to suppression list
 */
async function addToSuppressionList(contactId: number): Promise<boolean> {
  if (!MAILJET_SUPPRESSION_LIST_ID) {
    logger.warn('No suppression list ID configured, skipping add');
    return true;
  }

  try {
    await axios.post(
      `https://api.mailjet.com/v3/REST/contactslist/${MAILJET_SUPPRESSION_LIST_ID}/managecontact`,
      {
        Action: 'addnoforce',
        ContactID: contactId
      },
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return true;
  } catch (error) {
    logger.error('Error adding contact to suppression list', {
      contactId,
      error: error.message
    });
    return false;
  }
}

/**
 * Record suppression in database
 */
async function recordSuppression(
  contactId: number,
  email: string,
  bounceType: 'hard' | 'soft',
  reason: string,
  campaignId: string | undefined,
  batchName: string,
  roundNumber: number
): Promise<boolean> {
  try {
    // Check if already exists
    const existing = await prisma.suppressedContact.findUnique({
      where: { contactId: BigInt(contactId) }
    });

    if (existing) {
      // Update bounce count
      await prisma.suppressedContact.update({
        where: { contactId: BigInt(contactId) },
        data: {
          bounceCount: existing.bounceCount + 1,
          lastBounceDate: new Date(),
          updatedAt: new Date()
        }
      });
      return true;
    }

    // Calculate revalidation date (180 days for soft bounces)
    const revalidationDate = bounceType === 'soft'
      ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      : null;

    // Create new suppression record
    await prisma.suppressedContact.create({
      data: {
        contactId: BigInt(contactId),
        email,
        suppressionType: bounceType === 'hard' ? 'hard_bounce' : 'soft_bounce',
        reason,
        bounceCount: 1,
        firstBounceDate: new Date(),
        lastBounceDate: new Date(),
        sourceCampaignId: campaignId,
        sourceBatch: batchName,
        sourceRound: roundNumber,
        mailjetListId: MAILJET_SUPPRESSION_LIST_ID ? BigInt(MAILJET_SUPPRESSION_LIST_ID) : null,
        mailjetBlocked: false,
        status: 'active',
        isPermanent: bounceType === 'hard',
        revalidationEligibleAt: revalidationDate,
        suppressedBy: 'automated_job',
        notes: `Automated cleanup after ${batchName} campaign`,
        metadata: {
          automatedCleanup: true,
          processedDate: new Date().toISOString()
        }
      }
    });

    return true;
  } catch (error) {
    logger.error('Error recording suppression in database', {
      contactId,
      error: error.message
    });
    return false;
  }
}

/**
 * Process bounce cleanup job
 */
async function processBounceCleanup(job: Job<BounceCleanupJobData>): Promise<void> {
  const { campaignName, roundNumber, batchListId, batchListName, campaignId } = job.data;

  logger.info('Starting bounce cleanup', {
    campaignName,
    roundNumber,
    batchListId,
    batchListName,
    campaignId
  });

  try {
    // Step 1: Fetch bounce events
    logger.info('Fetching bounce events...');
    const bounceEvents = await fetchBounceEvents(campaignId, batchListId);

    logger.info(`Found ${bounceEvents.length} bounce events`);

    if (bounceEvents.length === 0) {
      logger.info('No bounces to process');
      return;
    }

    // Step 2: Process each bounce
    const stats = {
      hardBounces: 0,
      softBounces: 0,
      removed: 0,
      suppressed: 0,
      recorded: 0,
      errors: 0
    };

    const processedContacts = new Set<number>(); // Avoid duplicates

    for (const event of bounceEvents) {
      const contactId = event.ContactID;

      // Skip if already processed
      if (processedContacts.has(contactId)) continue;
      processedContacts.add(contactId);

      const bounceType = categorizeBounce(event);
      const email = event.Email || 'unknown@example.com';
      const reason = event.StateDesc || event.Comment || 'No reason provided';

      if (bounceType === 'hard') {
        stats.hardBounces++;

        // Remove from master list
        const removedFromMaster = await removeContactFromList(MASTER_LIST_ID, contactId);
        if (removedFromMaster) stats.removed++;

        // Remove from batch list
        await removeContactFromList(batchListId, contactId);

        // Add to suppression list
        const addedToSuppression = await addToSuppressionList(contactId);
        if (addedToSuppression) stats.suppressed++;

        // Record in database
        const recorded = await recordSuppression(
          contactId,
          email,
          bounceType,
          reason,
          campaignId,
          batchListName,
          roundNumber
        );
        if (recorded) stats.recorded++;
        else stats.errors++;

      } else {
        stats.softBounces++;

        // For soft bounces, just record in database for tracking
        // Only suppress after multiple consecutive soft bounces
        const existing = await prisma.suppressedContact.findUnique({
          where: { contactId: BigInt(contactId) }
        });

        if (existing && existing.bounceCount >= 2) {
          // This is the 3rd+ soft bounce, suppress it
          logger.info(`Suppressing contact ${contactId} after ${existing.bounceCount + 1} soft bounces`);

          await removeContactFromList(MASTER_LIST_ID, contactId);
          await removeContactFromList(batchListId, contactId);
          await addToSuppressionList(contactId);
          stats.suppressed++;
        }

        // Always record the bounce
        const recorded = await recordSuppression(
          contactId,
          email,
          bounceType,
          reason,
          campaignId,
          batchListName,
          roundNumber
        );
        if (recorded) stats.recorded++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Step 3: Log summary
    logger.info('Bounce cleanup completed', {
      campaignName,
      roundNumber,
      stats
    });

    // Step 4: Send notification if bounce rate is high
    const totalBounces = stats.hardBounces + stats.softBounces;
    const bounceRate = (totalBounces / 1000) * 100; // Assuming 1000 contacts per batch

    if (bounceRate > 5) {
      logger.warn('High bounce rate detected', {
        campaignName,
        roundNumber,
        bounceRate: `${bounceRate.toFixed(2)}%`,
        hardBounces: stats.hardBounces,
        softBounces: stats.softBounces
      });

      // TODO: Send Slack notification about high bounce rate
    }

  } catch (error) {
    logger.error('Bounce cleanup failed', {
      error: error.message,
      campaignName,
      roundNumber
    });
    throw error;
  }
}

/**
 * Create bounce cleanup worker
 */
export function createBounceCleanupWorker(): Worker<BounceCleanupJobData> {
  const worker = new Worker<BounceCleanupJobData>(
    'bounce-cleanup',
    async (job: Job<BounceCleanupJobData>) => {
      await processBounceCleanup(job);
    },
    {
      connection: queueRedis,
      concurrency: 1, // Process one cleanup at a time
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000 // per minute
      }
    }
  );

  worker.on('completed', (job) => {
    logger.info('Bounce cleanup job completed', {
      jobId: job.id,
      campaignName: job.data.campaignName,
      roundNumber: job.data.roundNumber
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Bounce cleanup job failed', {
      jobId: job?.id,
      campaignName: job?.data.campaignName,
      error: error.message
    });
  });

  return worker;
}

/**
 * Schedule bounce cleanup after campaign send
 * Default: 24 hours after campaign launch
 */
export async function scheduleBounceCleanup(
  jobData: BounceCleanupJobData,
  delayHours: number = 24
): Promise<void> {
  const delayMs = delayHours * 60 * 60 * 1000;

  try {
    await bounceCleanupQueue.add(
      'bounce-cleanup',
      jobData,
      {
        jobId: `cleanup-${jobData.batchListName}-${Date.now()}`,
        delay: delayMs
      }
    );

    logger.info('Bounce cleanup scheduled', {
      campaignName: jobData.campaignName,
      roundNumber: jobData.roundNumber,
      delayHours,
      scheduledFor: new Date(Date.now() + delayMs).toISOString()
    });

  } catch (error) {
    logger.error('Failed to schedule bounce cleanup', {
      error: error.message,
      campaignName: jobData.campaignName
    });
    throw error;
  }
}

/**
 * Trigger immediate bounce cleanup (for testing or manual cleanup)
 */
export async function triggerImmediateBounceCleanup(
  jobData: BounceCleanupJobData
): Promise<void> {
  try {
    await bounceCleanupQueue.add(
      'bounce-cleanup-immediate',
      jobData,
      {
        jobId: `cleanup-immediate-${jobData.batchListName}-${Date.now()}`,
        priority: 1 // High priority
      }
    );

    logger.info('Immediate bounce cleanup triggered', {
      campaignName: jobData.campaignName,
      roundNumber: jobData.roundNumber
    });

  } catch (error) {
    logger.error('Failed to trigger immediate bounce cleanup', {
      error: error.message,
      campaignName: jobData.campaignName
    });
    throw error;
  }
}
