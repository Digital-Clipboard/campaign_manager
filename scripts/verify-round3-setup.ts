#!/usr/bin/env npx tsx

/**
 * Verify Round 3 (Thursday) setup in MailJet
 * - Check for Batch 3 list (users 2001+)
 * - Check for Round 3 campaign
 */

import Mailjet from 'node-mailjet';

async function verifyRound3Setup() {
  console.log('📋 Verifying Round 3 (Thursday) Setup in MailJet...\n');
  console.log('='.repeat(80));

  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('MAILJET_API_KEY and MAILJET_SECRET_KEY required');
  }

  const mj = new Mailjet({ apiKey, apiSecret: secretKey });

  // Step 1: Check contact lists
  console.log('\n📊 STEP 1: Checking Contact Lists...\n');
  const listsResponse = await mj.get('contactslist', { version: 'v3' }).request();
  const lists = listsResponse.body.Data;

  console.log(`Found ${lists.length} contact lists:\n`);
  lists.forEach((list: any) => {
    console.log(`  [${list.ID}] ${list.Name}`);
    console.log(`    Subscribers: ${list.SubscriberCount}`);
    console.log(`    Created: ${new Date(list.CreatedAt).toUTCString()}\n`);
  });

  // Step 2: Look for Batch 3/Round 3 list
  console.log('='.repeat(80));
  console.log('\n🔍 STEP 2: Looking for Batch 3 / Round 3 List...\n');

  const batch3List = lists.find((l: any) =>
    l.Name.toLowerCase().includes('batch 3') ||
    l.Name.toLowerCase().includes('round 3') ||
    l.Name.toLowerCase().includes('2001') ||
    l.Name.toLowerCase().includes('remaining')
  );

  if (batch3List) {
    console.log(`✅ Found Batch 3 List:`);
    console.log(`   List ID: ${batch3List.ID}`);
    console.log(`   Name: ${batch3List.Name}`);
    console.log(`   Subscribers: ${batch3List.SubscriberCount}`);
    console.log(`   Expected: ~1400-1500 (users 2001 to end)\n`);

    if (batch3List.SubscriberCount < 1000) {
      console.log(`   ⚠️  WARNING: Subscriber count is lower than expected!`);
    } else {
      console.log(`   ✅ Subscriber count looks good!`);
    }
  } else {
    console.log(`❌ NO Batch 3 list found!`);
    console.log(`\nAvailable lists:`);
    lists.forEach((l: any) => console.log(`  - ${l.Name}`));
    console.log(`\n⚠️  You need to create a Batch 3 list with users 2001+ before Thursday!`);
  }

  // Step 3: Check campaigns
  console.log('\n' + '='.repeat(80));
  console.log('\n📧 STEP 3: Checking Recent Campaigns...\n');

  const campaignsResponse = await mj.get('campaign', { version: 'v3' }).request({
    Limit: 10,
    Sort: 'CreatedAt DESC'
  });
  const campaigns = campaignsResponse.body.Data;

  console.log(`Found ${campaigns.length} recent campaigns:\n`);
  campaigns.forEach((campaign: any, i: number) => {
    const createdAt = new Date(campaign.CreatedAt);
    console.log(`  ${i + 1}. [${campaign.ID}] ${campaign.Subject || 'No Subject'}`);
    console.log(`     List ID: ${campaign.ListID}`);
    console.log(`     Status: ${campaign.Status}`);
    console.log(`     Created: ${createdAt.toUTCString()}\n`);
  });

  // Step 4: Look for Round 3 campaign
  console.log('='.repeat(80));
  console.log('\n🔍 STEP 4: Looking for Round 3 Campaign...\n');

  const round3Campaign = campaigns.find((c: any) => {
    const subject = (c.Subject || '').toLowerCase();
    return subject.includes('round 3') ||
           subject.includes('batch 3') ||
           (batch3List && c.ListID === batch3List.ID);
  });

  if (round3Campaign) {
    console.log(`✅ Found Round 3 Campaign:`);
    console.log(`   Campaign ID: ${round3Campaign.ID}`);
    console.log(`   Subject: ${round3Campaign.Subject}`);
    console.log(`   List ID: ${round3Campaign.ListID}`);
    console.log(`   Status: ${round3Campaign.Status}\n`);
  } else {
    console.log(`❌ NO Round 3 campaign found!`);
    console.log(`\n⚠️  You need to create a Round 3 campaign before Thursday!`);
    if (batch3List) {
      console.log(`   Campaign should use List ID: ${batch3List.ID} (${batch3List.Name})`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 THURSDAY (Oct 2nd) CHECKLIST:\n');
  console.log(`${batch3List ? '✅' : '❌'} Batch 3 contact list (users 2001+)`);
  console.log(`${round3Campaign ? '✅' : '❌'} Round 3 campaign created`);
  console.log(`${batch3List && round3Campaign ? '✅' : '❌'} Campaign linked to Batch 3 list`);
  console.log('\nScheduled Times (UTC):');
  console.log('  8:45 AM - 15-minute countdown notification');
  console.log('  9:00 AM - Campaign launches');
  console.log('  9:30 AM - AI post-launch assessment to #_traction\n');
}

verifyRound3Setup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });