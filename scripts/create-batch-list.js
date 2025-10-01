#!/usr/bin/env node

/**
 * Create Campaign Batch List with Suppression List Filtering
 * Purpose: Extract contacts from master list while excluding suppressed contacts
 *
 * This is a generic batch creation script that:
 * 1. Fetches all contacts from master "users" list
 * 2. Fetches all suppressed contacts from database
 * 3. Filters out suppressed contacts
 * 4. Sorts by Contact ID (FIFO)
 * 5. Extracts the specified range
 * 6. Creates new batch list in Mailjet
 *
 * Usage:
 *   node create-batch-list.js --round=4 --size=1000
 *   node create-batch-list.js --round=4 --offset=3000 --size=500
 */

require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
const prisma = new PrismaClient();

/**
 * Fetch ALL contacts from a list (paginated)
 */
async function getAllContactsFromList(listId) {
  console.log(`📥 Fetching all contacts from list ${listId}...`);

  let allContacts = [];
  let offset = 0;
  const limit = 1000;

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
 * Fetch all suppressed contacts from database
 */
async function getSuppressedContacts() {
  console.log('🚫 Fetching suppressed contacts from database...');

  try {
    const suppressed = await prisma.suppressedContact.findMany({
      where: {
        status: 'active' // Only active suppressions
      },
      select: {
        contactId: true,
        email: true,
        suppressionType: true
      }
    });

    const suppressedIds = new Set(suppressed.map(c => Number(c.contactId)));
    console.log(`   ✅ Found ${suppressedIds.size} suppressed contacts\n`);

    return suppressedIds;

  } catch (error) {
    console.error('   ⚠️  Database error, proceeding without suppression filtering:', error.message);
    return new Set(); // Return empty set if database unavailable
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

  const batchSize = 100;
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
            Action: 'addnoforce',
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
 * Main function to create batch list
 */
async function createBatchList(roundNumber, batchSize = 1000, startOffset = null) {
  console.log('🚀 Creating Campaign Batch List with Suppression Filtering');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log(`🎯 Round: ${roundNumber}`);
  console.log(`📊 Batch Size: ${batchSize}`);

  // Calculate offset based on round number if not explicitly provided
  const offset = startOffset !== null ? startOffset : (roundNumber - 1) * batchSize;
  console.log(`📍 Starting Offset: ${offset}\n`);

  try {
    // Step 1: Fetch all contacts from master "users" list
    const MASTER_LIST_ID = 5776;
    console.log('Step 1: Fetching contacts from master "users" list...');
    const allContacts = await getAllContactsFromList(MASTER_LIST_ID);

    // Step 2: Fetch suppressed contacts
    console.log('Step 2: Fetching suppressed contacts...');
    const suppressedIds = await getSuppressedContacts();

    // Step 3: Filter out suppressed contacts
    console.log('Step 3: Filtering out suppressed contacts...');
    const validContacts = allContacts.filter(c => !suppressedIds.has(c.ContactID));

    const removedCount = allContacts.length - validContacts.length;
    console.log(`   ✅ Filtered ${removedCount} suppressed contacts`);
    console.log(`   ✅ ${validContacts.length} valid contacts remaining\n`);

    // Step 4: Sort by Contact ID (FIFO)
    console.log('Step 4: Sorting contacts by Contact ID (FIFO order)...');
    validContacts.sort((a, b) => a.ContactID - b.ContactID);

    console.log(`   Earliest Contact ID: ${validContacts[0].ContactID}`);
    console.log(`   Latest Contact ID: ${validContacts[validContacts.length - 1].ContactID}`);
    console.log(`   Total valid contacts: ${validContacts.length}\n`);

    // Step 5: Extract specified range
    console.log(`Step 5: Extracting contacts ${offset + 1} to ${offset + batchSize}...`);

    if (validContacts.length < offset + batchSize) {
      const availableCount = Math.max(0, validContacts.length - offset);
      console.log(`   ⚠️  Only ${availableCount} contacts available from offset ${offset}`);
      console.log(`   Adjusting batch size to ${availableCount}`);
    }

    const batchContacts = validContacts.slice(offset, offset + batchSize);

    if (batchContacts.length === 0) {
      console.error(`❌ ERROR: No contacts available in the specified range`);
      console.error(`   Offset: ${offset}`);
      console.error(`   Available contacts: ${validContacts.length}`);
      await prisma.$disconnect();
      return;
    }

    console.log(`   ✅ Extracted ${batchContacts.length} contacts for Round ${roundNumber}`);
    console.log(`   First Contact ID: ${batchContacts[0].ContactID}`);
    console.log(`   Last Contact ID: ${batchContacts[batchContacts.length - 1].ContactID}\n`);

    // Step 6: Create new list
    const listName = `campaign_batch_${String(roundNumber).padStart(3, '0')}`;
    console.log('Step 6: Creating new contact list...');
    const newList = await createContactList(listName);

    // Step 7: Add contacts to new list
    console.log('Step 7: Adding contacts to new list...');
    await addContactsToList(newList.ID, batchContacts);

    // Step 8: Summary
    console.log('\n✅ BATCH LIST CREATED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`📋 List Name: ${listName}`);
    console.log(`🆔 List ID: ${newList.ID}`);
    console.log(`👥 Contacts Added: ${batchContacts.length}`);
    console.log(`🚫 Suppressed Contacts Excluded: ${removedCount}`);
    console.log(`📊 Contact Range: ${offset + 1} to ${offset + batchContacts.length} (by registration order)`);
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Wait 1-2 minutes for MailJet to process the upload`);
    console.log(`2. Verify list count in MailJet dashboard`);
    console.log(`3. Update Campaign Manager with List ID: ${newList.ID}`);
    console.log(`4. Configure campaign schedule for Round ${roundNumber}`);

    await prisma.$disconnect();

    return {
      listId: newList.ID,
      listName: listName,
      contactCount: batchContacts.length,
      suppressedCount: removedCount,
      round: roundNumber
    };

  } catch (error) {
    console.error('\n❌ FAILED TO CREATE BATCH LIST');
    console.error('Error:', error.message);
    await prisma.$disconnect();
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const roundArg = args.find(arg => arg.startsWith('--round='));
const sizeArg = args.find(arg => arg.startsWith('--size='));
const offsetArg = args.find(arg => arg.startsWith('--offset='));

if (!roundArg) {
  console.error('❌ Usage: node create-batch-list.js --round=<number> [--size=<number>] [--offset=<number>]');
  console.error('\nExamples:');
  console.error('  node create-batch-list.js --round=4 --size=1000');
  console.error('  node create-batch-list.js --round=5 --size=500');
  console.error('  node create-batch-list.js --round=4 --offset=3000 --size=1000');
  process.exit(1);
}

const roundNumber = parseInt(roundArg.split('=')[1]);
const batchSize = sizeArg ? parseInt(sizeArg.split('=')[1]) : 1000;
const startOffset = offsetArg ? parseInt(offsetArg.split('=')[1]) : null;

// Run the script
if (require.main === module) {
  createBatchList(roundNumber, batchSize, startOffset)
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  createBatchList,
  getAllContactsFromList,
  getSuppressedContacts,
  createContactList,
  addContactsToList
};
