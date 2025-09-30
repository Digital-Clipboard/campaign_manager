#!/usr/bin/env node

/**
 * Create Round 2 Contact List in MailJet
 * Purpose: Extract users 1,001-2,000 from master "users" list and create campaign_batch_002
 *
 * Strategy:
 * 1. Fetch ALL contacts from master "users" list (ID: 5776) - 3,529 total
 * 2. Sort by Contact ID (which represents registration order)
 * 3. Skip first 1,000 (these are in campaign_batch_001)
 * 4. Take next 1,000 (users 1,001-2,000)
 * 5. Create new list "campaign_batch_002"
 * 6. Add these 1,000 contacts to the new list
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
 * Fetch ALL contacts from a list (paginated)
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

      // If we got fewer contacts than the limit, we've reached the end
      if (contacts.length < limit) {
        break;
      }

      offset += limit;
      // Small delay to respect API rate limits
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
 * Create a new contact list in MailJet
 */
async function createContactList(name) {
  console.log(`📝 Creating new contact list: "${name}"...`);

  try {
    const response = await axios.post(
      'https://api.mailjet.com/v3/REST/contactslist',
      { Name: name },
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const list = response.data.Data[0];
    console.log(`✅ List created successfully!`);
    console.log(`   List ID: ${list.ID}`);
    console.log(`   Name: ${list.Name}\n`);

    return list;

  } catch (error) {
    console.error('❌ Error creating list:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add contacts to a list in batches
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
            Contacts: batch.map(c => ({ ContactID: c.ContactID }))
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
 * Main function to create Round 2 list
 */
async function createRound2List() {
  console.log('🚀 Creating Round 2 Contact List (campaign_batch_002)');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log(`🎯 Goal: Extract users 1,001-2,000 from master list\n`);

  try {
    // Step 1: Fetch all contacts from master "users" list
    const MASTER_LIST_ID = 5776;
    console.log('Step 1: Fetching contacts from master "users" list...');
    const allContacts = await getAllContactsFromList(MASTER_LIST_ID);

    if (allContacts.length < 2000) {
      console.error(`❌ ERROR: Not enough contacts in master list!`);
      console.error(`   Expected: At least 2,000 contacts`);
      console.error(`   Found: ${allContacts.length} contacts`);
      console.error(`   Cannot create Round 2 list.`);
      return;
    }

    // Step 2: Sort by Contact ID (represents registration order - FIFO)
    console.log('Step 2: Sorting contacts by Contact ID (FIFO order)...');
    allContacts.sort((a, b) => a.ContactID - b.ContactID);

    console.log(`   Earliest Contact ID: ${allContacts[0].ContactID}`);
    console.log(`   Latest Contact ID: ${allContacts[allContacts.length - 1].ContactID}`);
    console.log(`   Total contacts available: ${allContacts.length}\n`);

    // Step 3: Extract users 1,001-2,000 (skip first 1,000)
    console.log('Step 3: Extracting users 1,001-2,000...');
    const round2Contacts = allContacts.slice(1000, 2000);

    console.log(`   ✅ Extracted ${round2Contacts.length} contacts for Round 2`);
    console.log(`   First Contact ID: ${round2Contacts[0].ContactID}`);
    console.log(`   Last Contact ID: ${round2Contacts[round2Contacts.length - 1].ContactID}\n`);

    // Step 4: Create new list
    console.log('Step 4: Creating new contact list...');
    const newList = await createContactList('campaign_batch_002');

    // Step 5: Add contacts to new list
    console.log('Step 5: Adding contacts to new list...');
    await addContactsToList(newList.ID, round2Contacts);

    // Step 6: Summary
    console.log('\n✅ ROUND 2 LIST CREATED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`📋 List Name: campaign_batch_002`);
    console.log(`🆔 List ID: ${newList.ID}`);
    console.log(`👥 Expected Contacts: 1,000`);
    console.log(`📊 Contact Range: Users 1,001 to 2,000 (by registration order)`);
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Wait 1-2 minutes for MailJet to process the upload`);
    console.log(`2. Verify list count in MailJet dashboard`);
    console.log(`3. Update Campaign Manager with List ID: ${newList.ID}`);
    console.log(`4. Test campaign notification before 9:15 AM launch`);
    console.log(`\n🚀 Ready for campaign launch!`);

    return {
      listId: newList.ID,
      listName: newList.Name,
      contactCount: round2Contacts.length
    };

  } catch (error) {
    console.error('\n❌ FAILED TO CREATE ROUND 2 LIST');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createRound2List()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createRound2List, getAllContactsFromList, createContactList, addContactsToList };