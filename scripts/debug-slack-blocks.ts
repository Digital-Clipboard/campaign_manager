#!/usr/bin/env npx tsx

/**
 * Debug script to validate Block Kit JSON and test what Slack actually receives
 */

import { SlackManagerMCPService } from '../src/services/slack-manager-mcp.service';

async function debugBlocks() {
  console.log('🔍 Debugging Slack Block Kit Issues\n');

  const slackService = new SlackManagerMCPService();

  // Test 1: Simple valid block
  console.log('TEST 1: Simple valid block (should work)');
  const test1 = [
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: 'Simple plain text block'
      }
    }
  ];

  await slackService.sendMessage({
    channel: '#_traction',
    text: 'Test 1: Simple block',
    blocks: test1
  });
  console.log('✅ Test 1 sent\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Markdown with emoji
  console.log('TEST 2: Markdown with emoji');
  const test2 = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Bold text* with emoji 🔴 and _italic_'
      }
    }
  ];

  await slackService.sendMessage({
    channel: '#_traction',
    text: 'Test 2: Markdown with emoji',
    blocks: test2
  });
  console.log('✅ Test 2 sent\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Fields section (like our campaign report)
  console.log('TEST 3: Fields section');
  const test3 = [
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
    }
  ];

  await slackService.sendMessage({
    channel: '#_traction',
    text: 'Test 3: Fields section',
    blocks: test3
  });
  console.log('✅ Test 3 sent\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Complex nested structure
  console.log('TEST 4: Complex structure with header + divider');
  const test4 = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Test Header'
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Campaign:* Test\n*Status:* ● Active'
      }
    }
  ];

  await slackService.sendMessage({
    channel: '#_traction',
    text: 'Test 4: Complex structure',
    blocks: test4
  });
  console.log('✅ Test 4 sent\n');

  console.log('\n📱 Check #_traction to see which tests show formatted blocks vs plain text');
  console.log('If all show plain text, the issue is with Slack app permissions or Bot token');
  console.log('If some work and some don\'t, we can identify the problematic block structure\n');
}

debugBlocks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Debug failed:', error);
    process.exit(1);
  });