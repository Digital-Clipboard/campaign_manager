#!/usr/bin/env node

const axios = require('axios');

const CAMPAIGN_MANAGER_URL = 'http://localhost:3007';

const q4_2025_campaigns = [
  {
    date: '2025-09-19',
    name: 'Client Letter Automation',
    theme: 'Time-saving features',
    activityType: 'Product Release',
    description: 'Automated client correspondence saves 2+ hours per adviser per week. One-click generation from meeting notes to final letter. Maintains compliance while personalizing communication. Seamless Salesforce integration for client data.',
    keyMessages: [
      'Automated client correspondence saves 2+ hours per adviser per week',
      'One-click generation from meeting notes to final letter',
      'Maintains compliance while personalizing communication',
      'Seamless Salesforce integration for client data'
    ],
    channels: ['Email: Product announcement (Tuesday 10am)', 'Release Notes', 'LinkedIn', 'Partner Update'],
    successMetrics: ['Email open rate > 30%', 'Feature activation rate > 20% within first week', 'Support tickets < 10 for feature setup']
  },
  {
    date: '2025-10-01',
    name: 'Drawdown Income Sustainability',
    theme: 'Financial planning tools',
    activityType: 'Product Release',
    description: 'Comprehensive drawdown planning tools. Income sustainability calculations automated. Risk assessment integrated into review process. Regulatory-compliant documentation.',
    keyMessages: [
      'Comprehensive drawdown planning tools',
      'Income sustainability calculations automated',
      'Risk assessment integrated into review process',
      'Regulatory-compliant documentation'
    ],
    channels: ['Email: Feature announcement', 'Webinar: "Mastering Drawdown Reviews" (October 3rd)', 'Release Notes', 'Case Study'],
    successMetrics: ['Webinar attendance > 50 advisers', 'Feature usage by > 30% of applicable clients', 'Time saved per drawdown review > 45 minutes']
  },
  {
    date: '2025-10-15',
    name: 'Voyant Integration',
    theme: 'Enhanced integrations',
    activityType: 'Product Release',
    description: 'Seamless cashflow planning integration. Bi-directional data sync with Voyant. Eliminate duplicate data entry. Enhanced financial planning capabilities.',
    keyMessages: [
      'Seamless cashflow planning integration',
      'Bi-directional data sync with Voyant',
      'Eliminate duplicate data entry',
      'Enhanced financial planning capabilities'
    ],
    channels: ['Email: Integration announcement', 'Partner Co-marketing: Joint announcement with Voyant', 'Technical Documentation', 'Video Tutorial'],
    successMetrics: ['Integration activations > 25', 'Data sync success rate > 95%', 'User satisfaction score > 4.5/5']
  },
  {
    date: '2025-10-29',
    name: 'Management Information',
    theme: 'Analytics & insights',
    activityType: 'Product Release',
    description: 'Real-time business intelligence dashboards. Track adviser productivity and compliance. Identify trends and opportunities. Data-driven decision making.',
    keyMessages: [
      'Real-time business intelligence dashboards',
      'Track adviser productivity and compliance',
      'Identify trends and opportunities',
      'Data-driven decision making'
    ],
    channels: ['Email: MI feature launch', 'Demo Session: Live dashboard walkthrough', 'Release Notes', 'Blog Post: "Data-Driven Practice Management"'],
    successMetrics: ['Dashboard login frequency > 3x per week', 'Custom report creation > 10 per practice', 'Time saved on reporting > 5 hours/month']
  },
  {
    date: '2025-11-12',
    name: 'Client Material Tool Kit',
    theme: 'Client engagement',
    activityType: 'Product Release',
    description: 'Professional client-facing materials. Customizable to your brand. Educate clients on digital review process. Reduce client onboarding friction.',
    keyMessages: [
      'Professional client-facing materials',
      'Customizable to your brand',
      'Educate clients on digital review process',
      'Reduce client onboarding friction'
    ],
    channels: ['Email: Toolkit launch announcement', 'Resource Hub: Downloadable materials', 'Partner Portal', 'Adviser Forum'],
    successMetrics: ['Toolkit downloads > 100', 'Material customization rate > 60%', 'Client onboarding time reduction']
  },
  {
    date: '2025-11-26',
    name: 'Compliance Corner',
    theme: 'Regulatory support',
    activityType: 'Product Release',
    description: 'FCA and Consumer Duty alignment. Automated compliance documentation. Audit trail and risk scoring. Peace of mind for advisers.',
    keyMessages: [
      'FCA and Consumer Duty alignment',
      'Automated compliance documentation',
      'Audit trail and risk scoring',
      'Peace of mind for advisers'
    ],
    channels: ['Email: Compliance feature update', 'Webinar: "Meeting Consumer Duty with DC"', 'Compliance Guide', 'Partner Updates'],
    successMetrics: ['Compliance guide downloads > 75', 'Webinar attendance > 40', 'Audit preparation time reduction']
  },
  {
    date: '2025-12-10',
    name: 'Case Study',
    theme: 'Success stories',
    activityType: 'Product Release',
    description: 'Real adviser success stories. Measurable ROI and time savings. Peer validation and best practices. Implementation lessons learned.',
    keyMessages: [
      'Real adviser success stories',
      'Measurable ROI and time savings',
      'Peer validation and best practices',
      'Implementation lessons learned'
    ],
    channels: ['Email: Case study announcement', 'PDF: Detailed case study document', 'Video: Adviser testimonial', 'LinkedIn'],
    successMetrics: ['Case study views > 200', 'Share rate > 15%', 'Lead generation from case study']
  },
  {
    date: '2025-12-17',
    name: 'Year in Review',
    theme: 'Annual wrap-up',
    activityType: 'Product Release',
    description: '2025 achievements and milestones. Client success metrics. Product evolution journey. 2026 roadmap preview.',
    keyMessages: [
      '2025 achievements and milestones',
      'Client success metrics',
      'Product evolution journey',
      '2026 roadmap preview'
    ],
    channels: ['Email: CEO year-end message', 'Blog: Comprehensive year review', 'Video: Year in review montage', 'Partner Communication'],
    successMetrics: ['Email open rate > 40%', 'Video views > 500', 'Social engagement rate > 5%']
  }
];

