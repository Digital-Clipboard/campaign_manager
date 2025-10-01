#!/usr/bin/env npx tsx

/**
 * Test which Slack bot token is being used by checking bot identity
 */

import { SlackManagerMCPService } from '../src/services/slack-manager-mcp.service';

async function testBotIdentity() {
  console.log('🔍 Checking Slack Bot Identity\n');

  const slackService = new SlackManagerMCPService();

  // Get workspace info which includes bot details
  try {
    const response = await fetch(`${process.env.SLACK_MANAGER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SLACK_MANAGER_API_TOKEN}`
      },
      body: JSON.stringify({
        tool: 'get_workspace_info',
        params: {}
      })
    });

    const data = await response.json();

    if (data.result) {
      console.log('✅ Workspace Info:');
      console.log(`   Team: ${data.result.team_name}`);
      console.log(`   Team ID: ${data.result.team_id}`);
      console.log(`   Bot User ID: ${data.result.bot_user_id}\n`);

      console.log('📝 Expected bot token should start with: xoxb-2558941062-8715606925506-');
      console.log('📝 If the bot user ID matches your Slack Manager bot, then the token is correct.\n');

      // Now test if blocks work
      console.log('🧪 Testing Block Kit with this bot...\n');

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ Bot Identity Test'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Bot User ID:* ${data.result.bot_user_id}\n*Team:* ${data.result.team_name}\n\nIf you see this formatted with a header above, Block Kit is working! ✅`
          }
        }
      ];

      const success = await slackService.sendMessage({
        channel: '#_traction',
        text: 'Bot Identity Test (fallback)',
        blocks
      });

      if (success) {
        console.log('✅ Test message sent - check #_traction\n');
        console.log('If you see formatted blocks, the bot token is correct and has chat:write.customize');
        console.log('If you only see "Bot Identity Test (fallback)", the token may be wrong or missing permissions\n');
      }
    } else {
      console.log('❌ Could not get workspace info');
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBotIdentity()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });