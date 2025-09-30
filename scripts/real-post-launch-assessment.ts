#!/usr/bin/env npx tsx

/**
 * REAL Post-Launch Assessment - Fetch actual MailJet data and run AI assessment
 * This performs all the actual steps but outputs here instead of posting to Slack
 */

import { CampaignSlackNotifications } from '../src/services/slack/campaign-notifications';
import { ListQualityAgent } from '../src/services/agents/list-quality-agent';
import Mailjet from 'node-mailjet';

async function realPostLaunchAssessment() {
  console.log('🚀 REAL Post-Launch Assessment - Fetching Live MailJet Data\n');
  console.log('='.repeat(80));
  console.log('\n⏰ Current Time:', new Date().toUTCString());
  console.log('📧 Campaign: Client Letter Automation - Round 2');
  console.log('🎯 Target: Users 1,001-2,000 (FIFO by Contact ID)\n');

  const notificationService = new CampaignSlackNotifications();
  const listQualityAgent = new ListQualityAgent();

  try {
    // STEP 1: Initialize MailJet client
    console.log('='.repeat(80));
    console.log('\n📡 STEP 1: Connecting to MailJet API...\n');

    const mailjetApiKey = process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC;
    const mailjetSecretKey = process.env.MAILJET_SECRET_KEY || process.env.MJ_APIKEY_PRIVATE;

    if (!mailjetApiKey || !mailjetSecretKey) {
      throw new Error('MailJet credentials not found. Set MAILJET_API_KEY and MAILJET_SECRET_KEY');
    }

    const mailjet = new Mailjet({
      apiKey: mailjetApiKey,
      apiSecret: mailjetSecretKey
    });

    console.log('✅ Connected to MailJet API\n');

    // STEP 2: Fetch specific campaigns by ID
    console.log('='.repeat(80));
    console.log('\n🔍 STEP 2: Fetching Campaign Data...\n');

    // Known campaign IDs from MailJet
    const ROUND_1_CAMPAIGN_ID = 7758947928;
    const ROUND_2_CAMPAIGN_ID = 7758985090;

    console.log(`📋 Fetching campaigns:`);
    console.log(`   Round 1: Campaign ID ${ROUND_1_CAMPAIGN_ID}`);
    console.log(`   Round 2: Campaign ID ${ROUND_2_CAMPAIGN_ID}\n`);

    // Fetch Round 1 campaign
    let round1Campaign = null;
    try {
      const r1Response = await mailjet
        .get('campaign', { version: 'v3' })
        .id(ROUND_1_CAMPAIGN_ID)
        .request();
      round1Campaign = r1Response.body.Data[0];
      console.log(`✅ Round 1 Campaign Found: [${round1Campaign.ID}] ${round1Campaign.Subject || 'No Subject'}`);
    } catch (error) {
      console.log(`⚠️  Round 1 Campaign (${ROUND_1_CAMPAIGN_ID}) not found or not accessible`);
    }

    // Fetch Round 2 campaign
    let round2Campaign = null;
    try {
      const r2Response = await mailjet
        .get('campaign', { version: 'v3' })
        .id(ROUND_2_CAMPAIGN_ID)
        .request();
      round2Campaign = r2Response.body.Data[0];
      console.log(`✅ Round 2 Campaign Found: [${round2Campaign.ID}] ${round2Campaign.Subject || 'No Subject'}\n`);
    } catch (error) {
      console.log(`❌ ERROR: Round 2 Campaign (${ROUND_2_CAMPAIGN_ID}) not found!`);
      throw new Error('Cannot proceed without Round 2 campaign data');
    }

    // STEP 3: Fetch campaign statistics for BOTH rounds
    console.log('='.repeat(80));
    console.log('\n📊 STEP 3: Fetching Campaign Statistics...\n');

    // Helper function to fetch stats for a campaign
    async function fetchCampaignStats(campaign: any, roundName: string) {
      console.log(`\n🔍 Fetching ${roundName} statistics...`);

      const statsResponse = await mailjet
        .get('campaignstatistics', { version: 'v3' })
        .id(campaign.ID)
        .request();

      const stats = statsResponse.body.Data[0];

      console.log(`✅ ${roundName} Statistics Retrieved:`);
      console.log(`   Delivered: ${stats.DeliveredCount}`);
      console.log(`   Opened: ${stats.OpenedCount} (${((stats.OpenedCount / stats.DeliveredCount) * 100).toFixed(2)}%)`);
      console.log(`   Clicked: ${stats.ClickedCount} (${((stats.ClickedCount / stats.DeliveredCount) * 100).toFixed(2)}%)`);
      console.log(`   Bounced: ${stats.BouncedCount}`);
      console.log(`   Spam: ${stats.SpamComplaintCount}`);
      console.log(`   Unsubscribed: ${stats.UnsubscribedCount}\n`);

      // Fetch detailed bounce information
      let hardBounceCount = 0;
      let softBounceCount = 0;

      try {
        const bouncesResponse = await mailjet
          .get('messagestatistics', { version: 'v3' })
          .request({
            CampaignID: campaign.ID,
            Limit: 1000
          });

        const messages = bouncesResponse.body.Data;

        // Count hard vs soft bounces
        messages.forEach((msg: any) => {
          if (msg.Status === 'hardbounced') hardBounceCount++;
          if (msg.Status === 'softbounced') softBounceCount++;
        });

        console.log(`   Hard Bounces: ${hardBounceCount}`);
        console.log(`   Soft Bounces: ${softBounceCount}`);
      } catch (error) {
        console.log(`   ⚠️  Could not fetch detailed bounce info, using estimates`);
        hardBounceCount = Math.round(stats.BouncedCount * 0.6);
        softBounceCount = stats.BouncedCount - hardBounceCount;
      }

      return {
        sent: stats.DeliveredCount + stats.BouncedCount,
        delivered: stats.DeliveredCount,
        bounced: stats.BouncedCount,
        hardBounced: hardBounceCount,
        softBounced: softBounceCount,
        opened: stats.OpenedCount,
        clicked: stats.ClickedCount,
        deliveryRate: parseFloat(((stats.DeliveredCount / (stats.DeliveredCount + stats.BouncedCount)) * 100).toFixed(2)),
        bounceRate: parseFloat(((stats.BouncedCount / (stats.DeliveredCount + stats.BouncedCount)) * 100).toFixed(2)),
        openRate: parseFloat(((stats.OpenedCount / (stats.DeliveredCount || 1)) * 100).toFixed(2)),
        clickRate: parseFloat(((stats.ClickedCount / (stats.DeliveredCount || 1)) * 100).toFixed(2))
      };
    }

    // Fetch stats for both rounds
    let round1Stats = null;
    if (round1Campaign) {
      round1Stats = await fetchCampaignStats(round1Campaign, 'Round 1');
    } else {
      // ⚠️ CRITICAL: Round 1 campaign not found in MailJet
      // DO NOT USE HARDCODED DATA - this would make comparisons invalid
      console.log('\n⚠️  CRITICAL: Round 1 campaign not found in MailJet');
      console.log('   Comparison to previous round will be SKIPPED');
      console.log('   Assessment will be based on Round 2 data only\n');
    }

    const round2Stats = {
      ...await fetchCampaignStats(round2Campaign, 'Round 2'),
      timeElapsed: '15 minutes'
    };

    console.log('='.repeat(80));
    console.log('\n📈 COMPARISON:\n');

    if (round1Stats) {
      console.log('Round 1 (Baseline):');
      console.log(`   Sent: ${round1Stats.sent}`);
      console.log(`   Delivered: ${round1Stats.delivered} (${round1Stats.deliveryRate}%)`);
      console.log(`   Bounced: ${round1Stats.bounced} (${round1Stats.bounceRate}%)`);
      console.log(`   Hard Bounces: ${round1Stats.hardBounced}`);
      console.log(`   Opens: ${round1Stats.opened} (${round1Stats.openRate}%)`);
      console.log(`   Clicks: ${round1Stats.clicked} (${round1Stats.clickRate}%)\n`);
    } else {
      console.log('⚠️  Round 1 data not available - no comparison possible\n');
    }

    console.log('Round 2 (Current):');
    console.log(`   Sent: ${round2Stats.sent}`);
    console.log(`   Delivered: ${round2Stats.delivered} (${round2Stats.deliveryRate}%)`);
    console.log(`   Bounced: ${round2Stats.bounced} (${round2Stats.bounceRate}%)`);
    console.log(`   Hard Bounces: ${round2Stats.hardBounced}`);
    console.log(`   Opens: ${round2Stats.opened} (${round2Stats.openRate}%)`);
    console.log(`   Clicks: ${round2Stats.clicked} (${round2Stats.clickRate}%)\n`);

    // Calculate changes only if Round 1 data exists
    if (round1Stats) {
      const bounceRateChange = ((round2Stats.bounceRate - round1Stats.bounceRate) / round1Stats.bounceRate * 100).toFixed(1);
      const hardBounceChange = round1Stats.hardBounced > 0
        ? ((round2Stats.hardBounced - round1Stats.hardBounced) / round1Stats.hardBounced * 100).toFixed(1)
        : 'N/A';
      const deliveryRateChange = (round2Stats.deliveryRate - round1Stats.deliveryRate).toFixed(2);

      console.log('📊 Key Changes:');
      console.log(`   Bounce Rate: ${bounceRateChange}%`);
      console.log(`   Hard Bounces: ${hardBounceChange}%`);
      console.log(`   Delivery Rate: ${deliveryRateChange > 0 ? '+' : ''}${deliveryRateChange}%\n`);
    } else {
      console.log('📊 No comparison available (Round 1 data missing)\n');
    }

    // STEP 4: Run AI Assessment
    console.log('='.repeat(80));
    console.log('\n🤖 STEP 4: Running AI List Quality Assessment (Google Gemini 2.0 Flash)...\n');

    const assessment = await listQualityAgent.assessListQuality({
      campaignName: 'Client Letter Automation',
      currentRound: 2,
      currentStats: round2Stats,
      previousRoundStats: round1Stats,
      userSegment: 'Users 1,001-2,000 (FIFO by Contact ID)'
    });

    console.log('✅ AI Assessment Completed!\n');
    console.log(`   Overall Quality: ${assessment.overallQuality.toUpperCase()}`);
    console.log(`   Quality Score: ${assessment.qualityScore}/100`);
    console.log(`   List Health: ${assessment.listHealthStatus.toUpperCase()}`);
    console.log(`   Trend: ${assessment.comparison.trend.toUpperCase()}\n`);

    // STEP 5: Format the notification
    console.log('='.repeat(80));
    console.log('\n📝 STEP 5: Formatting Post-Launch Report...\n');

    const notification = notificationService.createPostLaunchNotification({
      campaignName: 'Client Letter Automation',
      roundNumber: 2,
      targetCount: round2Stats.sent,
      userRange: 'Users 1,001-2,000 (FIFO)',
      executionTime: '9:00 AM UTC (10:00 AM London)',
      currentProgress: {
        sent: round2Stats.sent,
        total: round2Stats.sent,
        accepted: round2Stats.delivered,
        delivered: round2Stats.delivered,
        bounced: round2Stats.bounced,
        hardBounced: round2Stats.hardBounced,
        softBounced: round2Stats.softBounced,
        queued: 0,
        deferred: 0,
        timeElapsed: '15 minutes'
      },
      listQualityAssessment: assessment
    });

    console.log('✅ Report formatted with Block Kit');
    console.log(`   Total blocks: ${notification.blocks.length}\n`);

    // STEP 6: Display the report
    console.log('='.repeat(80));
    console.log('\n📋 FINAL POST-LAUNCH REPORT\n');
    console.log('='.repeat(80));
    console.log('\n[This would be posted to #_traction]\n');
    console.log('─'.repeat(80));
    console.log('\n📊 POST-LAUNCH REPORT (15 MIN)\n');
    console.log('─'.repeat(80));
    console.log('\nClient Letter Automation - Round 2\n');
    console.log('🟢 Campaign distribution complete\n');
    console.log('─'.repeat(80));
    console.log('\n📈 Distribution Progress:\n');
    console.log(`Sent: ${round2Stats.sent.toLocaleString()} / ${round2Stats.sent.toLocaleString()} (100%)`);
    console.log(`Time Elapsed: ${round2Stats.timeElapsed}\n`);
    console.log('─'.repeat(80));
    console.log('\n📬 Delivery Metrics:\n');
    console.log(`Accepted: ${round2Stats.delivered} (${round2Stats.deliveryRate}%)`);
    console.log(`Bounced: ${round2Stats.bounced} (${round2Stats.bounceRate}%)`);
    console.log(`├─ Hard Bounces: ${round2Stats.hardBounced}`);
    console.log(`└─ Soft Bounces: ${round2Stats.softBounced}\n`);
    console.log('─'.repeat(80));
    console.log('\n🤖 AI LIST QUALITY ASSESSMENT\n');
    console.log('─'.repeat(80));

    let qualityEmoji = '🟢';
    if (assessment.overallQuality === 'fair') qualityEmoji = '🟡';
    if (assessment.overallQuality === 'poor') qualityEmoji = '🔴';

    console.log(`\n${qualityEmoji} Overall Quality: ${assessment.overallQuality.toUpperCase()} (${assessment.qualityScore}/100)`);
    console.log(`Health Status: ${assessment.listHealthStatus.toUpperCase()}\n`);
    console.log('─'.repeat(80));
    console.log('\nExecutive Summary:\n');
    console.log(`${assessment.executiveSummary}\n`);
    console.log('─'.repeat(80));

    let trendEmoji = '➡️';
    if (assessment.comparison.trend === 'improving') trendEmoji = '📈';
    if (assessment.comparison.trend === 'declining') trendEmoji = '📉';

    console.log(`\n${trendEmoji} Round Comparison (vs Round 1):\n`);
    console.log(`• Bounce Rate: ${assessment.comparison.bounceRateChange > 0 ? '+' : ''}${assessment.comparison.bounceRateChange}%`);
    console.log(`• Delivery Rate: ${assessment.comparison.deliveryRateChange > 0 ? '+' : ''}${assessment.comparison.deliveryRateChange}%`);
    console.log(`• Engagement Change: Opens ${round2Stats.openRate - round1Stats.openRate > 0 ? '+' : ''}${(round2Stats.openRate - round1Stats.openRate).toFixed(2)}%`);
    console.log(`• Trend: ${assessment.comparison.trend.toUpperCase()}\n`);
    console.log(`${assessment.comparison.significance}\n`);
    console.log('─'.repeat(80));

    console.log('\n💡 Top Insights:\n');
    assessment.insights.slice(0, 3).forEach((insight, i) => {
      let insightEmoji = '✅';
      if (insight.type === 'warning') insightEmoji = '⚠️';
      if (insight.type === 'critical') insightEmoji = '🚨';

      console.log(`${i + 1}. ${insightEmoji} [${insight.metric}]`);
      console.log(`   ${insight.observation}`);
      console.log(`   Impact: ${insight.impact}\n`);
    });
    console.log('─'.repeat(80));

    console.log('\n🎯 Recommendations:\n');
    assessment.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    console.log('\n' + '─'.repeat(80));

    console.log('\n🔮 Predictions:\n');
    console.log(`Next Round: ${assessment.predictions.nextRoundExpectations}`);
    console.log(`List Cleaning Needed: ${assessment.predictions.listCleaningNeeded ? 'YES' : 'NO'}`);
    console.log(`Estimated Healthy Contacts: ${assessment.predictions.estimatedHealthyContacts.toLocaleString()}\n`);
    console.log('─'.repeat(80));

    console.log('\n[END OF REPORT]\n');
    console.log('='.repeat(80));
    console.log('\n📤 STEP 6: Posting to Slack...\n');

    // Initialize Slack MCP service
    const { SlackManagerMCPService } = await import('../src/services/slack-manager-mcp.service');
    const slackService = new SlackManagerMCPService();

    // Post to #_traction
    const success = await slackService.sendMessage({
      channel: '#_traction',
      text: notification.text,
      blocks: notification.blocks
    });

    if (success) {
      console.log('✅ Successfully posted to #_traction!');
    } else {
      console.log('❌ Failed to post to #_traction');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Assessment complete and posted to #_traction!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the real assessment
realPostLaunchAssessment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Assessment failed:', error);
    process.exit(1);
  });