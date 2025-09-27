import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seed...');

  // Create sample team members
  const teamMembers = await Promise.all([
    prisma.teamMember.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        email: 'alice@example.com',
        name: 'Alice Johnson',
        role: 'Marketing Manager',
        skills: ['campaign planning', 'content strategy', 'analytics'],
        timezone: 'America/New_York',
        availability: {
          monday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'America/New_York' },
          tuesday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'America/New_York' },
          wednesday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'America/New_York' },
          thursday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'America/New_York' },
          friday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'America/New_York' },
          saturday: { available: false, timeZone: 'America/New_York' },
          sunday: { available: false, timeZone: 'America/New_York' }
        },
        maxConcurrent: 3
      }
    }),

    prisma.teamMember.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        email: 'bob@example.com',
        name: 'Bob Smith',
        role: 'Content Creator',
        skills: ['copywriting', 'design', 'video production'],
        timezone: 'America/Los_Angeles',
        availability: {
          monday: { available: true, startTime: '08:00', endTime: '16:00', timeZone: 'America/Los_Angeles' },
          tuesday: { available: true, startTime: '08:00', endTime: '16:00', timeZone: 'America/Los_Angeles' },
          wednesday: { available: true, startTime: '08:00', endTime: '16:00', timeZone: 'America/Los_Angeles' },
          thursday: { available: true, startTime: '08:00', endTime: '16:00', timeZone: 'America/Los_Angeles' },
          friday: { available: true, startTime: '08:00', endTime: '16:00', timeZone: 'America/Los_Angeles' },
          saturday: { available: false, timeZone: 'America/Los_Angeles' },
          sunday: { available: false, timeZone: 'America/Los_Angeles' }
        },
        maxConcurrent: 5
      }
    }),

    prisma.teamMember.upsert({
      where: { email: 'carol@example.com' },
      update: {},
      create: {
        email: 'carol@example.com',
        name: 'Carol Davis',
        role: 'Approval Manager',
        skills: ['compliance review', 'legal review', 'brand guidelines'],
        timezone: 'Europe/London',
        availability: {
          monday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' },
          tuesday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' },
          wednesday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' },
          thursday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' },
          friday: { available: true, startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' },
          saturday: { available: false, timeZone: 'Europe/London' },
          sunday: { available: false, timeZone: 'Europe/London' }
        },
        maxConcurrent: 2
      }
    })
  ]);

  logger.info(`Created ${teamMembers.length} team members`);

  // Create a sample campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Q1 Product Launch Campaign',
      type: 'product_launch',
      status: 'planning',
      targetDate: new Date('2025-03-01T00:00:00Z'),
      objectives: [
        'Increase brand awareness by 30%',
        'Generate 1000+ qualified leads',
        'Achieve 15% conversion rate'
      ],
      priority: 'high',
      budget: 50000,
      readinessScore: 25
    }
  });

  // Create timeline for the campaign
  const timeline = await prisma.timeline.upsert({
    where: { campaignId: campaign.id },
    update: {},
    create: {
      campaignId: campaign.id,
      template: 'product_launch',
      milestones: [
        {
          id: 'milestone-1',
          name: 'Content Planning',
          description: 'Complete content strategy and planning',
          dueDate: '2025-02-01T00:00:00Z',
          status: 'pending',
          dependencies: [],
          tasks: ['task-1', 'task-2']
        },
        {
          id: 'milestone-2',
          name: 'Content Creation',
          description: 'Create all campaign assets',
          dueDate: '2025-02-15T00:00:00Z',
          status: 'pending',
          dependencies: ['milestone-1'],
          tasks: ['task-3', 'task-4']
        },
        {
          id: 'milestone-3',
          name: 'Review & Approval',
          description: 'Review and approve all content',
          dueDate: '2025-02-22T00:00:00Z',
          status: 'pending',
          dependencies: ['milestone-2'],
          tasks: ['task-5']
        },
        {
          id: 'milestone-4',
          name: 'Campaign Launch',
          description: 'Execute campaign launch',
          dueDate: '2025-03-01T00:00:00Z',
          status: 'pending',
          dependencies: ['milestone-3'],
          tasks: ['task-6']
        }
      ],
      criticalPath: ['task-1', 'task-3', 'task-5', 'task-6'],
      buffer: 72, // 3 days buffer
      estimatedHours: 120
    }
  });

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        id: 'task-1',
        campaignId: campaign.id,
        title: 'Develop Content Strategy',
        description: 'Create comprehensive content strategy for product launch',
        assigneeId: teamMembers[0].id,
        dueDate: new Date('2025-01-30T17:00:00Z'),
        priority: 'high',
        status: 'assigned',
        dependencies: [],
        estimatedHours: 16,
        actualHours: 0,
        tags: ['strategy', 'planning']
      }
    }),

    prisma.task.create({
      data: {
        id: 'task-2',
        campaignId: campaign.id,
        title: 'Research Target Audience',
        description: 'Conduct research on target audience preferences and behavior',
        assigneeId: teamMembers[0].id,
        dueDate: new Date('2025-01-31T17:00:00Z'),
        priority: 'medium',
        status: 'assigned',
        dependencies: [],
        estimatedHours: 12,
        actualHours: 0,
        tags: ['research', 'audience']
      }
    }),

    prisma.task.create({
      data: {
        id: 'task-3',
        campaignId: campaign.id,
        title: 'Create Campaign Visuals',
        description: 'Design all visual assets for the campaign',
        assigneeId: teamMembers[1].id,
        dueDate: new Date('2025-02-10T17:00:00Z'),
        priority: 'high',
        status: 'pending',
        dependencies: ['task-1'],
        estimatedHours: 24,
        actualHours: 0,
        tags: ['design', 'visuals']
      }
    })
  ]);

  // Create sample approvals
  await prisma.approval.create({
    data: {
      campaignId: campaign.id,
      stage: 'content',
      approverId: teamMembers[2].id,
      status: 'pending',
      deadline: new Date('2025-02-20T17:00:00Z'),
      urgency: 'normal',
      autoApprove: false
    }
  });

  // Create campaign team assignments
  await Promise.all([
    prisma.campaignTeamMember.create({
      data: {
        campaignId: campaign.id,
        memberId: teamMembers[0].id,
        role: 'owner'
      }
    }),
    prisma.campaignTeamMember.create({
      data: {
        campaignId: campaign.id,
        memberId: teamMembers[1].id,
        role: 'contributor'
      }
    }),
    prisma.campaignTeamMember.create({
      data: {
        campaignId: campaign.id,
        memberId: teamMembers[2].id,
        role: 'approver'
      }
    })
  ]);

  logger.info(`Created campaign: ${campaign.name}`);
  logger.info(`Created timeline with ${timeline.milestones.length} milestones`);
  logger.info(`Created ${tasks.length} tasks`);
  logger.info('Database seed completed successfully!');
}

main()
  .catch((e) => {
    logger.error('Seed failed', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });