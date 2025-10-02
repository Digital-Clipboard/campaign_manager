#!/usr/bin/env node

/**
 * Cleanup Bounced Contacts
 * Purpose: Remove bounced contacts from campaign lists and add to suppression list
 *
 * This script:
 * 1. Reads bounce data from analysis report (JSON file)
 * 2. Removes hard bounce contacts from:
 *    - Master "users" list (ID: 5776)
 *    - Campaign batch lists (campaign_batch_001, 002, 003)
 * 3. Adds bounced contacts to suppression list in Mailjet
 * 4. Records all suppressions in the database
 * 5. Generates cleanup report
 *
 * Usage:
 *   node cleanup-bounced-contacts.js <bounce-report.json>
 *   node cleanup-bounced-contacts.js --dry-run <bounce-report.json>
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_SUPPRESSION_LIST_ID = process.env.MAILJET_SUPPRESSION_LIST_ID;

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
const prisma = new PrismaClient();

// List IDs
const MASTER_LIST_ID = 5776; // "users" list
const CAMPAIGN_BATCHES = {
  'campaign_batch_001': 10502980,
  'campaign_batch_002': 10503118,
  'campaign_batch_003': 10503192
};

/**
 * Remove a contact from a list
 */
async function removeContactFromList(listId, contactId) {
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
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.ErrorMessage || error.message
    };
  }
}

/**
 * Add contact to suppression list in Mailjet
 */
async function addToSuppressionList(contactId, suppressionListId) {
  if (!suppressionListId) {
    console.log('   ⚠️  No suppression list ID configured, skipping Mailjet add');
    return { success: true, skipped: true };
  }

  try {
    await axios.post(
      `https://api.mailjet.com/v3/REST/contactslist/${suppressionListId}/managecontact`,
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
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.ErrorMessage || error.message
    };
  }
}

/**
 * Record suppression in database
 */