const biweeklyCampaigns2025 = [
  { week: 2, date: '2025-01-13', name: 'New Year Kickoff', theme: 'Goals & Planning' },
  { week: 4, date: '2025-01-27', name: 'Q1 Product Update', theme: 'Features & Benefits' },
  { week: 6, date: '2025-02-10', name: 'Valentine\'s Special', theme: 'Client Appreciation' },
  { week: 8, date: '2025-02-24', name: 'Tax Season Tips', theme: 'Financial Planning' },
  { week: 10, date: '2025-03-10', name: 'Spring Forward', theme: 'Growth Strategies' },
  { week: 12, date: '2025-03-24', name: 'Q1 Review', theme: 'Performance & Insights' },
  { week: 14, date: '2025-04-07', name: 'Easter Edition', theme: 'Renewal & Refresh' },
  { week: 16, date: '2025-04-21', name: 'Earth Day Focus', theme: 'Sustainable Investing' },
  { week: 18, date: '2025-05-05', name: 'May Momentum', theme: 'Market Updates' },
  { week: 20, date: '2025-05-19', name: 'Mid-Year Preview', theme: 'Strategic Planning' },
  { week: 22, date: '2025-06-02', name: 'Summer Strategy', theme: 'Vacation Planning' },
  { week: 24, date: '2025-06-16', name: 'Q2 Review', theme: 'Quarterly Analysis' },
  { week: 26, date: '2025-06-30', name: 'Half-Year Highlights', theme: 'Achievements' },
  { week: 28, date: '2025-07-14', name: 'Summer Series', theme: 'Educational Content' },
  { week: 30, date: '2025-07-28', name: 'August Preview', theme: 'Upcoming Changes' },
  { week: 32, date: '2025-08-11', name: 'Back to Business', theme: 'Post-Summer Focus' },
  { week: 34, date: '2025-08-25', name: 'September Prep', theme: 'Fall Planning' },
  { week: 36, date: '2025-09-08', name: 'Autumn Advantage', theme: 'Q4 Preparation' },
  { week: 38, date: '2025-09-22', name: 'Q3 Review', theme: 'Performance Check' },
  { week: 40, date: '2025-10-06', name: 'October Insights', theme: 'Market Analysis' },
  { week: 42, date: '2025-10-20', name: 'Halloween Special', theme: 'Risk Management' },
  { week: 44, date: '2025-11-03', name: 'Gratitude Edition', theme: 'Client Thanks' },
  { week: 46, date: '2025-11-17', name: 'Black Friday', theme: 'Special Offers' },
  { week: 48, date: '2025-12-01', name: 'Holiday Season', theme: 'Festive Planning' },
  { week: 50, date: '2025-12-15', name: 'Year-End Review', theme: 'Annual Recap' },
  { week: 52, date: '2025-12-29', name: 'New Year Preview', theme: '2026 Outlook' }
];

function parseDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const time = '10:00'; // Standard 10:00 AM send time

  return {
    scheduledDate: date,
    year,
    weekNumber,
    dayOfWeek,
    time
  };
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function scheduleActivity(activityData) {
  try {
    const response = await axios.post(`${CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'scheduleActivity',
      params: activityData
    });

    if (response.data.success) {
      console.log(`✅ Scheduled: ${activityData.name} for ${activityData.scheduledDate.toISOString().split('T')[0]}`);
      return true;
    } else {
      console.error(`❌ Failed to schedule: ${activityData.name} - ${response.data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error scheduling ${activityData.name}:`, error.message);
    return false;
  }
}

async function importQ4Campaigns() {
  console.log('\n🚀 Importing Q4 2025 Product Release Campaigns...\n');

  let successCount = 0;

  for (const campaign of q4_2025_campaigns) {
    const dateInfo = parseDate(campaign.date);

    const activityData = {
      weekNumber: dateInfo.weekNumber,
      year: dateInfo.year,
      dayOfWeek: dateInfo.dayOfWeek,
      scheduledDate: dateInfo.scheduledDate,
      time: dateInfo.time,
      activityType: campaign.activityType,
      name: campaign.name,
      description: campaign.description,
      theme: campaign.theme,
      keyMessages: campaign.keyMessages.join('; '),
      channels: campaign.channels.join('; '),
      successMetrics: campaign.successMetrics.join('; '),
      status: 'Planned',
      priority: 'High',
      estimatedDuration: 120,
      assignedTo: 'Marketing Team',
      notes: `Product release campaign with detailed messaging and success metrics. Target audience includes active advisers and practice owners.`,
      tags: ['product-release', 'q4-2025', campaign.theme.toLowerCase().replace(/[^a-z0-9]/g, '-')]
    };

    const success = await scheduleActivity(activityData);
    if (success) successCount++;

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Q4 Campaigns: ${successCount}/${q4_2025_campaigns.length} imported successfully\n`);
  return successCount;
}

async function importBiweeklyCampaigns() {
  console.log('📅 Importing Bi-Weekly Campaign Template for 2025...\n');

  let successCount = 0;

  for (const campaign of biweeklyCampaigns2025) {
    const dateInfo = parseDate(campaign.date);

    const activityData = {
      weekNumber: dateInfo.weekNumber,
      year: dateInfo.year,
      dayOfWeek: dateInfo.dayOfWeek,
      scheduledDate: dateInfo.scheduledDate,
      time: dateInfo.time,
      activityType: 'Bi-Weekly Campaign',
      name: campaign.name,
      description: `Bi-weekly campaign focused on ${campaign.theme}. Part of the structured 26-campaign annual schedule with 2-week sprint methodology.`,
      theme: campaign.theme,
      keyMessages: `Campaign messaging aligned with ${campaign.theme} theme`,
      channels: 'Email; Social Media; Release Notes; Partner Updates',
      successMetrics: 'Open rate > 25%; Click rate > 3%; Conversion rate > 2%',
      status: 'Planned',
      priority: 'Medium',
      estimatedDuration: 80,
      assignedTo: 'Campaign Team',
      notes: `Week ${campaign.week} of bi-weekly schedule. Standard 2-week sprint: Week 1 planning & development, Week 2 review & launch.`,
      tags: ['bi-weekly', `week-${campaign.week}`, campaign.theme.toLowerCase().replace(/[^a-z0-9]/g, '-')]
    };

    const success = await scheduleActivity(activityData);
    if (success) successCount++;

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`📊 Bi-Weekly Campaigns: ${successCount}/${biweeklyCampaigns2025.length} imported successfully\n`);
  return successCount;
}

async function verifyImport() {
  console.log('🔍 Verifying imported data...\n');

  try {
    const response = await axios.post(`${CAMPAIGN_MANAGER_URL}/mcp`, {
      tool: 'getWeekSchedule',
      params: {
        weekNumber: getWeekNumber(new Date()),
        year: 2025
      }
    });

    if (response.data.success) {
      const activities = response.data.data;
      console.log(`✅ Database connection successful`);
      console.log(`📈 Total activities in current week: ${activities.length}`);

      if (activities.length > 0) {
        console.log('\n📋 Sample activities:');
        activities.slice(0, 3).forEach(activity => {
          console.log(`   • ${activity.name} (${activity.activityType}) - ${activity.status}`);
        });
      }
    } else {
      console.log('⚠️ Could not verify data - database query failed');
    }
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

async function main() {
  console.log('🎯 Campaign Manager - Marketing Schedule Import Tool');
  console.log('==================================================\n');

  console.log(`📡 Connecting to Campaign Manager at ${CAMPAIGN_MANAGER_URL}`);

  try {
    const healthCheck = await axios.get(`${CAMPAIGN_MANAGER_URL}/health`);
    console.log('✅ Campaign Manager is running\n');
  } catch (error) {
    console.error('❌ Cannot connect to Campaign Manager. Please ensure it\'s running on port 3007');
    console.error('   Run: npm start');
    process.exit(1);
  }

  let totalImported = 0;

  totalImported += await importQ4Campaigns();
  totalImported += await importBiweeklyCampaigns();

  await verifyImport();

  console.log('\n🎉 Import Complete!');
  console.log('==================');
  console.log(`📊 Total campaigns imported: ${totalImported}`);
  console.log(`   • Q4 2025 Product Releases: 8 campaigns`);
  console.log(`   • Bi-Weekly Template: 26 campaigns`);
  console.log(`   • Coverage: Full year 2025 schedule`);

  console.log('\n🔗 Next Steps:');
  console.log('   1. Access dashboard: http://localhost:3000');
  console.log('   2. Test weekly summary generation');
  console.log('   3. Configure Heroku Scheduler for Monday 06:00 UTC');
  console.log('   4. Deploy dashboard to Vercel');

  console.log('\n📝 Weekly Summary Test:');
  console.log('   Use MCP tool: "generateWeeklySummary" to test Slack notifications');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  q4_2025_campaigns,
  biweeklyCampaigns2025,
  scheduleActivity,
  importQ4Campaigns,
  importBiweeklyCampaigns
};