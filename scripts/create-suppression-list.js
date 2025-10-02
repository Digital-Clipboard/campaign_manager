#!/usr/bin/env node

/**
 * Create Suppression List in Mailjet
 * Purpose: Set up a dedicated suppression list for bounced/invalid contacts
 *
 * This script:
 * 1. Creates a new contact list named "suppressed_contacts"
 * 2. Verifies the list was created successfully
 * 3. Provides the List ID for use in other scripts
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
 * Check if suppression list already exists
 */
async function checkExistingList(listName) {
  try {
    const response = await axios.get(
      'https://api.mailjet.com/v3/REST/contactslist',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          Name: listName,
          Limit: 1
        }
      }
    );

    if (response.data.Data && response.data.Data.length > 0) {
      return response.data.Data[0];
    }

    return null;
  } catch (error) {
    console.error('   ❌ Error checking for existing list:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Create suppression list
 */
async function createSuppressionList(listName) {
  console.log(`📝 Creating suppression list: "${listName}"...`);

  try {
    const response = await axios.post(
      'https://api.mailjet.com/v3/REST/contactslist',
      { Name: listName },
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const list = response.data.Data[0];
    console.log(`   ✅ List created successfully!`);
    console.log(`   List ID: ${list.ID}`);
    console.log(`   Name: ${list.Name}`);
    console.log(`   Address: ${list.Address || 'Not set'}`);

    return list;

  } catch (error) {
    console.error('   ❌ Error creating list:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get list details and statistics
 */
async function getListDetails(listId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/contactslist/${listId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.Data[0] || null;
  } catch (error) {
    console.error('   ❌ Error fetching list details:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main function
 */
async function setupSuppressionList() {
  console.log('🚀 Setting Up Suppression List');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  const SUPPRESSION_LIST_NAME = 'suppressed_contacts';

  try {
    // Step 1: Check if list already exists
    console.log('Step 1: Checking for existing suppression list...');
    const existing = await checkExistingList(SUPPRESSION_LIST_NAME);

    if (existing) {
      console.log(`   ⚠️  List "${SUPPRESSION_LIST_NAME}" already exists!`);
      console.log(`   List ID: ${existing.ID}`);
      console.log(`   Subscriber Count: ${existing.SubscriberCount || 0}`);
      console.log(`\n   Using existing list instead of creating new one.\n`);

      const details = await getListDetails(existing.ID);

      console.log('✅ SUPPRESSION LIST READY');
      console.log('='.repeat(80));
      console.log(`📋 List Name: ${details.Name}`);
      console.log(`🆔 List ID: ${details.ID}`);
      console.log(`👥 Current Contacts: ${details.SubscriberCount || 0}`);
      console.log(`📅 Created: ${new Date(details.CreatedAt).toLocaleString()}`);

      return {
        listId: details.ID,
        listName: details.Name,
        existing: true,
        subscriberCount: details.SubscriberCount || 0
      };
    }

    // Step 2: Create new suppression list
    console.log('   ✓ No existing list found\n');
    console.log('Step 2: Creating new suppression list...');
    const newList = await createSuppressionList(SUPPRESSION_LIST_NAME);

    // Step 3: Verify creation
    console.log('\nStep 3: Verifying list creation...');
    const details = await getListDetails(newList.ID);

    if (details) {
      console.log('   ✅ List verified successfully');
    } else {
      console.log('   ⚠️  Could not verify list, but creation succeeded');
    }

    // Summary
    console.log('\n✅ SUPPRESSION LIST CREATED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`📋 List Name: ${newList.Name}`);
    console.log(`🆔 List ID: ${newList.ID}`);
    console.log(`👥 Initial Contacts: 0`);

    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Save List ID to environment variables or config:`);
    console.log(`   MAILJET_SUPPRESSION_LIST_ID=${newList.ID}`);
    console.log(`2. Run bounce analysis script to identify contacts to suppress`);
    console.log(`3. Run cleanup script to add bounced contacts to this list`);
    console.log(`4. Update batch creation scripts to exclude contacts on this list`);

    console.log(`\n💡 USAGE:`);
    console.log(`   - Add contacts to this list when they hard bounce`);
    console.log(`   - Add contacts after 3-5 consecutive soft bounces`);
    console.log(`   - Exclude contacts on this list from all future campaigns`);
    console.log(`   - Never send marketing emails to contacts on this list`);

    return {
      listId: newList.ID,
      listName: newList.Name,
      existing: false,
      subscriberCount: 0
    };

  } catch (error) {
    console.error('\n❌ FAILED TO SET UP SUPPRESSION LIST');
    console.error('Error:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  setupSuppressionList()
    .then((result) => {
      console.log('\n✅ Script completed successfully');
      console.log(`\n🎯 Suppression List ID: ${result.listId}`);
      console.log(`   (Save this ID for use in other scripts)`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { setupSuppressionList, checkExistingList, createSuppressionList };
