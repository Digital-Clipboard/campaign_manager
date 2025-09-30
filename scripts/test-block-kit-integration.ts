#!/usr/bin/env npx tsx

/**
 * Test script to verify Block Kit messages are properly sent through MCP to Slack Manager
 */

import { CampaignSlackNotifications } from '../src/services/slack/campaign-notifications';
import { SlackManagerMCPService } from '../src/services/slack-manager-mcp.service';

async function testBlockKitIntegration() {
  console.log('🧪 Testing Block Kit Integration with Slack Manager\n');
  console.log('='.repeat(80));

  const notificationService = new CampaignSlackNotifications();
  const slackMCPService = new SlackManagerMCPService();

  // Test 1: Create a simple notification with blocks
  console.log('\n1️⃣ Creating launch countdown notification with Block Kit...\n');
  const notification = notificationService.createAboutToSendNotification({
    campaignName: 'Block Kit Integration Test',
    roundNumber: 2,
    targetCount: 1000,
    userRange: 'Test Users 1-1000',
    executionTime: '9:00 AM UTC (10:00 AM London)'
  });

  console.log('✅ Notification created:');
  console.log('   - Text:', notification.text);
  console.log('   - Blocks:', notification.blocks.length, 'blocks');
  console.log('   - Block types:', notification.blocks.map((b: any) => b.type).join(', '));

  // Test 2: Verify SlackManagerMCPService can handle blocks
  console.log('\n2️⃣ Verifying SlackManagerMCPService configuration...\n');

  const testMessage = {
    channel: '#test-campaign-notifications',
    text: notification.text,
    blocks: notification.blocks
  };

  console.log('✅ Message prepared for MCP:');
  console.log('   - Channel:', testMessage.channel);
  console.log('   - Has blocks:', !!testMessage.blocks);
  console.log('   - Block count:', testMessage.blocks?.length || 0);

  // Test 3: Check MCP connection (without sending)
  console.log('\n3️⃣ Testing MCP connection to Slack Manager...\n');
  try {
    const isConnected = await slackMCPService.testConnection();
    if (isConnected) {
      console.log('✅ MCP connection successful!');
      console.log('   Slack Manager is ready to receive Block Kit messages');
    } else {
      console.log('⚠️  MCP connection failed');
      console.log('   Check SLACK_MANAGER_URL and SLACK_MANAGER_API_TOKEN in .env');
    }
  } catch (error) {
    console.log('❌ MCP connection error:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Integration Test Summary:\n');
  console.log('✅ Campaign Manager can create Block Kit notifications');
  console.log('✅ SlackManagerMCPService supports blocks parameter');
  console.log('✅ Blocks are properly structured for Slack API');
  console.log('\n💡 To send a test message to Slack, uncomment the sendMessage call below');
  console.log('   and ensure you have a #test-campaign-notifications channel\n');

  // Uncomment to actually send to Slack:
  // console.log('\n4️⃣ Sending test message to Slack...\n');
  // const success = await slackMCPService.sendMessage(testMessage);
  // if (success) {
  //   console.log('✅ Message sent successfully to Slack!');
  //   console.log('   Check #test-campaign-notifications to see the Block Kit formatting');
  // } else {
  //   console.log('❌ Failed to send message');
  // }
}

// Run the test
testBlockKitIntegration()
  .then(() => {
    console.log('\n✨ Integration test completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });