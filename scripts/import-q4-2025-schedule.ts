/**
 * Import Q4 2025 Marketing Schedule
 * Creates lifecycle campaigns for all planned releases
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Q4 2025 Marketing Schedule from docs
const q4Schedule = [
  {
    name: 'Client Letter Automation',
    releaseDate: '2025-09-19',
    theme: 'Time-saving features',
    keyMessages: [
      'Automated client correspondence saves 2+ hours per adviser per week',
      'One-click generation from meeting notes to final letter',
      'Maintains compliance while personalizing communication',
      'Seamless Salesforce integration for client data'
    ],
    channels: ['Email: Product announcement', 'Release Notes', 'LinkedIn', 'Partner Update'],
    targetAudience: 'Active advisers using DC for annual reviews',
    successMetrics: [
      'Email open rate > 30%',
      'Feature activation rate > 20% within first week',
      'Support tickets < 10 for feature setup'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Drawdown Income Sustainability',
    releaseDate: '2025-10-01',
    theme: 'Financial planning tools',
    keyMessages: [
      'Comprehensive drawdown planning tools',
      'Income sustainability calculations automated',
      'Risk assessment integrated into review process',
      'Regulatory-compliant documentation'
    ],
    channels: [
      'Email: Feature announcement',
      'Webinar: "Mastering Drawdown Reviews" (October 3rd)',
      'Release Notes',
      'Case Study'
    ],
    targetAudience: 'Advisers managing retirement clients',
    successMetrics: [
      'Webinar attendance > 50 advisers',
      'Feature usage by > 30% of applicable clients',
      'Time saved per drawdown review > 45 minutes'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Voyant Integration',
    releaseDate: '2025-10-15',
    theme: 'Enhanced integrations',
    keyMessages: [
      'Seamless cashflow planning integration',
      'Bi-directional data sync with Voyant',
      'Eliminate duplicate data entry',
      'Enhanced financial planning capabilities'
    ],
    channels: [
      'Email: Integration announcement',
      'Partner Co-marketing: Joint announcement with Voyant',
      'Technical Documentation',
      'Video Tutorial'
    ],
    targetAudience: 'Existing Voyant users',
    successMetrics: [
      'Integration activations > 25',
      'Data sync success rate > 95%',
      'User satisfaction score > 4.5/5'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Management Information',
    releaseDate: '2025-10-29',
    theme: 'Analytics & insights',
    keyMessages: [
      'Real-time business intelligence dashboards',
      'Track adviser productivity and compliance',
      'Identify trends and opportunities',
      'Data-driven decision making'
    ],
    channels: [
      'Email: MI feature launch',
      'Demo Session: Live dashboard walkthrough',
      'Release Notes',
      'Blog Post: "Data-Driven Practice Management"'
    ],
    targetAudience: 'Practice owners and management',
    successMetrics: [
      'Dashboard login frequency > 3x per week',
      'Custom report creation > 10 per practice',
      'Time saved on reporting > 5 hours/month'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Client Material Tool Kit',
    releaseDate: '2025-11-12',
    theme: 'Client engagement',
    keyMessages: [
      'Professional client-facing materials',
      'Customizable to your brand',
      'Educate clients on digital review process',
      'Reduce client onboarding friction'
    ],
    channels: [
      'Email: Toolkit launch announcement',
      'Resource Hub: Downloadable materials',
      'Partner Portal',
      'Adviser Forum'
    ],
    targetAudience: 'Advisers onboarding new clients',
    successMetrics: [
      'Toolkit downloads > 100',
      'Material customization rate > 60%',
      'Client onboarding time reduction'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Compliance Corner',
    releaseDate: '2025-11-26',
    theme: 'Regulatory support',
    keyMessages: [
      'FCA and Consumer Duty alignment',
      'Automated compliance documentation',
      'Audit trail and risk scoring',
      'Peace of mind for advisers'
    ],
    channels: [
      'Email: Compliance feature update',
      'Webinar: "Meeting Consumer Duty with DC"',
      'Compliance Guide: Downloadable PDF',
      'Partner Updates'
    ],
    targetAudience: 'Compliance officers',
    successMetrics: [
      'Compliance guide downloads > 75',
      'Webinar attendance > 40',
      'Audit preparation time reduction'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Case Study',
    releaseDate: '2025-12-10',
    theme: 'Success stories',
    keyMessages: [
      'Real adviser success stories',
      'Measurable ROI and time savings',
      'Peer validation and best practices',
      'Implementation lessons learned'
    ],
    channels: [
      'Email: Case study announcement',
      'PDF: Detailed case study document',
      'Video: Adviser testimonial',
      'LinkedIn: Success story post'
    ],
    targetAudience: 'Prospective clients',
    successMetrics: [
      'Case study views > 200',
      'Share rate > 15%',
      'Lead generation from case study'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  },
  {
    name: 'Year in Review',
    releaseDate: '2025-12-17',
    theme: 'Annual wrap-up',
    keyMessages: [
      '2025 achievements and milestones',
      'Client success metrics',
      'Product evolution journey',
      '2026 roadmap preview'
    ],
    channels: [
      'Email: CEO year-end message',
      'Blog: Comprehensive year review',
      'Video: Year in review montage',
      'Partner Communication'
    ],
    targetAudience: 'All DC users and partners',
    successMetrics: [
      'Email open rate > 40%',
      'Video views > 500',
      'Social engagement rate > 5%'
    ],
    mailjetTemplateId: 123456 // TODO: Update with actual template
    
  }
];

async function importSchedule() {
  console.log('🚀 Importing Q4 2025 Marketing Schedule...\n');

  let imported = 0;
  let errors = 0;

  for (const release of q4Schedule) {
    try {
      console.log(`📅 Creating campaign: ${release.name}`);
      console.log(`   Release Date: ${release.releaseDate}`);
      console.log(`   Theme: ${release.theme}`);
      console.log(`   Stakeholder Model: Leadership (1,000) → Compliance (500) → Users (1,500)`);

      // Parse release date
      const releaseDate = new Date(release.releaseDate);

      // Calculate 3-round schedule (weekly intervals)
      const round1Date = new Date(releaseDate);
      const round2Date = new Date(releaseDate);
      round2Date.setDate(round2Date.getDate() + 7);
      const round3Date = new Date(releaseDate);
      round3Date.setDate(round3Date.getDate() + 14);

      // Stakeholder segmentation model: ~3,000 total recipients
      const round1Recipients = 1000;  // Leadership
      const round2Recipients = 500;   // Compliance
      const round3Recipients = 1500;  // Users

      // Create 3 campaign schedules with stakeholder segmentation
      const rounds = [
        {
          campaign_name: release.name,
          round_number: 1,
          scheduled_date: round1Date,
          scheduled_time: '09:00',
          list_id_prefix: release.name.toLowerCase().replace(/\s+/g, '-'),
          stakeholder_group: 'Leadership',
          mailjet_list_name: `${release.name} - Leadership`,
          mailjet_list_id: null, // TODO: Create MailJet lists
          mailjet_template_id: release.mailjetTemplateId,
          recipient_count: round1Recipients,
          subject_line: `[Leadership] ${release.name}`,
          sender_name: 'Digital Clipboard',
          sender_email: 'hello@digitalclipboard.com',
          notification_channel: '#_traction',
          status: 'SCHEDULED' as const,
          theme: release.theme,
          key_messages: release.keyMessages,
          channels: release.channels,
          target_audience: 'Leadership - Practice owners, partners, senior management',
          success_metrics: release.successMetrics
        },
        {
          campaign_name: release.name,
          round_number: 2,
          scheduled_date: round2Date,
          scheduled_time: '09:00',
          list_id_prefix: release.name.toLowerCase().replace(/\s+/g, '-'),
          stakeholder_group: 'Compliance',
          mailjet_list_name: `${release.name} - Compliance`,
          mailjet_list_id: null, // TODO: Create MailJet lists
          mailjet_template_id: release.mailjetTemplateId,
          recipient_count: round2Recipients,
          subject_line: `[Compliance] ${release.name}`,
          sender_name: 'Digital Clipboard',
          sender_email: 'hello@digitalclipboard.com',
          notification_channel: '#_traction',
          status: 'SCHEDULED' as const,
          theme: release.theme,
          key_messages: release.keyMessages,
          channels: release.channels,
          target_audience: 'Compliance - Compliance officers, operations managers',
          success_metrics: release.successMetrics
        },
        {
          campaign_name: release.name,
          round_number: 3,
          scheduled_date: round3Date,
          scheduled_time: '09:00',
          list_id_prefix: release.name.toLowerCase().replace(/\s+/g, '-'),
          stakeholder_group: 'Users',
          mailjet_list_name: `${release.name} - Users`,
          mailjet_list_id: null, // TODO: Create MailJet lists
          mailjet_template_id: release.mailjetTemplateId,
          recipient_count: round3Recipients,
          subject_line: `${release.name}`,
          sender_name: 'Digital Clipboard',
          sender_email: 'hello@digitalclipboard.com',
          notification_channel: '#_traction',
          status: 'SCHEDULED' as const,
          theme: release.theme,
          key_messages: release.keyMessages,
          channels: release.channels,
          target_audience: 'Users - Active advisers, PAs, end users',
          success_metrics: release.successMetrics
        }
      ];

      // Insert all 3 rounds
      for (const round of rounds) {
        await prisma.lifecycleCampaignSchedule.create({
          data: round as any
        });
      }

      console.log(`   ✅ Created 3 rounds:`);
      console.log(`      Round 1 (Leadership): ${round1Date.toISOString().split('T')[0]} - ${round1Recipients} recipients`);
      console.log(`      Round 2 (Compliance): ${round2Date.toISOString().split('T')[0]} - ${round2Recipients} recipients`);
      console.log(`      Round 3 (Users): ${round3Date.toISOString().split('T')[0]} - ${round3Recipients} recipients\n`);
      imported++;

    } catch (error) {
      console.error(`   ❌ Error creating ${release.name}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Import Summary');
  console.log('================');
  console.log(`✅ Successfully imported: ${imported} campaigns (${imported * 3} rounds)`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📅 Total scheduled notifications: ${imported * 3 * 5} (5 per round)`);
  console.log(`📢 #_traction channel will receive ${imported * 3 * 5} automated messages`);

  await prisma.$disconnect();
}

// Run import
importSchedule().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
