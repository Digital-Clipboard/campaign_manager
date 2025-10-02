#!/usr/bin/env node

/**
 * Send Round 3 Campaign
 * Run this script when you're ready to send Round 3 to 1,529 users
 *
 * Usage: node scripts/send-round3-campaign.js
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const CAMPAIGN_DRAFT_ID = 14121745; // Round 3 campaign draft

if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
  console.error('❌ Missing MailJet credentials');
  process.exit(1);
}

const mailjetAuth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function sendCampaign() {
  console.log('🚀 Round 3 Campaign Send Script');
  console.log('='.repeat(80));
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
  console.log('');

  try {
    // Get campaign details
    console.log('📋 Fetching campaign details...\n');
    const draftResponse = await axios.get(
      `https://api.mailjet.com/v3/REST/campaigndraft/${CAMPAIGN_DRAFT_ID}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const draft = draftResponse.data.Data[0];

    console.log('CAMPAIGN DETAILS:');
    console.log('─'.repeat(80));
    console.log(`Campaign Draft ID: ${draft.ID}`);
    console.log(`Title: ${draft.Title}`);
    console.log(`Subject: ${draft.Subject}`);
    console.log(`From: ${draft.Sender} <${draft.SenderEmail}>`);
    console.log(`List ID: ${draft.ContactsListID} (campaign_batch_003)`);
    console.log(`Status: ${draft.Status === 0 ? 'DRAFT (Ready to send)' : 'Status: ' + draft.Status}`);
    console.log('─'.repeat(80));

    // Get list count
    const listResponse = await axios.get(
      `https://api.mailjet.com/v3/REST/contactslist/${draft.ContactsListID}`,
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const recipientCount = listResponse.data.Data[0].SubscriberCount;

    console.log('');
    console.log('⚠️  YOU ARE ABOUT TO SEND:');
    console.log(`   📧 ${recipientCount} emails`);
    console.log(`   📝 Subject: "${draft.Subject}"`);
    console.log(`   📋 To list: campaign_batch_003 (Users 2,001-3,529)`);
    console.log('');

    if (draft.Status !== 0) {
      console.error('❌ ERROR: Campaign is not in DRAFT status (Status:', draft.Status + ')');
      console.error('   Cannot send. Campaign may have already been sent.');
      rl.close();
      process.exit(1);
    }

    // Ask for confirmation
    const confirmed = await askConfirmation('Type "yes" to confirm sending NOW: ');

    if (!confirmed) {
      console.log('\n❌ Send cancelled by user');
      rl.close();
      process.exit(0);
    }

    console.log('\n📤 Sending campaign NOW...');

    // Send immediately (no date override = immediate send)
    const sendResponse = await axios.post(
      `https://api.mailjet.com/v3/REST/campaigndraft/${CAMPAIGN_DRAFT_ID}/send`,
      {},
      {
        headers: {
          'Authorization': `Basic ${mailjetAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ CAMPAIGN SENT!');
    console.log('='.repeat(80));
    console.log('Status:', sendResponse.data.Data[0].Status);
    console.log('');
    console.log('📊 The campaign is now processing and sending.');
    console.log('🕐 Check campaign statistics in 5-10 minutes.');
    console.log('');
    console.log('To check status:');
    console.log('  node scripts/check-round3-status.js');
    console.log('');
    console.log('Campaign will be available for post-launch assessment once complete.');
    console.log('='.repeat(80));

    rl.close();

  } catch (error) {
    console.error('\n❌ Error sending campaign:', error.response?.data || error.message);
    rl.close();
    process.exit(1);
  }
}

// Run the script
sendCampaign();
