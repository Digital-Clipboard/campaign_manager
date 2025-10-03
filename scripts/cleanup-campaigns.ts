/**
 * Cleanup all lifecycle campaign schedules
 * Run before repopulating with correct 4-round structure
 */

import { prisma } from '../src/lib/prisma';

async function cleanup() {
  console.log('🗑️  Clearing all lifecycle campaign schedules...');

  const deleted = await prisma.lifecycleCampaignSchedule.deleteMany({});

  console.log(`✅ Deleted ${deleted.count} records`);
  await prisma.$disconnect();
}

cleanup().catch(console.error);
