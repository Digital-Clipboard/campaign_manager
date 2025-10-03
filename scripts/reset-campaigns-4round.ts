/**
 * Reset and Populate Q4 2025 Campaigns - 4-Round Model
 * Combines cleanup and population in a single script
 */

import { prisma } from '../src/lib/prisma';

// Stakeholder lists (sent in Round 1)
const STAKEHOLDER_LISTS = [
  { listId: BigInt(10502668), name: 'sjp_leadership', recipients: 6, range: 'Leadership Team' },
  { listId: BigInt(10502666), name: 'sjp_advice_team', recipients: 5, range: 'Advice Team' },
  { listId: BigInt(10502672), name: 'sjp_compliance_team', recipients: 3, range: 'Compliance Team' },
  { listId: BigInt(10502671), name: 'sjp_salesforce_team', recipients: 12, range: 'Salesforce Team' },
  { listId: BigInt(10502670), name: 'sjp_security_team', recipients: 3, range: 'Security Team' },
  { listId: BigInt(10502669), name: 'sjp_support_team', recipients: 9, range: 'Support Team' },
  { listId: BigInt(10502667), name: 'sjp_tec_team', recipients: 14, range: 'TEC Team' },
];

const USERS_LIST_ID = BigInt(5776);
const TOTAL_USERS = 2991;
const USERS_PER_ROUND = Math.ceil(TOTAL_USERS / 3); // 997 per round

const Q4_CAMPAIGNS = [
  { name: 'Client Letter Automation', startDate: new Date('2025-09-19T09:00:00Z') },
  { name: 'Drawdown Income Sustainability', startDate: new Date('2025-10-08T09:00:00Z') },
  { name: 'Voyant Integration', startDate: new Date('2025-10-22T09:00:00Z') },
  { name: 'Management Information', startDate: new Date('2025-11-05T09:00:00Z') },
  { name: 'Client Material Tool Kit', startDate: new Date('2025-11-19T09:00:00Z') },
  { name: 'Compliance Corner', startDate: new Date('2025-12-03T09:00:00Z') },
  { name: 'Case Study', startDate: new Date('2025-12-17T09:00:00Z') },
  { name: 'Year in Review', startDate: new Date('2025-12-31T09:00:00Z') },
];

function getNextScheduleDate(fromDate: Date, daysToAdd: number): Date {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

function createCampaignRounds(campaignName: string, startDate: Date) {
  const rounds: any[] = [];

  // ROUND 1: All 7 stakeholder lists + Users 1/3 (Tuesday 9am)
  STAKEHOLDER_LISTS.forEach((stakeholder) => {
    rounds.push({
      campaignName,
      roundNumber: 1,
      scheduledDate: startDate,
      scheduledTime: '09:00',
      listName: stakeholder.name,
      listId: stakeholder.listId,
      recipientCount: stakeholder.recipients,
      recipientRange: stakeholder.range,
      mailjetDraftId: BigInt(0),
      subject: `[${stakeholder.range}] ${campaignName}`,
      senderName: 'Digital Clipboard',
      senderEmail: 'noreply@digitalclipboard.com',
      status: 'SCHEDULED' as const,
      notificationStatus: {}
    });
  });

  // Users 1/3 (also Round 1)
  rounds.push({
    campaignName,
    roundNumber: 1,
    scheduledDate: startDate,
    scheduledTime: '09:00',
    listName: 'users',
    listId: USERS_LIST_ID,
    recipientCount: USERS_PER_ROUND,
    recipientRange: `Users 1-${USERS_PER_ROUND}`,
    mailjetDraftId: BigInt(0),
    subject: campaignName,
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  });

  // ROUND 2: Users 2/3 (Thursday, 2 days later)
  const round2Date = getNextScheduleDate(startDate, 2);
  rounds.push({
    campaignName,
    roundNumber: 2,
    scheduledDate: round2Date,
    scheduledTime: '09:00',
    listName: 'users',
    listId: USERS_LIST_ID,
    recipientCount: USERS_PER_ROUND,
    recipientRange: `Users ${USERS_PER_ROUND + 1}-${USERS_PER_ROUND * 2}`,
    mailjetDraftId: BigInt(0),
    subject: campaignName,
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  });

  // ROUND 3: Users 3/3 (Next Tuesday, 5 days after Round 2)
  const round3Date = getNextScheduleDate(round2Date, 5);
  rounds.push({
    campaignName,
    roundNumber: 3,
    scheduledDate: round3Date,
    scheduledTime: '09:00',
    listName: 'users',
    listId: USERS_LIST_ID,
    recipientCount: TOTAL_USERS - (USERS_PER_ROUND * 2),
    recipientRange: `Users ${(USERS_PER_ROUND * 2) + 1}-${TOTAL_USERS}`,
    mailjetDraftId: BigInt(0),
    subject: campaignName,
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  });

  return rounds;
}

async function resetCampaigns() {
  try {
    console.log('🔄 Resetting Q4 2025 Campaigns - 4-Round Model\n');
    console.log('Structure:');
    console.log('  Round 1: 7 stakeholder lists (52 total) + Users 1/3 (997)');
    console.log('  Round 2: Users 2/3 (997)');
    console.log('  Round 3: Users 3/3 (997)');
    console.log('  Timeline: 7 days (Tue → Thu → Tue)\n');

    // Step 1: Delete all existing campaigns
    console.log('🗑️  Deleting existing campaigns...');
    const deleted = await prisma.lifecycleCampaignSchedule.deleteMany({});
    console.log(`   ✅ Deleted ${deleted.count} existing records\n`);

    // Step 2: Create all campaign rounds
    let totalCreated = 0;

    for (const campaign of Q4_CAMPAIGNS) {
      console.log(`📧 ${campaign.name}`);
      console.log(`   Start Date: ${campaign.startDate.toISOString().split('T')[0]}`);

      const rounds = createCampaignRounds(campaign.name, campaign.startDate);

      for (const round of rounds) {
        await prisma.lifecycleCampaignSchedule.create({ data: round });
        totalCreated++;

        if (round.recipientRange.includes('Team')) {
          console.log(`   ✅ Round ${round.roundNumber} (Stakeholder: ${round.listName}): ${round.recipientCount} recipients`);
        } else {
          console.log(`   ✅ Round ${round.roundNumber}: ${round.recipientCount} recipients`);
        }
      }

      console.log('');
    }

    console.log(`✨ Complete! Created ${totalCreated} campaign rounds\n`);
    console.log('Breakdown:');
    console.log(`  - ${Q4_CAMPAIGNS.length} campaigns`);
    console.log('  - 10 sends per campaign (7 stakeholder + 3 user rounds)');
    console.log(`  - ${totalCreated} total database rows`);

  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetCampaigns().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
