#!/usr/bin/env node

/**
 * Simple Bounce Cleanup - Mailjet Native Approach
 * Purpose: Remove bounced contacts from lists using Mailjet's API
 *
 * This script:
 * 1. Fetches bounced/blocked message events from a campaign
 * 2. Removes those contacts from specified lists (master list, batch list)
 * 3. That's it - Mailjet handles the rest (automatic 90-day blocking)
 *
 * No database, no suppression list management - just clean up your lists.
 *
 * Usage:
 *   node simple-bounce-cleanup.js --campaign-id=12345
 *   node simple-bounce-cleanup.js --campaign-id=12345 --dry-run
 */

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

// Your lists
const MASTER_LIST_ID = 5776; // "users" list
const BATCH_LISTS = [
  { id: 10502980, name: 'campaign_batch_001' },
  { id: 10503118, name: 'campaign_batch_002' },
  { id: 10503192, name: 'campaign_batch_003' }
];

/**
 * Fetch bounce/blocked events for a campaign
 */
async function fetchBouncedContacts(campaignId) {
  console.log(`📥 Fetching bounced contacts for campaign ${campaignId}...`);

  try {
    const allMessages = [];

    // Fetch ALL messages from campaign, then filter
    let offset = 0;
    const limit = 1000;

    while (true) {
      const response = await axios.get(
        'https://api.mailjet.com/v3/REST/message',
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          },
          params: {
            Campaign: campaignId,
            Limit: limit,
            Offset: offset,
            ShowContactAlt: true
          }
        }
      );

      const messages = response.data.Data || [];
      allMessages.push(...messages);

      if (messages.length < limit) break;
      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`   Fetched ${allMessages.length} total messages`);

    // Filter for bounced messages (hard bounce, soft bounce, or blocked)
    const bouncedMessages = allMessages.filter(msg =>
      msg.Status === 'hardbounced' ||
      msg.Status === 'softbounced' ||
      msg.Status === 'blocked'
    );

    console.log(`   Found ${bouncedMessages.length} bounced/blocked messages`);

    // Get unique contact IDs
    const uniqueContacts = new Map();
    bouncedMessages.forEach(event => {
      const contactId = event.ContactID;
      if (contactId && !uniqueContacts.has(contactId)) {
        uniqueContacts.set(contactId, {
          contactId: contactId,
          email: event.ContactAlt || 'unknown',
          reason: event.Status === 'hardbounced' ? 'Hard bounce' :
                  event.Status === 'softbounced' ? 'Soft bounce' : 'Blocked'
        });
      }
    });

    const contacts = Array.from(uniqueContacts.values());
    console.log(`   ✅ Found ${contacts.length} unique bounced contacts\n`);

    return contacts;

  } catch (error) {
    console.error('❌ Error fetching bounced contacts:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Remove contact from a list
 */
async function removeContactFromList(listId, email) {
  try {
    await axios.post(
      `https://api.mailjet.com/v3/REST/contactslist/${listId}/managecontact`,
      {
        Action: 'remove',
        Email: email
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
    // Ignore "contact not in list" errors
    if (error.response?.status === 400) {
      return false; // Contact wasn't in this list
    }
    throw error;
  }
}

/**
 * Main cleanup function
 */
async function cleanupBounces(campaignId, dryRun = false) {
  console.log('🧹 SIMPLE BOUNCE CLEANUP');
  console.log('='.repeat(60));
  console.log(`Campaign ID: ${campaignId}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '✅ LIVE'}`);
  console.log('='.repeat(60));
  console.log();

  try {
    // Step 1: Fetch bounced contacts
    const bouncedContacts = await fetchBouncedContacts(campaignId);

    if (bouncedContacts.length === 0) {
      console.log('✅ No bounced contacts found. Your list is clean!');
      return;
    }

    // Step 2: Show what will be removed
    console.log('Bounced contacts to remove:');
    bouncedContacts.slice(0, 10).forEach((contact, i) => {
      console.log(`   ${i + 1}. ${contact.email} - ${contact.reason.substring(0, 50)}`);
    });
    if (bouncedContacts.length > 10) {
      console.log(`   ... and ${bouncedContacts.length - 10} more`);
    }
    console.log();

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log(`   Would remove ${bouncedContacts.length} contacts from:`);
      console.log(`   - Master "users" list (${MASTER_LIST_ID})`);
      BATCH_LISTS.forEach(list => {
        console.log(`   - ${list.name} (${list.id})`);
      });
      return;
    }

    // Step 3: Remove from master list
    console.log(`📤 Removing from master "users" list (${MASTER_LIST_ID})...`);
    let masterRemoved = 0;

    for (const contact of bouncedContacts) {
      const removed = await removeContactFromList(MASTER_LIST_ID, contact.email);
      if (removed) masterRemoved++;
      await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
    }

    console.log(`   ✅ Removed ${masterRemoved} contacts from master list\n`);

    // Step 4: Remove from batch lists
    for (const list of BATCH_LISTS) {
      console.log(`📤 Removing from ${list.name} (${list.id})...`);
      let batchRemoved = 0;

      for (const contact of bouncedContacts) {
        const removed = await removeContactFromList(list.id, contact.email);
        if (removed) batchRemoved++;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`   ✅ Removed ${batchRemoved} contacts from ${list.name}\n`);
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total bounced contacts: ${bouncedContacts.length}`);
    console.log(`Removed from master list: ${masterRemoved}`);
    console.log();
    console.log('📝 Note: Mailjet automatically blocks these contacts for 90 days.');
    console.log('   They won\'t receive emails even if re-added to lists.');
    console.log();

    // Save cleanup log (JSON)
    if (!dryRun) {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(__dirname, '../logs/bounce-cleanup');

      // Ensure directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}-campaign-${campaignId}.json`);

      const logData = {
        cleanupDate: new Date().toISOString(),
        campaignId: campaignId,
        bouncedContacts: bouncedContacts.length,
        masterListRemoved: masterRemoved,
        listsProcessed: BATCH_LISTS.map(list => list.name),
        sampleContacts: bouncedContacts.slice(0, 5).map(c => ({
          email: c.email,
          reason: c.reason
        }))
      };

      fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
      console.log(`📄 Cleanup log saved: ${logFile}`);
      console.log();
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const campaignIdArg = args.find(arg => arg.startsWith('--campaign-id='));
const dryRun = args.includes('--dry-run');

if (!campaignIdArg) {
  console.error('❌ Usage: node simple-bounce-cleanup.js --campaign-id=<id> [--dry-run]');
  console.error('\nExamples:');
  console.error('  node simple-bounce-cleanup.js --campaign-id=12345');
  console.error('  node simple-bounce-cleanup.js --campaign-id=12345 --dry-run');
  console.error('\nTo find campaign ID:');
  console.error('  1. Go to Mailjet dashboard → Campaigns');
  console.error('  2. Click on your campaign');
  console.error('  3. Campaign ID is in the URL or campaign details');
  process.exit(1);
}

const campaignId = campaignIdArg.split('=')[1];

// Run the script
if (require.main === module) {
  cleanupBounces(campaignId, dryRun)
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupBounces, fetchBouncedContacts };
