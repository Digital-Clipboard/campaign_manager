#!/usr/bin/env node

/**
 * Create Round 3 Contact List in MailJet (FIXED VERSION)
 * Purpose: Extract ALL REMAINING users (2,001+) from master "users" list and create campaign_batch_003
 *
 * FIX: Use Email addresses instead of ContactID when adding to list
 *
 * Strategy:
 * 1. Fetch ALL contacts from master "users" list (ID: 5776)
 * 2. Sort by Contact ID (which represents registration order)
 * 3. Skip first 2,000 (these are in campaign_batch_001 and campaign_batch_002)
 * 4. Take ALL remaining users (2,001 to end)
 * 5. Fetch full contact details (with emails) for each contact
 * 6. Add contacts to campaign_batch_003 using EMAIL addresses
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

/**
 * Fetch ALL contacts from a list (paginated) - returns list recipient data
 */
async function getAllContactsFromList(listId) {
  console.log(`📥 Fetching all contacts from list ${listId}...`);

  let allContacts = [];
  let offset = 0;
  const limit = 1000; // MailJet max per request

  try {
    while (true) {
      const response = await axios.get(
        `https://api.mailjet.com/v3/REST/listrecipient`,
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          },
          params: {
            ContactsList: listId,
            Limit: limit,
            Offset: offset
          }
        }
      );

      const contacts = response.data.Data;
      allContacts = allContacts.concat(contacts);

      console.log(`   Fetched ${contacts.length} contacts (total so far: ${allContacts.length})`);

      if (contacts.length < limit) {
        break;
      }

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Total contacts fetched: ${allContacts.length}\n`);
    return allContacts;

  } catch (error) {
    console.error('❌ Error fetching contacts:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get full contact details (including email) for a list of contact IDs
 */
async function getContactDetails(contactIds) {
  console.log(`📧 Fetching email addresses for ${contactIds.length} contacts...`);

  const contacts = [];
  let processed = 0;

  try {
    for (const contactId of contactIds) {
      const response = await axios.get(
        `https://api.mailjet.com/v3/REST/contact/${contactId}`,
        {
          headers: {
            'Authorization': `Basic ${mailjetAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const contact = response.data.Data[0];
      contacts.push({
        ContactID: contact.ID,
        Email: contact.Email
      });

      processed++;
      if (processed % 100 === 0) {
        console.log(`   Processed ${processed}/${contactIds.length} contacts...`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Retrieved ${contacts.length} email addresses\n`);
    return contacts;

  } catch (error) {
    console.error('❌ Error fetching contact details:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add contacts to a list in batches using EMAIL addresses
 */
async function addContactsToList(listId, contacts) {
  console.log(`📤 Adding ${contacts.length} contacts to list ${listId}...`);

  const batchSize = 100; // MailJet recommends batches of 100
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contacts.length / batchSize);

      console.log(`   Processing batch ${batchNum}/${totalBatches} (${batch.length} contacts)...`);

      try {
        const response = await axios.post(
          `https://api.mailjet.com/v3/REST/contactslist/${listId}/managemanycontacts`,
          {
            Action: 'addnoforce', // Don't override unsubscribe status
            Contacts: batch.map(c => ({ Email: c.Email }))  // ← FIXED: Use Email instead of ContactID
          },
          {
            headers: {
              'Authorization': `Basic ${mailjetAuth}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.Data && response.data.Data[0]) {
          const jobId = response.data.Data[0].JobID;
          successCount += batch.length;
          console.log(`   ✓ Batch ${batchNum} queued (Job ID: ${jobId})`);
        }

      } catch (batchError) {
        console.error(`   ✗ Batch ${batchNum} failed:`, batchError.response?.data || batchError.message);
        failCount += batch.length;
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Upload Summary:`);
    console.log(`   ✅ Successfully queued: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Note: MailJet processes uploads asynchronously`);
    console.log(`   🕐 Check list in 1-2 minutes to verify count\n`);

    return { success: successCount, failed: failCount };

  } catch (error) {
    console.error('❌ Error adding contacts:', error.message);
    throw error;
  }
}

/**
 * Main function to create Round 3 list
 */
async function createRound3List() {
  console.log('🚀 Creating Round 3 Contact List (campaign_batch_003) - FIXED VERSION');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log(`🎯 Goal: Extract ALL REMAINING users (2,001+) from master list\n`);

  try {
    // Step 1: Fetch all contacts from master "users" list
    const MASTER_LIST_ID = 5776;
    const TARGET_LIST_ID = 10503192; // Already created

    console.log('Step 1: Fetching contacts from master "users" list...');
    const allListRecipients = await getAllContactsFromList(MASTER_LIST_ID);

    if (allListRecipients.length < 2001) {
      console.error(`❌ ERROR: Not enough contacts in master list!`);
      console.error(`   Expected: At least 2,001 contacts`);
      console.error(`   Found: ${allListRecipients.length} contacts`);
      return;
    }

    // Step 2: Sort by Contact ID (FIFO)
    console.log('Step 2: Sorting contacts by Contact ID (FIFO order)...');
    allListRecipients.sort((a, b) => a.ContactID - b.ContactID);

    console.log(`   Earliest Contact ID: ${allListRecipients[0].ContactID}`);
    console.log(`   Latest Contact ID: ${allListRecipients[allListRecipients.length - 1].ContactID}`);
    console.log(`   Total contacts available: ${allListRecipients.length}\n`);

    // Step 3: Extract ALL REMAINING users (skip first 2,000)
    console.log('Step 3: Extracting ALL REMAINING users (2,001+)...');
    const round3Recipients = allListRecipients.slice(2000);

    console.log(`   ✅ Extracted ${round3Recipients.length} contacts for Round 3`);
    console.log(`   First Contact ID: ${round3Recipients[0].ContactID}`);
    console.log(`   Last Contact ID: ${round3Recipients[round3Recipients.length - 1].ContactID}\n`);

    // Step 4: Get full contact details with email addresses
    console.log('Step 4: Fetching email addresses for all contacts...');
    console.log(`   ⚠️  This will take ~${Math.ceil(round3Recipients.length * 0.05 / 60)} minutes due to rate limiting\n`);

    const contactIds = round3Recipients.map(r => r.ContactID);
    const contactsWithEmails = await getContactDetails(contactIds);

    console.log(`   ✅ Retrieved ${contactsWithEmails.length} email addresses\n`);

    // Step 5: Add contacts to existing list
    console.log('Step 5: Adding contacts to campaign_batch_003 list...');
    await addContactsToList(TARGET_LIST_ID, contactsWithEmails);

    // Step 6: Summary
    console.log('\n✅ ROUND 3 LIST UPLOAD COMPLETED!');
    console.log('='.repeat(80));
    console.log(`📋 List Name: campaign_batch_003`);
    console.log(`🆔 List ID: ${TARGET_LIST_ID}`);
    console.log(`👥 Total Contacts: ${contactsWithEmails.length}`);
    console.log(`📊 Contact Range: Users 2,001 to ${allListRecipients.length} (by registration order)`);
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Wait 1-2 minutes for MailJet to process the upload`);
    console.log(`2. Run: node scripts/verify-round3-list.js`);
    console.log(`3. Create Round 3 campaign in MailJet with List ID: ${TARGET_LIST_ID}`);
    console.log(`\n🎉 This completes the entire user base (${allListRecipients.length} total users)!`);

    return {
      listId: TARGET_LIST_ID,
      listName: 'campaign_batch_003',
      contactCount: contactsWithEmails.length,
      totalUsers: allListRecipients.length
    };

  } catch (error) {
    console.error('\n❌ FAILED TO CREATE ROUND 3 LIST');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createRound3List()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createRound3List };
