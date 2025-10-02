#!/usr/bin/env npx tsx

/**
 * Dump the exact blocks JSON being generated to validate structure
 */

import { CampaignSlackNotifications } from '../src/services/slack/campaign-notifications';
import { ListQualityAgent } from '../src/services/agents/list-quality-agent';
import fs from 'fs';

async function dumpBlocksJson() {
  console.log('📄 Generating and dumping blocks JSON...\n');

  const notificationService = new CampaignSlackNotifications();

  // Create sample notification data
  const notificationData = {
    campaignName: 'Client Letter Automation',
    roundNumber: 2,
    targetCount: 988,
    userRange: 'Users 1,001-2,000',
    executionTime: '9:00 AM UTC',
    currentProgress: {
      sent: 988,
      total: 988,
      accepted: 731,
      delivered: 731,
      bounced: 257,
      hardBounced: 0,
      softBounced: 0,
      queued: 0,
      deferred: 0,
      timeElapsed: '15 minutes',
      estimatedCompletion: 'Complete'
    },
    listQualityAssessment: {
      overallQuality: 'poor',
      qualityScore: 25,
      listHealthStatus: 'critical',
      executiveSummary: 'Test summary',
      insights: [
        { type: 'critical', metric: 'Bounce Rate', observation: 'High', impact: 'high' },
        { type: 'critical', metric: 'Delivery Rate', observation: 'Low', impact: 'high' }
      ],
      recommendations: ['Fix bounces', 'Clean list'],
      comparison: {
        bounceRateChange: 767,
        deliveryRateChange: -23.72,
        trend: 'declining',
        significance: 'Major decline'
      },
      predictions: {
        nextRoundExpectations: 'Bad',
        listCleaningNeeded: true,
        estimatedHealthyContacts: 731
      }
    }
  };

  const notification = notificationService.createPostLaunchNotification(notificationData);

  console.log('✅ Blocks generated\n');
  console.log('📊 Block count:', notification.blocks.length);
  console.log('\n📝 Full blocks JSON:\n');
  console.log(JSON.stringify(notification.blocks, null, 2));

  // Save to file for inspection
  fs.writeFileSync('/tmp/blocks.json', JSON.stringify(notification.blocks, null, 2));
  console.log('\n💾 Saved to /tmp/blocks.json');

  // Validate against Slack's block structure
  console.log('\n🔍 Validating block structure...\n');

  notification.blocks.forEach((block: any, index: number) => {
    console.log(`Block ${index + 1}: type="${block.type}"`);

    if (!block.type) {
      console.log(`  ❌ ERROR: Missing 'type' field`);
    }

    if (block.type === 'section') {
      if (!block.text && !block.fields) {
        console.log(`  ❌ ERROR: Section block must have either 'text' or 'fields'`);
      }
      if (block.text && !block.text.type) {
        console.log(`  ❌ ERROR: Section text missing 'type' field`);
      }
    }

    if (block.type === 'header') {
      if (!block.text || !block.text.type || block.text.type !== 'plain_text') {
        console.log(`  ❌ ERROR: Header text must be plain_text`);
      }
    }
  });

  console.log('\n✅ Validation complete\n');
}

dumpBlocksJson()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });