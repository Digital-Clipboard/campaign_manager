#!/usr/bin/env node

/**
 * Update Round 3 Campaign ID in the post-launch assessment script
 * Usage: node scripts/update-round3-campaign-id.js <CAMPAIGN_ID>
 */

const fs = require('fs');
const path = require('path');

const campaignId = process.argv[2];

if (!campaignId) {
  console.error('❌ Error: Campaign ID required');
  console.error('Usage: node scripts/update-round3-campaign-id.js <CAMPAIGN_ID>');
  console.error('Example: node scripts/update-round3-campaign-id.js 7759123456');
  process.exit(1);
}

// Validate campaign ID is numeric
if (!/^\d+$/.test(campaignId)) {
  console.error('❌ Error: Campaign ID must be numeric');
  process.exit(1);
}

console.log('🚀 Updating Round 3 Campaign ID');
console.log('='.repeat(80));
console.log(`📋 Campaign ID: ${campaignId}\n`);

try {
  // Read the post-launch assessment script
  const scriptPath = path.join(__dirname, 'real-post-launch-assessment.ts');
  let content = fs.readFileSync(scriptPath, 'utf8');

  // Check if Round 3 constant already exists
  if (content.includes('ROUND_3_CAMPAIGN_ID')) {
    console.log('⚠️  Round 3 Campaign ID constant already exists');
    console.log('   Updating existing value...\n');

    // Replace existing value
    content = content.replace(
      /const ROUND_3_CAMPAIGN_ID = \d+;/,
      `const ROUND_3_CAMPAIGN_ID = ${campaignId};`
    );
  } else {
    console.log('➕ Adding Round 3 Campaign ID constant...\n');

    // Add after Round 2 constant
    content = content.replace(
      /(const ROUND_2_CAMPAIGN_ID = \d+;)/,
      `$1\n    const ROUND_3_CAMPAIGN_ID = ${campaignId};`
    );
  }

  // Write back to file
  fs.writeFileSync(scriptPath, content, 'utf8');

  console.log('✅ Successfully updated real-post-launch-assessment.ts');
  console.log('─'.repeat(80));
  console.log(`Round 3 Campaign ID: ${campaignId}`);
  console.log('─'.repeat(80));

  console.log('\n📝 NEXT STEPS:');
  console.log('1. Add Round 3 fetching logic to the assessment script');
  console.log('2. Run: node scripts/verify-round3-campaign.js');
  console.log('3. Test the assessment with Round 3 data');

} catch (error) {
  console.error('❌ Error updating script:', error.message);
  process.exit(1);
}
