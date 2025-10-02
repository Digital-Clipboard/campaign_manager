#!/usr/bin/env node

/**
 * Find Campaign IDs for Batch Lists
 * Purpose: Query Mailjet to find which campaigns were sent to specific batch lists
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

const BATCH_LISTS = [
  { id: 10502980, name: 'campaign_batch_001', round: 1 },
  { id: 10503118, name: 'campaign_batch_002', round: 2 },
  { id: 10503192, name: 'campaign_batch_003', round: 3 }
];

/**
 * Get campaigns for a contact list
 */
async function getCampaignsForList(listId, listName) {
  try {
    const response = await axios.get(
      'https://api.mailjet.com/v3/REST/campaign',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          ContactsList: listId,
          Limit: 50,
          Sort: 'CreatedAt DESC'
        }
      }
    );

    const campaigns = response.data.Data || [];

    console.log(`\n📋 ${listName} (List ID: ${listId})`);
    console.log('─'.repeat(70));

    if (campaigns.length === 0) {
      console.log('   ⚠️  No campaigns found for this list');
      return [];
    }

    campaigns.forEach((campaign, index) => {
      const status = campaign.Status === 0 ? 'Draft' :
                     campaign.Status === 1 ? 'Sent' :
                     campaign.Status === 2 ? 'Scheduled' : 'Unknown';

      console.log(`   ${index + 1}. Campaign ID: ${campaign.ID}`);
      console.log(`      Name: ${campaign.Subject || 'No subject'}`);
      console.log(`      Status: ${status}`);
      console.log(`      Send Date: ${campaign.SendStartAt || 'Not sent'}`);
      console.log(`      Sent Count: ${campaign.NewsLetterSentSize || 0}`);
      console.log();
    });

    return campaigns;

  } catch (error) {
    console.error(`   ❌ Error fetching campaigns:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Main function
 */
async function findCampaignIds() {
  console.log('🔍 FINDING CAMPAIGN IDs FOR BATCH LISTS');
  console.log('='.repeat(70));

  const allCampaigns = {};

  for (const batch of BATCH_LISTS) {
    const campaigns = await getCampaignsForList(batch.id, batch.name);
    allCampaigns[batch.name] = campaigns;
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  for (const [batchName, campaigns] of Object.entries(allCampaigns)) {
    if (campaigns.length > 0) {
      const sentCampaigns = campaigns.filter(c => c.Status === 1);
      console.log(`\n${batchName}:`);
      if (sentCampaigns.length > 0) {
        sentCampaigns.forEach(c => {
          console.log(`   ✅ Campaign ID ${c.ID} - "${c.Subject}" (Sent: ${c.SendStartAt})`);
        });
      } else {
        console.log(`   ⚠️  No sent campaigns found`);
      }
    }
  }

  console.log('\n📝 NEXT STEPS:');
  console.log('   Run cleanup for each sent campaign:');
  console.log('   node scripts/simple-bounce-cleanup.js --campaign-id=<ID>');
  console.log();
}

// Run
if (require.main === module) {
  findCampaignIds()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { getCampaignsForList };
