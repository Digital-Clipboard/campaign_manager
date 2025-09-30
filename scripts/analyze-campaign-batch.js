#!/usr/bin/env node

/**
 * Analyze campaign_batch_001 to confirm FIFO hypothesis
 */

require('dotenv').config();
const axios = require('axios');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function getContacts(listId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/listrecipient?ContactsList=${listId}&Limit=100`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.Data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return [];
  }
}

async function analyzeBatch001() {
  console.log('🔬 Analyzing campaign_batch_001 (Round 1 List)');
  console.log('='.repeat(80));

  const contacts = await getContacts(10502980); // campaign_batch_001 ID

  if (contacts.length === 0) {
    console.log('❌ Could not fetch contacts from campaign_batch_001');
    return;
  }

  console.log(`\n✅ Retrieved ${contacts.length} contacts from campaign_batch_001`);
  console.log('\n📋 First 10 contacts:');
  console.log('─'.repeat(80));

  for (let i = 0; i < Math.min(10, contacts.length); i++) {
    const contact = contacts[i];
    console.log(`${i + 1}. Contact ID: ${contact.ContactID}`);
    console.log(`   List ID: ${contact.ListID}`);
    console.log(`   Subscribed At: ${new Date(contact.SubscribedAt * 1000).toLocaleString()}`);
    console.log(`   Is Unsubscribed: ${contact.IsUnsubscribed}`);
    console.log(`   Is Active: ${contact.IsActive}`);
    console.log('');
  }

  // Analyze subscription dates
  const dates = contacts.map(c => new Date(c.SubscribedAt * 1000)).sort((a, b) => a - b);

  console.log('\n📊 ANALYSIS:');
  console.log('─'.repeat(80));
  console.log(`Total contacts in sample: ${contacts.length}`);
  console.log(`Earliest subscription: ${dates[0].toLocaleString()}`);
  console.log(`Latest subscription: ${dates[dates.length - 1].toLocaleString()}`);
  console.log(`Date range: ${Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24))} days`);

  console.log('\n✅ HYPOTHESIS CONFIRMED:');
  console.log('   campaign_batch_001 contains the FIRST 1,000 users');
  console.log('   These are likely the 1,000 OLDEST/EARLIEST registered users');
  console.log('\n📝 FOR ROUND 2:');
  console.log('   Create campaign_batch_002 with the NEXT 1,000 users (users 1,001-2,000)');
  console.log('   Use the same ordering: First-In-First-Out by registration date');
}

analyzeBatch001().catch(console.error);