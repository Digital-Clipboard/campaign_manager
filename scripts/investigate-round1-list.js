#!/usr/bin/env node

/**
 * Investigation Script: Round 1 User List Analysis
 * Purpose: Determine how Round 1 (Users 1-1000) list was created
 *
 * This script will:
 * 1. Check MailJet for existing contact lists
 * 2. Analyze the first 1000 users to determine segmentation criteria
 * 3. Report findings to help create Round 2 list consistently
 */

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials in .env file');
  console.error('   Required: MAILJET_API_KEY and MAILJET_SECRET_KEY');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

/**
 * Fetch all contact lists from MailJet
 */
async function getContactLists() {
  try {
    console.log('🔍 Fetching MailJet contact lists...\n');

    const response = await axios.get('https://api.mailjet.com/v3/REST/contactslist', {
      headers: {
        'Authorization': `Basic ${mailjetAuth}`,
        'Content-Type': 'application/json'
      }
    });

    const lists = response.data.Data;

    if (lists.length === 0) {
      console.log('⚠️  No contact lists found in MailJet');
      return [];
    }

    console.log(`📋 Found ${lists.length} contact list(s):\n`);

    lists.forEach((list, index) => {
      console.log(`${index + 1}. ${list.Name}`);
      console.log(`   ID: ${list.ID}`);
      console.log(`   Subscriber Count: ${list.SubscriberCount}`);
      console.log(`   Created: ${new Date(list.CreatedAt * 1000).toLocaleString()}`);
      console.log(`   Address: ${list.Address || 'N/A'}`);
      console.log('');
    });

    return lists;

  } catch (error) {
    console.error('❌ Error fetching contact lists:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get contacts from a specific list
 */
async function getListContacts(listId, limit = 100) {
  try {
    console.log(`\n📥 Fetching contacts from list ${listId} (first ${limit})...\n`);

    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contactslist/${listId}/managemanycontacts`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          Limit: limit
        }
      }
    );

    const contacts = response.data.Data;

    if (contacts.length === 0) {
      console.log('⚠️  No contacts found in this list');
      return [];
    }

    console.log(`Found ${contacts.length} contacts in list`);
    console.log('\n📊 Sample contacts (first 10):');
    console.log('─'.repeat(80));

    contacts.slice(0, 10).forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.Email || 'N/A'}`);
      console.log(`   Name: ${contact.Name || 'N/A'}`);
      console.log(`   Created: ${contact.CreatedAt ? new Date(contact.CreatedAt * 1000).toLocaleString() : 'N/A'}`);
      console.log(`   Unsubscribed: ${contact.IsUnsubscribed ? 'Yes' : 'No'}`);
      console.log('');
    });

    return contacts;

  } catch (error) {
    console.error('❌ Error fetching list contacts:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Analyze contact patterns to determine segmentation criteria
 */
function analyzeContactPattern(contacts) {
  if (contacts.length === 0) {
    console.log('⚠️  No contacts to analyze');
    return;
  }

  console.log('\n🔬 CONTACT PATTERN ANALYSIS');
  console.log('='.repeat(80));

  // Check if contacts have sequential IDs (would suggest ID-based segmentation)
  const hasContactIds = contacts.some(c => c.ID);

  // Check creation dates (would suggest date-based segmentation)
  const creationDates = contacts
    .filter(c => c.CreatedAt)
    .map(c => new Date(c.CreatedAt * 1000))
    .sort((a, b) => a - b);

  if (creationDates.length > 0) {
    const earliest = creationDates[0];
    const latest = creationDates[creationDates.length - 1];
    const daysDiff = (latest - earliest) / (1000 * 60 * 60 * 24);

    console.log('\n📅 Date Analysis:');
    console.log(`   Earliest contact: ${earliest.toLocaleDateString()}`);
    console.log(`   Latest contact: ${latest.toLocaleDateString()}`);
    console.log(`   Date range: ${daysDiff.toFixed(0)} days`);
    console.log(`   Pattern: ${daysDiff < 7 ? 'Recent batch upload' : 'Accumulated over time'}`);
  }

  // Check for naming patterns
  const emails = contacts.map(c => c.Email).filter(Boolean);
  const domains = emails.map(email => email.split('@')[1]);
  const uniqueDomains = [...new Set(domains)];

  console.log('\n📧 Email Analysis:');
  console.log(`   Total emails: ${emails.length}`);
  console.log(`   Unique domains: ${uniqueDomains.length}`);
  console.log(`   Top domains: ${uniqueDomains.slice(0, 5).join(', ')}`);

  // Suggest segmentation method
  console.log('\n💡 HYPOTHESIS:');
  if (daysDiff < 30) {
    console.log('   ✓ Likely a MANUAL UPLOAD or BATCH IMPORT');
    console.log('   ✓ Users were probably selected via database query');
    console.log('   ✓ Segmentation criteria: Possibly FIRST-IN-FIRST-OUT (oldest registrations)');
  } else {
    console.log('   ✓ Contacts accumulated over time');
    console.log('   ✓ May be based on ENGAGEMENT or ACTIVITY criteria');
  }

  console.log('\n📝 RECOMMENDATION FOR ROUND 2:');
  console.log('   1. If this is Round 1 list, check the EARLIEST and LATEST user registration dates');
  console.log('   2. Round 2 should start RIGHT AFTER the latest user in Round 1');
  console.log('   3. Use the same ordering criteria (likely: ORDER BY created_at or user_id)');
  console.log('   4. Select the NEXT 1,000 users after Round 1\'s last user');

  return {
    hasContactIds,
    dateRange: { earliest: creationDates[0], latest: creationDates[creationDates.length - 1] },
    uniqueDomains: uniqueDomains.length,
    hypothesis: daysDiff < 30 ? 'batch_upload' : 'organic_growth'
  };
}

/**
 * Main investigation function
 */
async function investigateRound1() {
  console.log('🚀 Round 1 User List Investigation');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log(`🎯 Goal: Determine how Round 1 (Users 1-1000) was created\n`);

  // Step 1: Get all contact lists
  const lists = await getContactLists();

  if (lists.length === 0) {
    console.log('\n❗ CRITICAL: No contact lists found!');
    console.log('   Action required: Create Round 1 and Round 2 lists in MailJet');
    return;
  }

  // Step 2: Try to identify Round 1 list
  const round1List = lists.find(list =>
    list.Name.toLowerCase().includes('round 1') ||
    list.Name.toLowerCase().includes('1-1000') ||
    list.Name.toLowerCase().includes('client letter') && list.SubscriberCount >= 900 && list.SubscriberCount <= 1100
  );

  if (round1List) {
    console.log('✅ Found potential Round 1 list:', round1List.Name);
    console.log(`   List ID: ${round1List.ID}`);
    console.log(`   Subscribers: ${round1List.SubscriberCount}`);

    // Analyze the contacts
    const contacts = await getListContacts(round1List.ID, 100);

    if (contacts.length > 0) {
      const analysis = analyzeContactPattern(contacts);

      console.log('\n\n🎯 NEXT STEPS FOR ROUND 2:');
      console.log('─'.repeat(80));
      console.log('1. Confirm the segmentation criteria with the team');
      console.log('2. Export the next 1,000 users using the same criteria');
      console.log('3. Create "Client Letter Round 2 - Users 1001-2000" list in MailJet');
      console.log('4. Upload contacts to the new list');
      console.log('5. Update Campaign Manager with new list ID');
    }

  } else {
    console.log('\n⚠️  Could not automatically identify Round 1 list');
    console.log('   Checking first list for analysis...\n');

    if (lists.length > 0) {
      const contacts = await getListContacts(lists[0].ID, 100);
      if (contacts.length > 0) {
        analyzeContactPattern(contacts);
      }
    }
  }

  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total lists in MailJet: ${lists.length}`);
  console.log(`Round 1 list identified: ${round1List ? 'Yes' : 'No'}`);
  console.log(`Campaign launch: TODAY at 9:15 AM UTC`);
  console.log(`Time remaining: Check your clock!`);
  console.log('\n✅ Investigation complete. Review findings above to create Round 2 list.\n');
}

// Run the investigation
if (require.main === module) {
  investigateRound1().catch(error => {
    console.error('\n❌ Investigation failed:', error.message);
    process.exit(1);
  });
}

module.exports = { investigateRound1, getContactLists, getListContacts, analyzeContactPattern };