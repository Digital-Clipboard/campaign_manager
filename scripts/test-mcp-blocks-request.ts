#!/usr/bin/env npx tsx

/**
 * Test the actual MCP HTTP request to see what's being sent
 */

async function testMCPRequest() {
  console.log('🧪 Testing MCP Request with Blocks\n');

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'MCP Test Header'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*This is a test* from MCP'
      }
    }
  ];

  const requestBody = {
    tool: 'send_message',
    params: {
      channel_id: 'C011CEK2406',
      text: 'MCP Blocks Test (fallback)',
      blocks: blocks
    }
  };

  console.log('📤 Sending MCP request...');
  console.log('Request body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n');

  const response = await fetch(`${process.env.SLACK_MANAGER_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SLACK_MANAGER_API_TOKEN}`
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  console.log('📥 Response:');
  console.log(JSON.stringify(data, null, 2));

  if (data.result) {
    console.log('\n✅ Message sent successfully');
    console.log('\n📱 Check #_traction - if you see a formatted header and bold text, blocks are working through MCP');
    console.log('If you only see "MCP Blocks Test (fallback)", something is wrong with how blocks are passed through MCP\n');
  } else {
    console.log('\n❌ Failed to send message');
    console.log('Error:', data.error);
  }
}

testMCPRequest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });