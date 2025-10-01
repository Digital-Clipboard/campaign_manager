#!/usr/bin/env npx tsx

/**
 * Test if Block Kit blocks are actually being sent to Slack
 */

import { SlackManagerMCPService } from '../src/services/slack-manager-mcp.service';

async function testSlackBlocks() {
  console.log('🧪 Testing Slack Block Kit Message Delivery\n');

  const slackService = new SlackManagerMCPService();

  // Create a simple Block Kit message
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🧪 Block Kit Test Message'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*This is a test of Block Kit formatting.*\n\nIf you can see this formatted with a header above, then Block Kit is working! ✅'
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: '*Field 1:*\nValue 1'
        },
        {
          type: 'mrkdwn',
          text: '*Field 2:*\nValue 2'
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '📅 Test conducted at: ' + new Date().toLocaleString()
        }
      ]
    }
  ];

  const text = 'Block Kit Test Message (fallback text)';

  console.log('📤 Sending test message with', blocks.length, 'blocks...');
  console.log('\nBlocks being sent:');
  console.log(JSON.stringify(blocks, null, 2));
  console.log('\n');

  const success = await slackService.sendMessage({
    channel: '#_traction',
    text,
    blocks
  });

  if (success) {
    console.log('✅ Message sent successfully!');
    console.log('\n📱 Check #_traction channel in Slack to see if:');
    console.log('   1. You see a formatted header that says "🧪 Block Kit Test Message"');
    console.log('   2. The text is bold and formatted');
    console.log('   3. You see two fields side-by-side');
    console.log('   4. There\'s a divider line');
    console.log('   5. There\'s a context section at the bottom with timestamp');
    console.log('\nIf you only see plain text "Block Kit Test Message (fallback text)",');
    console.log('then blocks are NOT being rendered by Slack.\n');
  } else {
    console.log('❌ Failed to send message');
  }
}

testSlackBlocks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });