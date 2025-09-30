#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function populateWeekSchedule() {
  const scheduleData = [
    // ============ TUESDAY CAMPAIGN (Round 2) ============
    // Monday 3am UTC (4am London): Pre-notification
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'monday',
      scheduledDate: new Date('2025-09-29T03:00:00Z'), // 3am UTC (4am London)
      time: '03:00',
      activityType: 'preparation',
      name: 'Client Letter Round 2 - Tomorrow Notification',
      roundNumber: 2,
      recipientCount: 1000,
      segment: 'Users 1,001-2,000',
      details: 'Pre-notification to #_traction channel for tomorrow\'s campaign',
      status: 'scheduled'
    },
    // Tuesday 6am UTC (7am London): Pre-launch checks
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'tuesday',
      scheduledDate: new Date('2025-09-30T06:00:00Z'), // 6am UTC (7am London)
      time: '06:00',
      activityType: 'preparation',
      name: 'Client Letter Round 2 - Pre-Launch Checks',
      roundNumber: 2,
      recipientCount: 1000,
      segment: 'Users 1,001-2,000',
      details: 'Final system checks before campaign launch',
      status: 'scheduled'
    },
    // Tuesday 8:45am UTC (9:45am London): 15-minute countdown
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'tuesday',
      scheduledDate: new Date('2025-09-30T08:45:00Z'), // 8:45am UTC (9:45am London)
      time: '08:45',
      activityType: 'preparation',
      name: 'Client Letter Round 2 - 15 Minute Warning',
      roundNumber: 2,
      recipientCount: 1000,
      segment: 'Users 1,001-2,000',
      details: 'Campaign launching in 15 minutes notification',
      status: 'scheduled'
    },
    // Tuesday 9:00am UTC (10:00am London): Campaign launch
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'tuesday',
      scheduledDate: new Date('2025-09-30T09:00:00Z'), // 9:00am UTC (10:00am London)
      time: '09:00',
      activityType: 'launch',
      name: 'Client Letter Round 2 - Campaign Launch',
      roundNumber: 2,
      recipientCount: 1000,
      segment: 'Users 1,001-2,000',
      details: 'Execute email campaign for second 1000 users',
      status: 'scheduled'
    },
    // Tuesday 10:30am UTC (11:30am London): Post-launch stats (90 min after launch, when send is complete)
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'tuesday',
      scheduledDate: new Date('2025-09-30T10:30:00Z'), // 10:30am UTC (11:30am London)
      time: '10:30',
      activityType: 'review',
      name: 'Client Letter Round 2 - Initial Stats Report',
      roundNumber: 2,
      recipientCount: 1000,
      segment: 'Users 1,001-2,000',
      details: 'Post-launch statistics with live MailJet data: hard bounces, delivery confirmation, immediate reactions',
      status: 'scheduled'
    },

    // ============ THURSDAY CAMPAIGN (Round 3) ============
    // Wednesday 3am UTC (4am London): Pre-notification
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'wednesday',
      scheduledDate: new Date('2025-10-01T03:00:00Z'), // 3am UTC (4am London)
      time: '03:00',
      activityType: 'preparation',
      name: 'Client Letter Round 3 - Tomorrow Notification',
      roundNumber: 3,
      recipientCount: 1000,
      segment: 'Users 2,001+',
      details: 'Pre-notification to #_traction channel for tomorrow\'s campaign',
      status: 'scheduled'
    },
    // Thursday 6am UTC (7am London): Pre-launch checks
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'thursday',
      scheduledDate: new Date('2025-10-02T06:00:00Z'), // 6am UTC (7am London)
      time: '06:00',
      activityType: 'preparation',
      name: 'Client Letter Round 3 - Pre-Launch Checks',
      roundNumber: 3,
      recipientCount: 1000,
      segment: 'Users 2,001+',
      details: 'Final system checks before campaign launch',
      status: 'scheduled'
    },
    // Thursday 8:45am UTC (9:45am London): 15-minute countdown
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'thursday',
      scheduledDate: new Date('2025-10-02T08:45:00Z'), // 8:45am UTC (9:45am London)
      time: '08:45',
      activityType: 'preparation',
      name: 'Client Letter Round 3 - 15 Minute Warning',
      roundNumber: 3,
      recipientCount: 1000,
      segment: 'Users 2,001+',
      details: 'Campaign launching in 15 minutes notification',
      status: 'scheduled'
    },
    // Thursday 9:00am UTC (10:00am London): Campaign launch
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'thursday',
      scheduledDate: new Date('2025-10-02T09:00:00Z'), // 9:00am UTC (10:00am London)
      time: '09:00',
      activityType: 'launch',
      name: 'Client Letter Round 3 - Campaign Launch',
      roundNumber: 3,
      recipientCount: 1000,
      segment: 'Users 2,001+',
      details: 'Execute email campaign for remaining users',
      status: 'scheduled'
    },
    // Thursday 10:30am UTC (11:30am London): Post-launch stats (90 min after launch, when send is complete)
    {
      weekNumber: 40,
      year: 2025,
      dayOfWeek: 'thursday',
      scheduledDate: new Date('2025-10-02T10:30:00Z'), // 10:30am UTC (11:30am London)
      time: '10:30',
      activityType: 'review',
      name: 'Client Letter Round 3 - Initial Stats Report',
      roundNumber: 3,
      recipientCount: 1000,
      segment: 'Users 2,001+',
      details: 'Post-launch statistics with live MailJet data: hard bounces, delivery confirmation, immediate reactions',
      status: 'scheduled'
    }
  ];

  console.log('Populating campaign schedule for Week 40, 2025...');
  console.log(`Total activities to insert: ${scheduleData.length}`);

  try {
    // Clear existing schedules for this week to avoid duplicates
    const deleted = await prisma.campaignSchedule.deleteMany({
      where: {
        weekNumber: 40,
        year: 2025
      }
    });
    console.log(`Deleted ${deleted.count} existing schedule entries for Week 40`);

    // Insert new schedule data
    const result = await prisma.campaignSchedule.createMany({
      data: scheduleData,
      skipDuplicates: true
    });

    console.log(`Successfully inserted ${result.count} schedule entries`);

    // Verify the data
    const schedules = await prisma.campaignSchedule.findMany({
      where: {
        weekNumber: 40,
        year: 2025
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { time: 'asc' }
      ]
    });

    console.log('\nScheduled activities for this week:');
    schedules.forEach(schedule => {
      const date = new Date(schedule.scheduledDate);
      console.log(`  ${schedule.dayOfWeek.toUpperCase()} ${schedule.time}: ${schedule.name}`);
      console.log(`    Round: ${schedule.roundNumber}, Recipients: ${schedule.recipientCount}, Status: ${schedule.status}`);
    });

    console.log('\n✅ Campaign schedule populated successfully!');
    console.log('The system will automatically send notifications at the scheduled times.');

  } catch (error) {
    console.error('Error populating schedule:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

populateWeekSchedule();