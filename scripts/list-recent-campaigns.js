#!/usr/bin/env node

/**
 * List Recent Campaigns
 * Purpose: Show all recent campaigns to find the right Campaign IDs
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
 * Get recent campaigns
 */
async function getRecentCampaigns(limit = 20) {
  try {
    const response = await axios.get(
      'https://api.mailjet.com/v3/REST/campaign',
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        },
        params: {
          Limit: limit,
          Sort: 'CreatedAt DESC'
        }
      }
    );

    return response.data.Data || [];

  } catch (error) {
    console.error('❌ Error fetching campaigns:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get campaign statistics
 */
async function getCampaignStats(campaignId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/campaignstatistics/${campaignId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.Data[0] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Main function
 */
async function listCampaigns() {
  console.log('📨 RECENT CAMPAIGNS');
  console.log('='.repeat(80));
  console.log();

  const campaigns = await getRecentCampaigns(20);

  if (campaigns.length === 0) {
    console.log('⚠️  No campaigns found');
    return;
  }

  console.log(`Found ${campaigns.length} recent campaign(s):\n`);

  for (const campaign of campaigns) {
    const status = campaign.Status === 0 ? 'Draft' :
                   campaign.Status === 1 ? '✅ Sent' :
                   campaign.Status === 2 ? '📅 Scheduled' : 'Unknown';

    console.log(`Campaign ID: ${campaign.ID}`);
    console.log(`   Subject: ${campaign.Subject || 'No subject'}`);
    console.log(`   Status: ${status}`);
    console.log(`   Created: ${campaign.CreatedAt ? new Date(campaign.CreatedAt).toLocaleString() : 'Unknown'}`);

    if (campaign.SendStartAt) {
      console.log(`   Sent: ${new Date(campaign.SendStartAt).toLocaleString()}`);
    }

    if (campaign.NewsLetterSentSize) {
      console.log(`   Recipients: ${campaign.NewsLetterSentSize}`);
    }

    // Try to get stats
    if (campaign.Status === 1) {
      const stats = await getCampaignStats(campaign.ID);
      if (stats) {
        console.log(`   📊 Stats:`);
        console.log(`      Sent: ${stats.MessageSentCount || 0}`);
        console.log(`      Delivered: ${stats.MessageDeliveredCount || 0}`);
        console.log(`      Bounced: ${stats.MessageHardBouncedCount + stats.MessageSoftBouncedCount || 0} (Hard: ${stats.MessageHardBouncedCount || 0}, Soft: ${stats.MessageSoftBouncedCount || 0})`);
        console.log(`      Opened: ${stats.MessageOpenedCount || 0}`);
        console.log(`      Clicked: ${stats.MessageClickedCount || 0}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('📝 TO RUN BOUNCE CLEANUP:');
  console.log('   node scripts/simple-bounce-cleanup.js --campaign-id=<ID>');
  console.log();
  console.log('💡 TIP: Look for campaigns with "Client Letter" in subject and ~1000 recipients');
  console.log();
}

// Run
if (require.main === module) {
  listCampaigns()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { getRecentCampaigns };
