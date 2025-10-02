/**
 * Populate Q4 2025 Campaigns
 * Simple script to populate both staging and production with Q4 2025 marketing campaigns
 */

import { prisma } from '../src/lib/prisma';

const campaigns = [
  // Client Letter Automation (Sept 19, 2025)
  {
    campaignName: 'Client Letter Automation',
    roundNumber: 1,
    scheduledDate: new Date('2025-09-19T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'client-letter-leadership',
    listId: BigInt(0),
    recipientCount: 1000,
    recipientRange: 'Leadership',
    mailjetDraftId: BigInt(0),
    subject: '[Leadership] Client Letter Automation',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  },
  {
    campaignName: 'Client Letter Automation',
    roundNumber: 2,
    scheduledDate: new Date('2025-09-26T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'client-letter-compliance',
    listId: BigInt(0),
    recipientCount: 500,
    recipientRange: 'Compliance',
    mailjetDraftId: BigInt(0),
    subject: '[Compliance] Client Letter Automation',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  },
  {
    campaignName: 'Client Letter Automation',
    roundNumber: 3,
    scheduledDate: new Date('2025-10-03T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'client-letter-users',
    listId: BigInt(0),
    recipientCount: 1500,
    recipientRange: 'Users',
    mailjetDraftId: BigInt(0),
    subject: 'Client Letter Automation',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  },

  // Drawdown Income Sustainability (Oct 1, 2025)
  {
    campaignName: 'Drawdown Income Sustainability',
    roundNumber: 1,
    scheduledDate: new Date('2025-10-01T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'drawdown-leadership',
    listId: BigInt(0),
    recipientCount: 1000,
    recipientRange: 'Leadership',
    mailjetDraftId: BigInt(0),
    subject: '[Leadership] Drawdown Income Sustainability',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  },
  {
    campaignName: 'Drawdown Income Sustainability',
    roundNumber: 2,
    scheduledDate: new Date('2025-10-08T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'drawdown-compliance',
    listId: BigInt(0),
    recipientCount: 500,
    recipientRange: 'Compliance',
    mailjetDraftId: BigInt(0),
    subject: '[Compliance] Drawdown Income Sustainability',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  },
  {
    campaignName: 'Drawdown Income Sustainability',
    roundNumber: 3,
    scheduledDate: new Date('2025-10-15T09:00:00Z'),
    scheduledTime: '09:00',
    listName: 'drawdown-users',
    listId: BigInt(0),
    recipientCount: 1500,
    recipientRange: 'Users',
    mailjetDraftId: BigInt(0),
    subject: 'Drawdown Income Sustainability',
    senderName: 'Digital Clipboard',
    senderEmail: 'noreply@digitalclipboard.com',
    status: 'SCHEDULED' as const,
    notificationStatus: {}
  }
];

async function populate() {
  console.log('🚀 Populating Q4 2025 campaigns...\n');

  for (const campaign of campaigns) {
    try {
      await prisma.lifecycleCampaignSchedule.create({
        data: campaign
      });
      console.log(`✅ Created: ${campaign.campaignName} - Round ${campaign.roundNumber}`);
    } catch (error) {
      console.error(`❌ Failed: ${campaign.campaignName} - Round ${campaign.roundNumber}`, error);
    }
  }

  console.log('\n✨ Done!');
  await prisma.$disconnect();
}

populate().catch(console.error);
