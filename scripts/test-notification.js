#!/usr/bin/env node

/**
 * Test Campaign Notification Script
 *
 * This script sends a test notification to verify the Slack integration
 * Run with: node scripts/test-notification.js [type]
 *
 * Types: preparation, pre-launch, countdown, post-launch
 */

require('dotenv').config();

const SLACK_MANAGER_URL = process.env.SLACK_MANAGER_URL || 'https://slack-manager-dd799df0638b.herokuapp.com';
const SLACK_MANAGER_API_TOKEN = process.env.SLACK_MANAGER_API_TOKEN || '0F-ExcH_YGy5aZFTydud_mrzpP8iRx5yJyWlowht9Oo';

async function sendTestNotification(type = 'preparation') {
  console.log('🚀 Testing Campaign Notification System');
  console.log(`Type: ${type}`);
  console.log(`URL: ${SLACK_MANAGER_URL}`);
  console.log(`Token: ${SLACK_MANAGER_API_TOKEN ? 'Configured' : 'Missing'}`);
  console.log('-----------------------------------\n');

  // Create notification content based on type
  let text = '';
  let blocks = [];

  switch (type) {
    case 'preparation':
      text = '[TEST] Campaign scheduled: Client Letter Round 2 - Tomorrow at 10:00 AM';
      blocks = [
        { type: 'divider' },
        {
          type: 'header',
          text: { type: 'plain_text', text: '🧪 TEST: CAMPAIGN NOTIFICATION' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Client Letter Automation - Round 2*\n\n' +
                  '*STATUS:* Scheduled\n' +
                  '*TARGET:* 1,000 recipients\n' +
                  '*SEGMENT:* Users 1,001-2,000\n' +
                  '*EXECUTION:* Tomorrow at 10:00 AM'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Pre-flight Checklist:*\n' +
                  '○ Email template verified\n' +
                  '○ Recipient list validated\n' +
                  '○ MailJet API connected\n' +
                  '○ Monitoring dashboard ready'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_This is a test notification - No actual campaign will be sent_'
            }
          ]
        },
        { type: 'divider' }
      ];
      break;

    case 'pre-launch':
      text = '[TEST] Campaign preparation: Round 2 - Launching at 10:00 AM';
      blocks = [
        { type: 'divider' },
        {
          type: 'header',
          text: { type: 'plain_text', text: '🧪 TEST: CAMPAIGN PREPARATION' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Client Letter Automation - Round 2*\n' +
                  '*T-3 Hours until execution*\n\n' +
                  '*System Checks:*\n' +
                  '✓ MailJet API: Connected\n' +
                  '✓ Email Template: Loaded\n' +
                  '✓ Recipient List: 1,000 contacts ready\n' +
                  '✓ Rate Limiting: Configured\n' +
                  '✓ Error Handling: Active'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_This is a test notification - No actual campaign will be sent_'
            }
          ]
        },
        { type: 'divider' }
      ];
      break;

    case 'countdown':
      text = '[TEST] Campaign launching in 15 minutes: Round 2';
      blocks = [
        { type: 'divider' },
        {
          type: 'header',
          text: { type: 'plain_text', text: '🧪 TEST: LAUNCH IMMINENT' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Client Letter Automation - Round 2*\n' +
                  '*Launching in 15 minutes*\n\n' +
                  '*Recipients:* 1,000\n' +
                  '*Segment:* Users 1,001-2,000\n' +
                  '*Launch Time:* 10:00 AM\n' +
                  '*Status:* ● Armed'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_This is a test notification - No actual campaign will be sent_'
            }
          ]
        },
        { type: 'divider' }
      ];
      break;

    case 'post-launch':
      text = '[TEST] Campaign in progress: Round 2 - 15% complete';
      blocks = [
        { type: 'divider' },
        {
          type: 'header',
          text: { type: 'plain_text', text: '🧪 TEST: EXECUTION IN PROGRESS' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Client Letter Automation - Round 2*\n\n' +
                  '● *SENDING...*\n\n' +
                  '*Progress:* ██░░░░░░░░ 15%\n' +
                  '*Sent:* 150 / 1,000\n' +
                  '*Time Elapsed:* 10 minutes\n' +
                  '*Est. Completion:* 45 minutes\n\n' +
                  '*Real-time Metrics:*\n' +
                  '✓ Accepted: 140\n' +
                  '✗ Bounced: 10\n' +
                  '● Queue Status: Active'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_This is a test notification - No actual campaign will be sent_'
            }
          ]
        },
        { type: 'divider' }
      ];
      break;
  }

  try {
    console.log('Sending notification to #_traction...');

    // First get the channel ID
    const channelResponse = await fetch(`${SLACK_MANAGER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_MANAGER_API_TOKEN}`
      },
      body: JSON.stringify({
        tool: 'get_channel_id',
        params: {
          channel_name: '_traction'
        }
      })
    });

    const channelData = await channelResponse.json();
    if (!channelResponse.ok || !channelData.result?.channel_id) {
      console.error('❌ Failed to get channel ID');
      console.error('Response:', JSON.stringify(channelData, null, 2));
      return;
    }

    const channelId = channelData.result.channel_id;
    console.log(`Found channel ID: ${channelId}`);

    // Now send the message
    const response = await fetch(`${SLACK_MANAGER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_MANAGER_API_TOKEN}`
      },
      body: JSON.stringify({
        tool: 'send_message',
        params: {
          channel_id: channelId,
          text: text
        }
      })
    });

    const result = await response.json();

    if (response.ok && result.result) {
      console.log('✅ Test notification sent successfully!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Failed to send notification');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Error sending test notification:', error.message);
    console.error(error.stack);
  }
}

// Get type from command line argument
const notificationType = process.argv[2] || 'preparation';
const validTypes = ['preparation', 'pre-launch', 'countdown', 'post-launch'];

if (!validTypes.includes(notificationType)) {
  console.error(`Invalid notification type: ${notificationType}`);
  console.log(`Valid types: ${validTypes.join(', ')}`);
  process.exit(1);
}

sendTestNotification(notificationType);