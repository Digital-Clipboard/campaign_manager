#!/usr/bin/env node

/**
 * Analyze Bounce Events from Campaign Batches
 * Purpose: Fetch and categorize bounce data from Mailjet for campaign batches 1, 2, and 3
 *
 * This script:
 * 1. Fetches message statistics for each campaign batch
 * 2. Retrieves detailed bounce events from Mailjet Event API
 * 3. Categorizes bounces as hard (permanent) or soft (temporary)
 * 4. Generates a detailed report with Contact IDs and email addresses
 * 5. Provides recommendations for suppression
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

// Campaign batch list IDs
const CAMPAIGN_BATCHES = {
  'batch_001': { listId: 10502980, name: 'campaign_batch_001', round: 1 },
  'batch_002': { listId: 10503118, name: 'campaign_batch_002', round: 2 },
  'batch_003': { listId: 10503192, name: 'campaign_batch_003', round: 3 }
};

/**
 * Fetch campaigns that used a specific contact list
 */
async function getCampaignsForList(listId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/campaign`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          ContactsList: listId,
          Limit: 100
        }
      }
    );

    return response.data.Data || [];
  } catch (error) {
    console.error(`   ❌ Error fetching campaigns for list ${listId}:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Fetch bounce events for a specific campaign
 */
async function getBounceEvents(campaignId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/messagestatistics`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          CampaignID: campaignId,
          ShowBounced: true
        }
      }
    );

    return response.data.Data || [];
  } catch (error) {
    console.error(`   ❌ Error fetching bounce events for campaign ${campaignId}:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Fetch detailed message events (including bounce details)
 */
async function getMessageEvents(campaignId, eventType = 'bounce') {
  let allEvents = [];
  let offset = 0;
  const limit = 1000;

  try {
    while (true) {
      const response = await axios.get(
        `https://api.mailjet.com/v3/REST/messageeventlist`,
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          },
          params: {
            CampaignID: campaignId,
            Event: eventType,
            Limit: limit,
            Offset: offset
          }
        }
      );

      const events = response.data.Data || [];
      allEvents = allEvents.concat(events);

      if (events.length < limit) {
        break;
      }

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allEvents;
  } catch (error) {
    console.error(`   ❌ Error fetching ${eventType} events:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Fetch contact details for a Contact ID
 */
async function getContactDetails(contactId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contact/${contactId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.Data[0] || null;
  } catch (error) {
    console.error(`   ❌ Error fetching contact ${contactId}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Categorize bounce by type
 */
function categorizeBounce(event) {
  const hardBounceKeywords = [
    'user unknown',
    'mailbox not found',
    'invalid recipient',
    'does not exist',
    'recipient rejected',
    'address rejected',
    'no such user',
    'unknown user',
    'invalid address'
  ];

  const softBounceKeywords = [
    'mailbox full',
    'over quota',
    'temporary failure',
    'try again later',
    'greylisted',
    'temporarily unavailable',
    'connection timeout'
  ];

  const errorMessage = (event.StateDesc || event.Comment || '').toLowerCase();
  const eventPermanent = event.StatePermanent === true;
  const blocked = event.Blocked === true;

  // Check if it's explicitly marked as hard bounce
  if (eventPermanent || blocked) {
    return 'hard';
  }

  // Check error message for hard bounce indicators
  if (hardBounceKeywords.some(keyword => errorMessage.includes(keyword))) {
    return 'hard';
  }

  // Check for soft bounce indicators
  if (softBounceKeywords.some(keyword => errorMessage.includes(keyword))) {
    return 'soft';
  }

  // Default to soft if uncertain (safer approach)
  return 'soft';
}

/**
 * Analyze bounces for a specific batch
 */
async function analyzeBatch(batchKey) {
  const batch = CAMPAIGN_BATCHES[batchKey];
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Analyzing ${batch.name} (Round ${batch.round})`);
  console.log(`   List ID: ${batch.listId}`);
  console.log(`${'='.repeat(80)}\n`);

  // Step 1: Get campaigns for this list
  console.log('Step 1: Fetching campaigns...');
  const campaigns = await getCampaignsForList(batch.listId);

  if (campaigns.length === 0) {
    console.log('   ⚠️  No campaigns found for this list');
    return { batch: batch.name, hardBounces: [], softBounces: [], totalBounces: 0 };
  }

  console.log(`   ✅ Found ${campaigns.length} campaign(s)`);
  campaigns.forEach(c => {
    console.log(`      - Campaign ID: ${c.ID}, Sent: ${c.SendTimeDate || 'Not sent'}`);
  });

  // Step 2: Fetch bounce events for each campaign
  console.log('\nStep 2: Fetching bounce events...');
  const hardBounces = [];
  const softBounces = [];
  const contactsProcessed = new Set(); // Track to avoid duplicates

  for (const campaign of campaigns) {
    console.log(`\n   Processing Campaign ${campaign.ID}...`);

    const bounceEvents = await getMessageEvents(campaign.ID, 'bounce');
    const blockedEvents = await getMessageEvents(campaign.ID, 'blocked');

    const allEvents = [...bounceEvents, ...blockedEvents];
    console.log(`      Found ${allEvents.length} bounce/blocked events`);

    for (const event of allEvents) {
      const contactId = event.ContactID;

      // Skip if we've already processed this contact
      if (contactsProcessed.has(contactId)) {
        continue;
      }
      contactsProcessed.add(contactId);

      const bounceType = categorizeBounce(event);

      const bounceRecord = {
        contactId: contactId,
        email: event.Email || 'Unknown',
        bounceType: bounceType,
        reason: event.StateDesc || event.Comment || 'No reason provided',
        date: event.ArrivedAt || event.EventAt || 'Unknown',
        campaignId: campaign.ID,
        blocked: event.Blocked || false,
        statePermanent: event.StatePermanent || false
      };

      if (bounceType === 'hard') {
        hardBounces.push(bounceRecord);
      } else {
        softBounces.push(bounceRecord);
      }
    }
  }

  // Step 3: Generate report for this batch
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📈 RESULTS for ${batch.name}:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   🔴 Hard Bounces: ${hardBounces.length}`);
  console.log(`   🟡 Soft Bounces: ${softBounces.length}`);
  console.log(`   📧 Total Bounces: ${hardBounces.length + softBounces.length}`);

  if (hardBounces.length > 0) {
    console.log(`\n   Hard Bounce Examples (first 5):`);
    hardBounces.slice(0, 5).forEach((b, i) => {
      console.log(`      ${i + 1}. ${b.email} - ${b.reason.substring(0, 60)}`);
    });
  }

  if (softBounces.length > 0) {
    console.log(`\n   Soft Bounce Examples (first 5):`);
    softBounces.slice(0, 5).forEach((b, i) => {
      console.log(`      ${i + 1}. ${b.email} - ${b.reason.substring(0, 60)}`);
    });
  }

  return {
    batch: batch.name,
    listId: batch.listId,
    round: batch.round,
    hardBounces,
    softBounces,
    totalBounces: hardBounces.length + softBounces.length,
    bounceRate: ((hardBounces.length + softBounces.length) / 1000 * 100).toFixed(2) + '%'
  };
}

/**
 * Generate comprehensive report
 */
function generateReport(results) {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 COMPREHENSIVE BOUNCE ANALYSIS REPORT`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Generated: ${new Date().toLocaleString()}\n`);

  let totalHardBounces = 0;
  let totalSoftBounces = 0;
  let allHardBounceContacts = [];

  results.forEach(result => {
    console.log(`\n${result.batch} (Round ${result.round}):`);
    console.log(`   List ID: ${result.listId}`);
    console.log(`   Total Sent: ~1,000 (estimated)`);
    console.log(`   Hard Bounces: ${result.hardBounces.length}`);
    console.log(`   Soft Bounces: ${result.softBounces.length}`);
    console.log(`   Bounce Rate: ${result.bounceRate}`);

    totalHardBounces += result.hardBounces.length;
    totalSoftBounces += result.softBounces.length;
    allHardBounceContacts = allHardBounceContacts.concat(result.hardBounces);
  });

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`TOTALS ACROSS ALL BATCHES:`);
  console.log(`   🔴 Total Hard Bounces: ${totalHardBounces}`);
  console.log(`   🟡 Total Soft Bounces: ${totalSoftBounces}`);
  console.log(`   📧 Total Bounces: ${totalHardBounces + totalSoftBounces}`);
  console.log(`   📊 Overall Bounce Rate: ${((totalHardBounces + totalSoftBounces) / (results.length * 1000) * 100).toFixed(2)}%`);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`🎯 RECOMMENDATIONS:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`1. IMMEDIATE ACTION (Hard Bounces - ${totalHardBounces} contacts):`);
  console.log(`   - Remove all ${totalHardBounces} hard bounce contacts from master list`);
  console.log(`   - Add to suppression list to prevent future sends`);
  console.log(`   - These are permanent failures (invalid/non-existent emails)`);

  if (totalSoftBounces > 0) {
    console.log(`\n2. MONITOR (Soft Bounces - ${totalSoftBounces} contacts):`);
    console.log(`   - Track soft bounces for 3-5 consecutive failures`);
    console.log(`   - After repeated failures, move to suppression list`);
    console.log(`   - These may be temporary issues (mailbox full, server down)`);
  }

  console.log(`\n3. DELIVERABILITY IMPACT:`);
  const overallRate = ((totalHardBounces + totalSoftBounces) / (results.length * 1000) * 100).toFixed(2);
  if (overallRate > 5) {
    console.log(`   ⚠️  WARNING: Bounce rate of ${overallRate}% exceeds 5% threshold`);
    console.log(`   - This may harm sender reputation`);
    console.log(`   - Immediate list cleanup recommended`);
  } else {
    console.log(`   ✅ Bounce rate of ${overallRate}% is within acceptable range (<5%)`);
    console.log(`   - Still recommend cleanup to maintain quality`);
  }

  console.log(`\n4. NEXT STEPS:`);
  console.log(`   ✓ Review detailed CSV report (saved below)`);
  console.log(`   ✓ Run cleanup script to remove hard bounces`);
  console.log(`   ✓ Create/update suppression list in Mailjet`);
  console.log(`   ✓ Update batch creation scripts to exclude suppressed contacts`);

  // Save detailed CSV report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const csvPath = path.join(__dirname, `bounce-report-${timestamp}.csv`);
  const jsonPath = path.join(__dirname, `bounce-report-${timestamp}.json`);

  // Generate CSV
  let csvContent = 'Batch,Round,Contact ID,Email,Bounce Type,Reason,Date,Campaign ID,Blocked,State Permanent\n';
  results.forEach(result => {
    [...result.hardBounces, ...result.softBounces].forEach(bounce => {
      csvContent += `"${result.batch}",${result.round},${bounce.contactId},"${bounce.email}","${bounce.bounceType}","${bounce.reason.replace(/"/g, '""')}","${bounce.date}",${bounce.campaignId},${bounce.blocked},${bounce.statePermanent}\n`;
    });
  });

  fs.writeFileSync(csvPath, csvContent);
  console.log(`\n📄 Detailed CSV report saved: ${csvPath}`);

  // Generate JSON
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`📄 Detailed JSON report saved: ${jsonPath}`);

  // Generate contact ID list for cleanup script
  const contactIdsPath = path.join(__dirname, `hard-bounce-contact-ids-${timestamp}.txt`);
  const contactIds = allHardBounceContacts.map(b => b.contactId).join('\n');
  fs.writeFileSync(contactIdsPath, contactIds);
  console.log(`📄 Hard bounce Contact IDs saved: ${contactIdsPath}`);
  console.log(`   (Use this file for cleanup script)\n`);

  return {
    totalHardBounces,
    totalSoftBounces,
    csvPath,
    jsonPath,
    contactIdsPath
  };
}

/**
 * Main analysis function
 */
async function analyzeBounces() {
  console.log('🔬 EMAIL BOUNCE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Analyzing batches: ${Object.keys(CAMPAIGN_BATCHES).join(', ')}\n`);

  try {
    const results = [];

    // Analyze each batch
    for (const batchKey of Object.keys(CAMPAIGN_BATCHES)) {
      const result = await analyzeBatch(batchKey);
      results.push(result);

      // Small delay between batches to respect API limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate comprehensive report
    const summary = generateReport(results);

    console.log('\n✅ Analysis complete!');
    console.log('='.repeat(80));

    return { results, summary };

  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  analyzeBounces()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { analyzeBounces, analyzeBatch, categorizeBounce };
