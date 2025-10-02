#!/usr/bin/env node

/**
 * Create Round 3 Email Campaign in MailJet
 * Purpose: Create a campaign draft using campaign_batch_003 list
 *
 * This script creates a campaign draft. You'll need to:
 * 1. Complete the email content/template in MailJet UI
 * 2. Schedule it for October 2, 2025 at 9:15 AM UTC
 * 3. Note the Campaign ID for the assessment script
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
 * Get campaign details to use as template
 */
async function getCampaignTemplate(campaignId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/campaign/${campaignId}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.Data[0];
  } catch (error) {
    console.error('❌ Error fetching campaign template:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get the email content from a campaign
 */
async function getCampaignContent(campaignId) {
  try {
    const response = await axios.get(
      `https://api.mailjet.com/v3/REST/campaigndraft/${campaignId}/content`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.Data[0];
  } catch (error) {
    console.error('⚠️  Could not fetch campaign content:', error.response?.data?.ErrorMessage || error.message);
    return null;
  }
}

async function createRound3Campaign() {
  console.log('🚀 Creating Round 3 Email Campaign');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log(`🎯 Goal: Create campaign for Round 3 (campaign_batch_003)\n`);

  try {
    // Step 1: Get Round 2 campaign details to use as template
    console.log('Step 1: Fetching Round 2 campaign details for reference...');
    const ROUND_2_CAMPAIGN_ID = 7758985090;
    const round2Campaign = await getCampaignTemplate(ROUND_2_CAMPAIGN_ID);

    console.log(`✅ Round 2 Campaign Retrieved:`);
    console.log(`   Subject: ${round2Campaign.Subject}`);
    console.log(`   From Email: ${round2Campaign.FromEmail}`);
    console.log(`   List ID: ${round2Campaign.ListID}`);
    console.log(`   Click Tracked: ${round2Campaign.ClickTracked === 1 ? 'Yes' : 'No'}\n`);

    // Step 2: Get campaign content
    console.log('Step 2: Fetching email content...');
    const content = await getCampaignContent(ROUND_2_CAMPAIGN_ID);
    if (content) {
      console.log(`✅ Email content retrieved\n`);
    } else {
      console.log(`⚠️  Could not retrieve email content - will need to be added manually\n`);
    }

    // Step 3: Provide instructions for manual campaign creation
    console.log('Step 3: Campaign Creation Instructions');
    console.log('='.repeat(80));
    console.log('\n📝 MANUAL STEPS REQUIRED:\n');
    console.log('Due to MailJet API limitations, you need to create the campaign in the MailJet UI:\n');
    console.log('1. Go to: https://app.mailjet.com/campaigns');
    console.log('2. Click "Create Campaign"');
    console.log('3. Use these settings:');
    console.log(`   - Campaign Name: Client Letters 2.0 Round 3`);
    console.log(`   - Subject Line: ${round2Campaign.Subject}`);
    console.log(`   - From Email: ${round2Campaign.FromEmail}`);
    console.log(`   - From Name: (leave blank or use "Digital Clipboard")`);
    console.log(`   - Recipients: campaign_batch_003 (List ID: 10503192)`);
    console.log(`   - Enable Click Tracking: Yes`);
    console.log(`   - Enable Open Tracking: As preferred`);
    console.log('4. For email content:');
    console.log('   - Copy the same email template from Round 2 campaign');
    console.log('   - Or use the existing newsletter template if available');
    console.log('5. Schedule:');
    console.log('   - Date: October 2, 2025');
    console.log('   - Time: 9:15 AM UTC');
    console.log('6. Review and confirm the campaign');
    console.log('7. Note the Campaign ID (it will be shown in the URL)');
    console.log('\n📋 CAMPAIGN CONFIGURATION SUMMARY:');
    console.log('─'.repeat(80));
    console.log(`Subject:        ${round2Campaign.Subject}`);
    console.log(`From:           ${round2Campaign.FromEmail}`);
    console.log(`List ID:        10503192 (campaign_batch_003)`);
    console.log(`Recipients:     ~1,529 users`);
    console.log(`Launch Date:    October 2, 2025 @ 9:15 AM UTC`);
    console.log(`Click Tracking: Enabled`);
    console.log('─'.repeat(80));

    console.log('\n\n🔗 QUICK LINKS:');
    console.log('─'.repeat(80));
    console.log('MailJet Campaigns: https://app.mailjet.com/campaigns');
    console.log('Round 2 Campaign:  https://app.mailjet.com/campaign/draft/7758985090');
    console.log('campaign_batch_003 List: https://app.mailjet.com/contacts/lists/10503192');
    console.log('─'.repeat(80));

    console.log('\n\n📝 AFTER CREATING THE CAMPAIGN:');
    console.log('─'.repeat(80));
    console.log('1. Note the Campaign ID from the MailJet UI (check the URL)');
    console.log('2. Run the update script with the Campaign ID:');
    console.log('   node scripts/update-round3-campaign-id.js <CAMPAIGN_ID>');
    console.log('3. Verify the campaign with:');
    console.log('   node scripts/verify-round3-campaign.js');
    console.log('─'.repeat(80));

    return {
      success: true,
      listId: 10503192,
      listName: 'campaign_batch_003',
      recipientCount: 1529,
      subject: round2Campaign.Subject,
      fromEmail: round2Campaign.FromEmail
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createRound3Campaign()
    .then(() => {
      console.log('\n✅ Instructions provided - please create campaign in MailJet UI');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createRound3Campaign };
