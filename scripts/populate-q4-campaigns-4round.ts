/**
 * Populate Q4 2025 Campaigns - 4-Round Model
 *
 * NEW STRUCTURE:
 * - Round 1 (Day 1, Tuesday 9am): All 7 stakeholder lists + Users 1/3
 * - Round 2 (Day 3, Thursday 9am): Users 2/3
 * - Round 3 (Day 8, Next Tuesday 9am): Users 3/3
 *
 * Timeline: 7 days total (Tuesday → Thursday → Tuesday)
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

// Users list (split into 3 rounds)
const USERS_LIST_ID = BigInt(5776);
const TOTAL_USERS = 2991;
const USERS_PER_ROUND = Math.ceil(TOTAL_USERS / 3); // 997 per round

/**
 * Helper: Calculate next Tuesday or Thursday
 */
function getNextScheduleDate(baseDate: Date, daysToAdd: number): Date {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Create campaign rounds for a single campaign
 */
function createCampaignRounds(campaignName: string, startDate: Date) {
  const rounds: any[] = [];

  // ROUND 1: Stakeholders + Users 1/3 (Tuesday 9am)
  // Each stakeholder list gets its own row
  STAKEHOLDER_LISTS.forEach((stakeholder, index) => {
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

  // Users 1/3 (also Round 1, same day as stakeholders)
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
  const round3Recipients = TOTAL_USERS - (USERS_PER_ROUND * 2); // Remaining users
  rounds.push({
    campaignName,
    roundNumber: 3,
    scheduledDate: round3Date,
    scheduledTime: '09:00',
    listName: 'users',
    listId: USERS_LIST_ID,
    recipientCount: round3Recipients,
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

/**
 * Q4 2025 Campaign Schedule
 */
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

async function populate() {
  console.log('🚀 Populating Q4 2025 Campaigns - 4-Round Model\n');
  console.log('Structure:');
  console.log('  Round 1: 7 stakeholder lists (52 total) + Users 1/3 (997)');
  console.log('  Round 2: Users 2/3 (997)');
  console.log('  Round 3: Users 3/3 (997)');
  console.log('  Timeline: 7 days (Tue → Thu → Tue)\n');

  let totalCreated = 0;

  for (const campaign of Q4_CAMPAIGNS) {
    console.log(`\n📧 ${campaign.name}`);
    console.log(`   Start Date: ${campaign.startDate.toISOString().split('T')[0]}`);

    const rounds = createCampaignRounds(campaign.name, campaign.startDate);

    for (const round of rounds) {
      try {
        await prisma.lifecycleCampaignSchedule.create({
          data: round
        });

        const roundLabel = round.roundNumber === 1 && round.listName !== 'users'
          ? `Round 1 (Stakeholder: ${round.listName})`
          : `Round ${round.roundNumber}`;

        console.log(`   ✅ ${roundLabel}: ${round.recipientCount} recipients`);
        totalCreated++;
      } catch (error) {
        console.error(`   ❌ Failed ${round.listName}:`, error);
      }
    }
  }

  console.log(`\n✨ Complete! Created ${totalCreated} campaign rounds`);
  console.log(`\nBreakdown:`);
  console.log(`  - 8 campaigns`);
  console.log(`  - 10 sends per campaign (7 stakeholder + 3 user rounds)`);
  console.log(`  - ${totalCreated} total database rows`);

  await prisma.$disconnect();
}

populate().catch(console.error);
