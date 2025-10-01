#!/usr/bin/env npx tsx

/**
 * Live test: Send Block Kit notification to Slack via MCP
 */

import { CampaignSlackNotifications } from '../src/services/slack/campaign-notifications';
import { SlackManagerMCPService } from '../src/services/slack-manager-mcp.service';
import { ListQualityAgent } from '../src/services/agents/list-quality-agent';

async function testLiveBlockKit() {
  console.log('🧪 Live Block Kit Test\n');
  console.log('='.repeat(80));

  const notificationService = new CampaignSlackNotifications();
  const slackMCPService = new SlackManagerMCPService();

  // Test 1: Create post-launch notification with AI assessment
  console.log('\n1️⃣ Creating post-launch notification with AI assessment...\n');

  try {
    const listQualityAgent = new ListQualityAgent();

    // Simulate Round 2 data
    const assessment = await listQualityAgent.assessListQuality({
      campaignName: 'Client Letter Automation - LIVE TEST',
      currentRound: 2,
      currentStats: {
        sent: 1000,
        delivered: 982,
        bounced: 18,
        hardBounced: 8,
        softBounced: 10,
        opened: 0,
        clicked: 0,
        deliveryRate: 98.2,
        bounceRate: 1.8,
        openRate: 0,
        clickRate: 0,
        timeElapsed: '15 minutes'
      },
      previousRoundStats: {
        sent: 1000,
        delivered: 970,
        bounced: 30,
        hardBounced: 18,
        softBounced: 12,
        opened: 240,
        clicked: 32,
        deliveryRate: 97.0,
        bounceRate: 3.0,
        openRate: 24.0,
        clickRate: 3.2
      },
      userSegment: 'Users 1,001-2,000 (FIFO by Contact ID)'
    });

    console.log('✅ AI Assessment completed:');
    console.log('   - Overall Quality:', assessment.overallQuality);
    console.log('   - Quality Score:', assessment.qualityScore);
    console.log('   - List Health:', assessment.listHealthStatus);
    console.log('   - Bounce Rate Change:', assessment.comparison.bounceRateChange + '%');
    console.log('   - Trend:', assessment.comparison.trend);

    const notification = notificationService.createPostLaunchNotification({
      campaignName: 'Client Letter Automation - LIVE TEST',
      roundNumber: 2,
      targetCount: 1000,
      userRange: 'Users 1,001-2,000 (FIFO)',
      executionTime: '9:00 AM UTC (10:00 AM London)',
      currentProgress: {
        sent: 1000,
        total: 1000,
        accepted: 982,
        delivered: 982,
        bounced: 18,
        hardBounced: 8,
        softBounced: 10,
        queued: 0,
        deferred: 0,
        timeElapsed: '15 minutes'
      },
      listQualityAssessment: assessment
    });

    console.log('\n✅ Notification created:');
    console.log('   - Text:', notification.text);
    console.log('   - Blocks:', notification.blocks.length, 'blocks');

    // Test 2: Send to Slack
    console.log('\n2️⃣ Sending to Slack via MCP...\n');

    // Posting to #_traction
    const channel = '#_traction';

    console.log(`📤 Sending to channel: ${channel}`);
    console.log('   This will send a beautifully formatted Block Kit message');
    console.log('   with AI-powered list quality assessment!\n');

    const success = await slackMCPService.sendMessage({
      channel: channel,
      text: notification.text,
      blocks: notification.blocks
    });

    if (success) {
      console.log('\n✅ SUCCESS! Message sent to Slack!');
      console.log(`   Check ${channel} to see the beautiful Block Kit formatting`);
      console.log('   You should see:');
      console.log('   • Header with 🚀 emoji');
      console.log('   • Campaign details section');
      console.log('   • Delivery metrics with visual indicators');
      console.log('   • AI-powered quality assessment');
      console.log('   • Round comparison with trend arrows');
      console.log('   • Top insights and recommendations');
      console.log('   • Predictions for next round');
    } else {
      console.log('\n❌ Failed to send message');
      console.log('   Check logs above for error details');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Live test completed!\n');
}

// Run the test
testLiveBlockKit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