async function recordSuppressionInDatabase(bounceRecord, sourceBatch, sourceRound) {
  try {
    // Check if already exists
    const existing = await prisma.suppressedContact.findUnique({
      where: { contactId: BigInt(bounceRecord.contactId) }
    });

    if (existing) {
      // Update bounce count and last bounce date
      await prisma.suppressedContact.update({
        where: { contactId: BigInt(bounceRecord.contactId) },
        data: {
          bounceCount: existing.bounceCount + 1,
          lastBounceDate: new Date(bounceRecord.date),
          updatedAt: new Date()
        }
      });
      return { success: true, updated: true };
    }

    // Calculate revalidation date (180 days for soft bounces only)
    const revalidationDate = bounceRecord.bounceType === 'soft'
      ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      : null;

    // Create new record
    await prisma.suppressedContact.create({
      data: {
        contactId: BigInt(bounceRecord.contactId),
        email: bounceRecord.email,
        suppressionType: bounceRecord.bounceType === 'hard' ? 'hard_bounce' : 'soft_bounce',
        reason: bounceRecord.reason,
        bounceCount: 1,
        firstBounceDate: new Date(bounceRecord.date),
        lastBounceDate: new Date(bounceRecord.date),
        sourceCampaignId: String(bounceRecord.campaignId),
        sourceBatch: sourceBatch,
        sourceRound: sourceRound,
        mailjetListId: MAILJET_SUPPRESSION_LIST_ID ? BigInt(MAILJET_SUPPRESSION_LIST_ID) : null,
        mailjetBlocked: bounceRecord.blocked,
        mailjetErrorCode: null,
        status: 'active',
        isPermanent: bounceRecord.bounceType === 'hard',
        revalidationEligibleAt: revalidationDate,
        suppressedBy: 'automated_cleanup',
        notes: `Automated cleanup from ${sourceBatch}`,
        metadata: {
          statePermanent: bounceRecord.statePermanent,
          cleanupDate: new Date().toISOString()
        }
      }
    });

    return { success: true, created: true };
  } catch (error) {
    console.error(`   ❌ Database error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process a single bounce record
 */
async function processBounce(bounceRecord, sourceBatch, sourceRound, dryRun = false) {
  const contactId = bounceRecord.contactId;
  const results = {
    contactId,
    email: bounceRecord.email,
    removedFrom: [],
    addedToSuppression: false,
    recordedInDb: false,
    errors: []
  };

  console.log(`   Processing Contact ${contactId} (${bounceRecord.email})...`);

  if (dryRun) {
    console.log(`      [DRY RUN] Would remove from master list and batch lists`);
    console.log(`      [DRY RUN] Would add to suppression list`);
    console.log(`      [DRY RUN] Would record in database`);
    return results;
  }

  // Step 1: Remove from master list
  console.log(`      Removing from master list...`);
  const masterResult = await removeContactFromList(MASTER_LIST_ID, contactId);
  if (masterResult.success) {
    results.removedFrom.push('master_users_list');
    console.log(`      ✓ Removed from master list`);
  } else {
    results.errors.push(`Master list: ${masterResult.error}`);
    console.log(`      ✗ Failed to remove from master list: ${masterResult.error}`);
  }

  // Step 2: Remove from batch list
  const batchListId = CAMPAIGN_BATCHES[sourceBatch];
  if (batchListId) {
    console.log(`      Removing from ${sourceBatch}...`);
    const batchResult = await removeContactFromList(batchListId, contactId);
    if (batchResult.success) {
      results.removedFrom.push(sourceBatch);
      console.log(`      ✓ Removed from ${sourceBatch}`);
    } else {
      results.errors.push(`${sourceBatch}: ${batchResult.error}`);
      console.log(`      ✗ Failed to remove from ${sourceBatch}: ${batchResult.error}`);
    }
  }

  // Step 3: Add to suppression list
  if (MAILJET_SUPPRESSION_LIST_ID) {
    console.log(`      Adding to suppression list...`);
    const suppressionResult = await addToSuppressionList(contactId, MAILJET_SUPPRESSION_LIST_ID);
    if (suppressionResult.success) {
      results.addedToSuppression = true;
      console.log(`      ✓ Added to suppression list`);
    } else if (suppressionResult.skipped) {
      console.log(`      ⚠️  Skipped (no suppression list configured)`);
    } else {
      results.errors.push(`Suppression: ${suppressionResult.error}`);
      console.log(`      ✗ Failed to add to suppression list: ${suppressionResult.error}`);
    }
  }

  // Step 4: Record in database
  console.log(`      Recording in database...`);
  const dbResult = await recordSuppressionInDatabase(bounceRecord, sourceBatch, sourceRound);
  if (dbResult.success) {
    results.recordedInDb = true;
    if (dbResult.updated) {
      console.log(`      ✓ Updated existing database record`);
    } else {
      console.log(`      ✓ Created database record`);
    }
  } else {
    results.errors.push(`Database: ${dbResult.error}`);
    console.log(`      ✗ Failed to record in database: ${dbResult.error}`);
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));

  return results;
}

/**
 * Load bounce report from JSON file
 */
function loadBounceReport(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate cleanup report
 */
function generateCleanupReport(results, outputPath) {
  const timestamp = new Date().toISOString();

  const report = {
    timestamp,
    summary: {
      totalProcessed: results.length,
      successful: results.filter(r => r.recordedInDb).length,
      failed: results.filter(r => !r.recordedInDb).length,
      errors: results.filter(r => r.errors.length > 0).length
    },
    results
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Cleanup report saved: ${outputPath}`);

  return report;
}

/**
 * Main cleanup function
 */
async function cleanupBouncedContacts(bounceReportPath, dryRun = false) {
  console.log('🧹 BOUNCED CONTACTS CLEANUP');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Bounce Report: ${bounceReportPath}\n`);

  try {
    // Load bounce report
    console.log('Step 1: Loading bounce report...');
    const bounceData = loadBounceReport(bounceReportPath);
    console.log(`   ✅ Loaded ${bounceData.results.length} batch result(s)\n`);

    // Process each batch
    const allResults = [];
    let totalHardBounces = 0;
    let totalSoftBounces = 0;

    for (const batchResult of bounceData.results) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📦 Processing ${batchResult.batch} (Round ${batchResult.round})`);
      console.log(`   Hard Bounces: ${batchResult.hardBounces.length}`);
      console.log(`   Soft Bounces: ${batchResult.softBounces.length}`);
      console.log(`${'─'.repeat(80)}\n`);

      // Process hard bounces (always suppress)
      console.log(`🔴 Processing ${batchResult.hardBounces.length} hard bounce(s)...`);
      for (const bounce of batchResult.hardBounces) {
        const result = await processBounce(
          bounce,
          batchResult.batch,
          batchResult.round,
          dryRun
        );
        allResults.push(result);
        totalHardBounces++;
      }

      // Process soft bounces (if they meet threshold)
      console.log(`\n🟡 Processing ${batchResult.softBounces.length} soft bounce(s)...`);
      console.log(`   Note: Only processing soft bounces that meet suppression threshold`);

      // For now, we'll skip soft bounces unless they've bounced multiple times
      // This would need to be enhanced with historical tracking
      for (const bounce of batchResult.softBounces) {
        // Check if this contact has bounced before
        const existing = await prisma.suppressedContact.findUnique({
          where: { contactId: BigInt(bounce.contactId) }
        });

        if (existing && existing.bounceCount >= 2) {
          console.log(`   Contact ${bounce.contactId} has bounced ${existing.bounceCount + 1} times, suppressing...`);
          const result = await processBounce(
            bounce,
            batchResult.batch,
            batchResult.round,
            dryRun
          );
          allResults.push(result);
          totalSoftBounces++;
        } else {
          // Just record it for tracking
          if (!dryRun) {
            await recordSuppressionInDatabase(bounce, batchResult.batch, batchResult.round);
          }
        }
      }
    }

    // Generate summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 CLEANUP SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '✅ LIVE'}`);
    console.log(`Total Hard Bounces Processed: ${totalHardBounces}`);
    console.log(`Total Soft Bounces Suppressed: ${totalSoftBounces}`);
    console.log(`Total Contacts Processed: ${allResults.length}`);

    const successful = allResults.filter(r => r.recordedInDb).length;
    const failed = allResults.filter(r => r.errors.length > 0).length;

    console.log(`\n✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (!dryRun) {
      // Save cleanup report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const reportPath = path.join(__dirname, `cleanup-report-${timestamp}.json`);
      generateCleanupReport(allResults, reportPath);

      console.log(`\n📝 NEXT STEPS:`);
      console.log(`1. Verify contacts removed from Mailjet dashboard`);
      console.log(`2. Verify suppression list populated`);
      console.log(`3. Update batch creation scripts to exclude suppressed contacts`);
      console.log(`4. Monitor bounce rates in future campaigns`);
    } else {
      console.log(`\n📝 DRY RUN COMPLETE - No changes were made`);
      console.log(`   Run without --dry-run flag to execute cleanup`);
    }

    await prisma.$disconnect();
    return allResults;

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    await prisma.$disconnect();
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reportPath = args.find(arg => !arg.startsWith('--'));

if (!reportPath) {
  console.error('❌ Usage: node cleanup-bounced-contacts.js [--dry-run] <bounce-report.json>');
  console.error('\nExample:');
  console.error('  node cleanup-bounced-contacts.js bounce-report-2025-10-01.json');
  console.error('  node cleanup-bounced-contacts.js --dry-run bounce-report-2025-10-01.json');
  process.exit(1);
}

// Run the script
if (require.main === module) {
  cleanupBouncedContacts(reportPath, dryRun)
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupBouncedContacts, processBounce, recordSuppressionInDatabase };
