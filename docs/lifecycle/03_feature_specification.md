# Automated Campaign Lifecycle Management

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: 🔄 In Development
- **Purpose**: Define automated campaign lifecycle with AI-powered notifications and monitoring

---

## Overview

This document specifies the complete automated lifecycle for campaign management, from pre-launch notifications through post-launch analysis. The system provides stakeholders with real-time visibility and AI-powered insights at every critical stage.

### Core Principle

**Split campaigns into thirds** - All campaigns are divided into three equal batches (Round 1, Round 2, Round 3) and sent on Tuesdays and Thursdays, with automated monitoring and AI assessment at each stage.

---

## Campaign Segmentation Strategy

### Batch Distribution Rules

```typescript
interface CampaignBatchStrategy {
  totalRecipients: number;
  batchCount: 3;
  batchSize: number; // Math.ceil(totalRecipients / 3)
  sendSchedule: 'Tuesday' | 'Thursday';
  sendTime: '09:15 UTC';
}
```

### Batch Scheduling Logic

```typescript
function calculateBatchSchedule(
  campaignStartDate: Date,
  totalRecipients: number
): BatchSchedule[] {
  const batchSize = Math.ceil(totalRecipients / 3);
  const batches: BatchSchedule[] = [];

  let currentDate = campaignStartDate;
  let startPosition = 0;

  for (let round = 1; round <= 3; round++) {
    const endPosition = round === 3
      ? totalRecipients
      : startPosition + batchSize;

    batches.push({
      round,
      recipientRange: `${startPosition + 1}-${endPosition}`,
      recipientCount: endPosition - startPosition,
      scheduledDate: currentDate,
      scheduledTime: '09:15 UTC'
    });

    // Move to next Tuesday or Thursday
    currentDate = getNextTuesdayOrThursday(currentDate);
    startPosition = endPosition;
  }

  return batches;
}
```

---

## Campaign Lifecycle Stages

### Stage 1: Pre-Launch Notification (T-21 hours)
**Trigger**: 3:00 PM UTC the day before launch (15:00 UTC)

#### Purpose
Provide stakeholders with advance notice of upcoming campaign, allowing time for final verification and preparation.

#### Notification Content
```typescript
interface PreLaunchNotification {
  timestamp: Date; // T-21 hours (3:00 PM UTC day before)
  campaignName: string;
  roundNumber: number;
  scheduledLaunchTime: Date; // 9:15 AM UTC next day
  recipientDetails: {
    listName: string;
    listId: number;
    recipientCount: number;
    recipientRange: string; // e.g., "1,001-2,000"
  };
  campaignAttributes: {
    subject: string;
    sender: string;
    senderEmail: string;
    contentPreview: string;
  };
  aiPreview: {
    expectedPerformance: string;
    audienceInsights: string;
    recommendations: string[];
  };
}
```

#### Slack Block Kit Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔 CAMPAIGN SCHEDULED FOR TOMORROW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 CAMPAIGN DETAILS
Campaign: Client Letters 2.0 Compliance Automated Live
Round: 2 of 3
Launch Time: Thursday, Oct 2 at 9:15 AM UTC (5:15 AM EDT)

👥 RECIPIENT DETAILS
List: campaign_batch_002
MailJet List ID: 10503118
Recipients: 1,000 users (positions 1,001-2,000)

✉️  EMAIL ATTRIBUTES
Subject: Client Letters 2.0 Compliance Automated Live
From: Digital Clipboard <support@digitalclipboard.com>
Content: HTML email with compliance update

🤖 AI PRE-LAUNCH ASSESSMENT
Expected Performance: Strong engagement expected based on Round 1 performance (24.5% open rate)
Audience: Active users with 30-90 day engagement history
Recommendations:
  • Monitor bounce rates closely (Round 1 had 24.66% bounce)
  • Best send time confirmed for this audience segment
  • Consider suppressing hard bounces from Round 1

⏰ NEXT STEPS
• 6:00 AM UTC: Pre-flight check and verification
• 9:00 AM UTC: 15-minute launch warning
• 9:15 AM UTC: Campaign launches
• 9:45 AM UTC: Post-launch wrap-up and AI assessment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Stage 2: Pre-Flight Check (T-3.25 hours)
**Trigger**: 6:00 AM UTC on launch day (0600 UTC)

#### Purpose
Verify all campaign components are ready and flag any discrepancies before launch.

#### Verification Checklist
```typescript
interface PreFlightChecklist {
  timestamp: Date; // 6:00 AM UTC
  campaignDraftId: number;
  checks: {
    listVerification: {
      listExists: boolean;
      subscriberCount: number;
      expectedCount: number;
      discrepancy: number | null;
      status: 'pass' | 'warning' | 'fail';
    };
    campaignSetup: {
      draftExists: boolean;
      contentLoaded: boolean;
      subjectLineSet: boolean;
      senderConfigured: boolean;
      recipientListAttached: boolean;
      status: 'pass' | 'fail';
    };
    technicalValidation: {
      linksValid: boolean;
      unsubscribeLinkPresent: boolean;
      trackingConfigured: boolean;
      spfDkimValid: boolean;
      status: 'pass' | 'warning' | 'fail';
    };
  };
  overallStatus: 'ready' | 'needs_attention' | 'blocked';
  aiAssessment: string;
}
```

#### Notification Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PRE-FLIGHT CHECK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Campaign: Client Letters 2.0 - Round 2
Launch: 9:15 AM UTC (in 3 hours 15 minutes)

📋 LIST VERIFICATION
✅ List Exists: campaign_batch_002 (ID: 10503118)
✅ Subscriber Count: 1,000
✅ Expected Count: 1,000
🟢 Status: PASS

📧 CAMPAIGN SETUP
✅ Campaign Draft: 14119635
✅ Content Loaded: HTML email (12.5 KB)
✅ Subject Line: "Client Letters 2.0 Compliance Automated Live"
✅ Sender: Digital Clipboard <support@digitalclipboard.com>
✅ Recipient List: Attached (campaign_batch_002)
🟢 Status: PASS

🔧 TECHNICAL VALIDATION
✅ Links Valid: All 3 links verified
✅ Unsubscribe Link: Present and functional
✅ Tracking: UTM parameters configured
⚠️  SPF/DKIM: Valid (warning: 24.66% bounce rate in Round 1)
🟡 Status: PASS WITH WARNINGS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 OVERALL STATUS: READY FOR LAUNCH

🤖 AI ASSESSMENT
Campaign is fully configured and ready for launch. All critical
components verified. Warning: High bounce rate from Round 1
suggests list hygiene needed post-campaign.

⏰ NEXT CHECKPOINT: 9:00 AM UTC (15-min launch warning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Stage 3: Launch Warning (T-15 minutes)
**Trigger**: 9:00 AM UTC on launch day (15 minutes before send)

#### Purpose
Final countdown notification to ensure stakeholders are aware of imminent launch.

#### Notification Content
```typescript
interface LaunchWarningNotification {
  timestamp: Date; // 9:00 AM UTC
  campaignName: string;
  roundNumber: number;
  launchTime: Date; // 9:15 AM UTC
  minutesUntilLaunch: 15;
  recipientCount: number;
  finalChecks: {
    preFlightStatus: 'pass' | 'warning' | 'fail';
    teamNotified: boolean;
    monitoringActive: boolean;
  };
}
```

#### Notification Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 15-MINUTE LAUNCH WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ Campaign launches in 15 minutes at 9:15 AM UTC

Campaign: Client Letters 2.0 - Round 2
Recipients: 1,000 users (campaign_batch_002)

✅ Pre-flight: PASSED
✅ Team: Notified
✅ Monitoring: Active

🔔 Stand by for launch confirmation at 9:15 AM UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Stage 4: Launch Confirmation (T+0)
**Trigger**: Immediately after campaign send initiated (9:15 AM UTC)

#### Purpose
Confirm campaign has been successfully launched and provide initial send statistics.

#### Notification Content
```typescript
interface LaunchConfirmationNotification {
  timestamp: Date; // 9:15 AM UTC
  campaignName: string;
  roundNumber: number;
  campaignId: number;
  recipientCount: number;
  initialStatus: {
    queued: number;
    processing: number;
    sent: number;
    failed: number;
  };
  estimatedDeliveryTime: Date;
}
```

#### Notification Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 CAMPAIGN LAUNCHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Campaign: Client Letters 2.0 - Round 2
Launch Time: 9:15 AM UTC
Campaign ID: 7758985090

📊 INITIAL STATUS
Queued: 1,000
Processing: 0
Sent: 0
Failed: 0

⏱️  Estimated delivery completion: 9:30 AM UTC

⏰ NEXT UPDATE: 9:45 AM UTC (post-launch wrap-up with AI assessment)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Stage 5: Post-Launch Wrap-Up (T+30 minutes)
**Trigger**: 30 minutes after launch (9:45 AM UTC)

#### Purpose
Provide comprehensive delivery statistics and AI-powered performance assessment.

#### Data Collection
```typescript
interface PostLaunchData {
  timestamp: Date; // 9:45 AM UTC
  campaignId: number;
  deliveryMetrics: {
    processed: number;
    delivered: number;
    bounced: number;
    hardBounces: number;
    softBounces: number;
    blocked: number;
    queued: number;
  };
  engagementMetrics: {
    opened: number;
    clicked: number;
    unsubscribed: number;
    complained: number;
  };
  comparisonToPreviousRound?: {
    deliveryRateDelta: number;
    bounceRateDelta: number;
    openRateDelta?: number;
  };
  aiAssessment: {
    overallHealth: 'excellent' | 'good' | 'concerning' | 'poor';
    listQuality: string;
    deliveryAnalysis: string;
    recommendations: string[];
    predictions: {
      expectedOpenRate: string;
      expectedClickRate: string;
      riskFactors: string[];
    };
  };
}
```

#### Notification Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 POST-LAUNCH WRAP-UP: Round 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Campaign: Client Letters 2.0 Compliance Automated Live
Campaign ID: 7758985090
Completed: 9:45 AM UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 DELIVERY METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Processed:  1,000
Delivered:    742 (74.2%)
Bounced:      258 (25.8%)
  ├─ Hard:    245 (24.5%)
  └─ Soft:     13 (1.3%)
Blocked:        0
Queued:         0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟡 Campaign Health: CONCERNING

List Quality Analysis:
High bounce rate (25.8%) indicates significant list quality
issues. Hard bounces suggest invalid email addresses or closed
accounts.

📊 ROUND COMPARISON
• Delivery Rate: -0.84% vs Round 1 (75.04% → 74.2%)
• Bounce Rate: +1.15% vs Round 1 (24.66% → 25.81%)
• Trend: List quality degrading in later segments

💡 TOP INSIGHTS
1. 🔴 Critical: Hard bounce rate (24.5%) requires immediate attention
2. 🟡 Warning: Delivery rate declining round-over-round
3. 🟢 Positive: Soft bounces remain low (1.3%)

🎯 RECOMMENDATIONS
1. Run bounce cleanup before Round 3
2. Suppress hard bounces from Rounds 1 & 2
3. Consider list re-validation service
4. Monitor ISP reputation scores

📈 PREDICTIONS
Expected Open Rate: 22-26% (if bounces suppressed)
Expected Click Rate: 2-4%
Risk Factors:
  • High bounce rate may impact sender reputation
  • Round 3 may see continued degradation without cleanup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ NEXT CAMPAIGN: Round 3 - Tuesday, Oct 8 at 9:15 AM UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Implementation Architecture

### System Components

```typescript
interface CampaignLifecycleSystem {
  scheduler: {
    prelaunchScheduler: CronScheduler;      // 15:00 UTC day before
    preflightScheduler: CronScheduler;      // 06:00 UTC launch day
    launchWarningScheduler: CronScheduler;  // 09:00 UTC launch day
    wrapupScheduler: CronScheduler;         // 09:45 UTC launch day
  };

  services: {
    mailjetClient: MailjetAPIClient;
    slackClient: SlackMCPClient;
    aiAnalyzer: GeminiAIClient;
    database: PrismaClient;
  };

  agents: {
    listQualityAgent: AIAgent;
    deliveryAnalysisAgent: AIAgent;
    reportFormattingAgent: AIAgent;
    recommendationAgent: AIAgent;
  };
}
```

### Database Schema

```typescript
// Campaign Schedule Table
interface CampaignSchedule {
  id: number;
  campaignName: string;
  roundNumber: number;
  scheduledDate: Date;
  scheduledTime: string; // "09:15 UTC"

  // List details
  listName: string;
  listId: number;
  recipientCount: number;
  recipientRange: string; // "1,001-2,000"

  // Campaign details
  mailjetDraftId?: number;
  mailjetCampaignId?: number;
  subject: string;
  senderName: string;
  senderEmail: string;

  // Notification tracking
  notifications: {
    prelaunch: { sent: boolean; timestamp?: Date; };
    preflight: { sent: boolean; timestamp?: Date; status?: string; };
    launchWarning: { sent: boolean; timestamp?: Date; };
    launchConfirmation: { sent: boolean; timestamp?: Date; };
    wrapup: { sent: boolean; timestamp?: Date; };
  };

  // Status
  status: 'scheduled' | 'ready' | 'launching' | 'sent' | 'completed';

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### Service Integration

#### MailJet Data Collection
```typescript
async function collectCampaignData(
  campaignId: number
): Promise<CampaignMetrics> {
  const mailjet = new MailjetClient();

  // Get campaign statistics
  const stats = await mailjet.get(`/campaignstatistics/${campaignId}`);

  // Get campaign details
  const campaign = await mailjet.get(`/campaign/${campaignId}`);

  return {
    deliveryMetrics: {
      processed: stats.ProcessedCount,
      delivered: stats.DeliveredCount,
      bounced: stats.BouncedCount,
      hardBounces: stats.HardBouncedCount,
      softBounces: stats.SoftBouncedCount,
      blocked: stats.BlockedCount,
      queued: stats.QueuedCount
    },
    engagementMetrics: {
      opened: stats.OpenedCount,
      clicked: stats.ClickedCount,
      unsubscribed: stats.UnsubscribedCount,
      complained: stats.SpamComplaintCount
    },
    timing: {
      sendStartAt: campaign.SendStartAt,
      sendEndAt: campaign.SendEndAt
    }
  };
}
```

#### AI Analysis
```typescript
async function generateAIAssessment(
  campaignData: CampaignMetrics,
  previousRoundData?: CampaignMetrics
): Promise<AIAssessment> {
  const gemini = new GeminiClient();

  // Multi-agent analysis
  const listQuality = await gemini.analyze({
    agent: 'list-quality-agent',
    data: campaignData,
    prompt: 'Analyze list quality based on bounce rates and delivery metrics'
  });

  const comparison = previousRoundData
    ? await gemini.analyze({
        agent: 'comparison-agent',
        data: { current: campaignData, previous: previousRoundData },
        prompt: 'Compare performance round-over-round'
      })
    : null;

  const recommendations = await gemini.analyze({
    agent: 'recommendation-agent',
    data: { campaignData, listQuality, comparison },
    prompt: 'Generate actionable recommendations'
  });

  return {
    overallHealth: determineHealth(campaignData),
    listQuality: listQuality.assessment,
    deliveryAnalysis: listQuality.deliveryAnalysis,
    comparison: comparison?.insights,
    recommendations: recommendations.items,
    predictions: recommendations.predictions
  };
}
```

#### Slack Notification
```typescript
async function sendLifecycleNotification(
  stage: LifecycleStage,
  data: NotificationData
): Promise<void> {
  const slackClient = new SlackMCPClient();

  const blocks = formatNotificationBlocks(stage, data);

  await slackClient.postMessage({
    channel: process.env.SLACK_TRACTION_CHANNEL_ID,
    blocks,
    text: `${stage} notification for ${data.campaignName}`
  });

  // Update database
  await updateNotificationStatus(data.scheduleId, stage);
}
```

---

## Workflow Implementation

### Automated Scheduling

```typescript
// Schedule all lifecycle notifications when campaign is created
async function scheduleCampaignLifecycle(
  campaignSchedule: CampaignSchedule
): Promise<void> {
  const { scheduledDate, scheduledTime } = campaignSchedule;
  const launchDateTime = parseDateTime(scheduledDate, scheduledTime);

  // Calculate notification times
  const prelaunchTime = subHours(launchDateTime, 21); // 3 PM day before
  const preflightTime = subHours(launchDateTime, 3.25); // 6 AM launch day
  const launchWarningTime = subMinutes(launchDateTime, 15); // 15 min before
  const wrapupTime = addMinutes(launchDateTime, 30); // 30 min after

  // Schedule jobs
  await scheduleJob('prelaunch', prelaunchTime, async () => {
    await sendPreLaunchNotification(campaignSchedule);
  });

  await scheduleJob('preflight', preflightTime, async () => {
    await runPreFlightChecks(campaignSchedule);
  });

  await scheduleJob('launch-warning', launchWarningTime, async () => {
    await sendLaunchWarning(campaignSchedule);
  });

  await scheduleJob('wrapup', wrapupTime, async () => {
    await generatePostLaunchWrapup(campaignSchedule);
  });
}
```

### Stage Implementations

#### Stage 1: Pre-Launch (T-21 hours)
```typescript
async function sendPreLaunchNotification(
  schedule: CampaignSchedule
): Promise<void> {
  // Fetch campaign details from MailJet
  const draftDetails = await mailjet.get(`/campaigndraft/${schedule.mailjetDraftId}`);
  const listDetails = await mailjet.get(`/contactslist/${schedule.listId}`);

  // Generate AI preview
  const aiPreview = await gemini.analyze({
    agent: 'preview-agent',
    data: { draft: draftDetails, list: listDetails, schedule },
    prompt: 'Generate pre-launch assessment and recommendations'
  });

  // Format and send notification
  const notification = formatPreLaunchNotification({
    schedule,
    draftDetails,
    listDetails,
    aiPreview
  });

  await slackClient.postMessage({
    channel: '#_traction',
    blocks: notification.blocks
  });

  // Mark as sent
  await database.campaignSchedule.update({
    where: { id: schedule.id },
    data: {
      notifications: {
        ...schedule.notifications,
        prelaunch: { sent: true, timestamp: new Date() }
      }
    }
  });
}
```

#### Stage 2: Pre-Flight (T-3.25 hours)
```typescript
async function runPreFlightChecks(
  schedule: CampaignSchedule
): Promise<void> {
  const checks: PreFlightChecklist = {
    timestamp: new Date(),
    campaignDraftId: schedule.mailjetDraftId!,
    checks: {
      listVerification: await verifyList(schedule.listId, schedule.recipientCount),
      campaignSetup: await verifyCampaignSetup(schedule.mailjetDraftId!),
      technicalValidation: await runTechnicalValidation(schedule.mailjetDraftId!)
    },
    overallStatus: 'ready',
    aiAssessment: ''
  };

  // Determine overall status
  checks.overallStatus = determineOverallStatus(checks.checks);

  // AI assessment
  checks.aiAssessment = await gemini.analyze({
    agent: 'preflight-agent',
    data: checks,
    prompt: 'Assess campaign readiness and identify risks'
  });

  // Send notification
  const notification = formatPreFlightNotification(schedule, checks);
  await slackClient.postMessage({
    channel: '#_traction',
    blocks: notification.blocks
  });

  // Update database
  await database.campaignSchedule.update({
    where: { id: schedule.id },
    data: {
      notifications: {
        ...schedule.notifications,
        preflight: {
          sent: true,
          timestamp: new Date(),
          status: checks.overallStatus
        }
      }
    }
  });
}
```

#### Stage 3: Launch Warning (T-15 min)
```typescript
async function sendLaunchWarning(
  schedule: CampaignSchedule
): Promise<void> {
  const notification = formatLaunchWarningNotification(schedule);

  await slackClient.postMessage({
    channel: '#_traction',
    blocks: notification.blocks
  });

  await database.campaignSchedule.update({
    where: { id: schedule.id },
    data: {
      notifications: {
        ...schedule.notifications,
        launchWarning: { sent: true, timestamp: new Date() }
      },
      status: 'launching'
    }
  });
}
```

#### Stage 4: Launch Confirmation (T+0)
**Note**: This is triggered by manual send script or external trigger, not scheduled.

```typescript
async function sendLaunchConfirmation(
  scheduleId: number,
  campaignId: number
): Promise<void> {
  const schedule = await database.campaignSchedule.findUnique({
    where: { id: scheduleId }
  });

  // Get initial status from MailJet
  const stats = await mailjet.get(`/campaignstatistics/${campaignId}`);

  const notification = formatLaunchConfirmationNotification(
    schedule,
    campaignId,
    stats
  );

  await slackClient.postMessage({
    channel: '#_traction',
    blocks: notification.blocks
  });

  await database.campaignSchedule.update({
    where: { id: scheduleId },
    data: {
      mailjetCampaignId: campaignId,
      notifications: {
        ...schedule.notifications,
        launchConfirmation: { sent: true, timestamp: new Date() }
      },
      status: 'sent'
    }
  });
}
```

#### Stage 5: Post-Launch Wrap-Up (T+30 min)
```typescript
async function generatePostLaunchWrapup(
  schedule: CampaignSchedule
): Promise<void> {
  if (!schedule.mailjetCampaignId) {
    logger.warn('Campaign ID not set, skipping wrap-up', { scheduleId: schedule.id });
    return;
  }

  // Collect campaign data
  const campaignData = await collectCampaignData(schedule.mailjetCampaignId);

  // Get previous round data for comparison
  const previousRound = await database.campaignSchedule.findFirst({
    where: {
      campaignName: schedule.campaignName,
      roundNumber: schedule.roundNumber - 1
    }
  });

  const previousData = previousRound?.mailjetCampaignId
    ? await collectCampaignData(previousRound.mailjetCampaignId)
    : undefined;

  // Generate AI assessment
  const aiAssessment = await generateAIAssessment(campaignData, previousData);

  // Format and send notification
  const notification = formatPostLaunchWrapup({
    schedule,
    campaignData,
    aiAssessment,
    previousData
  });

  await slackClient.postMessage({
    channel: '#_traction',
    blocks: notification.blocks
  });

  // Update database
  await database.campaignSchedule.update({
    where: { id: schedule.id },
    data: {
      notifications: {
        ...schedule.notifications,
        wrapup: { sent: true, timestamp: new Date() }
      },
      status: 'completed'
    }
  });
}
```

---

## Configuration

### Environment Variables

```bash
# MailJet API
MAILJET_API_KEY=your_api_key
MAILJET_SECRET_KEY=your_secret_key

# Slack Integration
SLACK_MANAGER_URL=https://slack-manager.herokuapp.com
SLACK_MANAGER_API_TOKEN=your_token
SLACK_TRACTION_CHANNEL_ID=C011CEK2406

# AI Analysis
GEMINI_API_KEY=your_gemini_key

# Database
DATABASE_URL=your_postgres_url

# Scheduling
CAMPAIGN_SEND_TIME=09:15
CAMPAIGN_SEND_DAYS=Tuesday,Thursday
PRELAUNCH_NOTIFICATION_TIME=15:00
PREFLIGHT_CHECK_TIME=06:00
```

### Scheduler Configuration

```typescript
interface SchedulerConfig {
  prelaunch: {
    time: '15:00'; // 3 PM UTC
    hoursBeforeLaunch: 21; // 21 hours = day before at 3 PM
  };
  preflight: {
    time: '06:00'; // 6 AM UTC
    hoursBeforeLaunch: 3.25; // 3 hours 15 minutes before launch
  };
  launchWarning: {
    minutesBeforeLaunch: 15;
  };
  wrapup: {
    minutesAfterLaunch: 30;
  };
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Campaign Lifecycle', () => {
  describe('Batch Scheduling', () => {
    it('should split 3,529 recipients into 3 batches', () => {
      const schedule = calculateBatchSchedule(
        new Date('2025-09-30'),
        3529
      );

      expect(schedule).toHaveLength(3);
      expect(schedule[0].recipientCount).toBe(1177); // Round 1
      expect(schedule[1].recipientCount).toBe(1176); // Round 2
      expect(schedule[2].recipientCount).toBe(1176); // Round 3
    });

    it('should schedule only on Tuesdays and Thursdays', () => {
      const schedule = calculateBatchSchedule(
        new Date('2025-10-01'), // Wednesday
        3000
      );

      schedule.forEach(batch => {
        const day = batch.scheduledDate.getDay();
        expect([2, 4]).toContain(day); // 2=Tuesday, 4=Thursday
      });
    });
  });

  describe('Pre-Flight Checks', () => {
    it('should detect list count discrepancy', async () => {
      const result = await verifyList(10503118, 1000);

      if (result.subscriberCount !== result.expectedCount) {
        expect(result.status).toBe('warning');
      }
    });
  });

  describe('AI Assessment', () => {
    it('should flag high bounce rates', async () => {
      const assessment = await generateAIAssessment({
        deliveryMetrics: {
          processed: 1000,
          delivered: 742,
          bounced: 258,
          hardBounces: 245,
          softBounces: 13
        }
      });

      expect(assessment.overallHealth).toBe('concerning');
      expect(assessment.recommendations).toContain(
        expect.stringContaining('bounce cleanup')
      );
    });
  });
});
```

### Integration Tests

```typescript
describe('Campaign Lifecycle Integration', () => {
  it('should execute complete lifecycle for Round 2', async () => {
    const schedule = await createCampaignSchedule({
      campaignName: 'Test Campaign',
      roundNumber: 2,
      scheduledDate: addDays(new Date(), 1),
      listId: 10503118,
      recipientCount: 1000
    });

    // T-21 hours: Pre-launch
    await sendPreLaunchNotification(schedule);
    expect(schedule.notifications.prelaunch.sent).toBe(true);

    // T-3.25 hours: Pre-flight
    await runPreFlightChecks(schedule);
    expect(schedule.notifications.preflight.sent).toBe(true);

    // T-15 min: Launch warning
    await sendLaunchWarning(schedule);
    expect(schedule.notifications.launchWarning.sent).toBe(true);

    // T+0: Launch (manual trigger)
    const campaignId = await sendCampaign(schedule);
    await sendLaunchConfirmation(schedule.id, campaignId);
    expect(schedule.notifications.launchConfirmation.sent).toBe(true);

    // T+30 min: Wrap-up
    await generatePostLaunchWrapup(schedule);
    expect(schedule.notifications.wrapup.sent).toBe(true);
    expect(schedule.status).toBe('completed');
  });
});
```

---

## Monitoring & Alerting

### Health Checks

```typescript
interface SystemHealthCheck {
  schedulerStatus: 'running' | 'stopped' | 'degraded';
  mailjetConnection: boolean;
  slackConnection: boolean;
  geminiConnection: boolean;
  databaseConnection: boolean;
  pendingJobs: number;
  failedJobs: number;
  lastSuccessfulNotification: Date | null;
}

async function checkSystemHealth(): Promise<SystemHealthCheck> {
  return {
    schedulerStatus: await checkScheduler(),
    mailjetConnection: await testMailjetConnection(),
    slackConnection: await testSlackConnection(),
    geminiConnection: await testGeminiConnection(),
    databaseConnection: await testDatabaseConnection(),
    pendingJobs: await countPendingJobs(),
    failedJobs: await countFailedJobs(),
    lastSuccessfulNotification: await getLastSuccessfulNotification()
  };
}
```

### Failure Recovery

```typescript
interface FailureRecoveryStrategy {
  notificationFailure: {
    retryAttempts: 3;
    retryDelay: 300000; // 5 minutes
    fallbackChannel: '#campaign-alerts';
    escalation: ['campaign-manager@company.com'];
  };

  dataCollectionFailure: {
    retryAttempts: 5;
    retryDelay: 60000; // 1 minute
    fallbackData: 'use-cached' | 'skip-comparison';
  };

  aiAnalysisFailure: {
    retryAttempts: 2;
    fallbackMode: 'basic-metrics-only';
    notifyTeam: true;
  };
}
```

---

## Success Metrics

### Operational KPIs

```typescript
interface LifecycleKPIs {
  notificationDelivery: {
    onTimeRate: number; // % notifications sent on schedule
    deliverySuccessRate: number; // % notifications successfully delivered
    averageDelay: number; // seconds
  };

  checkAccuracy: {
    preflightAccuracy: number; // % pre-flight checks that correctly predicted issues
    falsePositiveRate: number;
    falseNegativeRate: number;
  };

  aiPerformance: {
    assessmentAccuracy: number; // How often AI predictions match actual results
    recommendationAdoptionRate: number; // % recommendations followed
    predictionConfidence: number;
  };

  campaignOutcomes: {
    onTimeSchedule: number; // % campaigns sent on schedule
    successfulLaunches: number; // % campaigns without issues
    issuesIdentifiedByPreflight: number; // Issues caught before launch
  };
}
```

---

## Future Enhancements

### Phase 2 Features

1. **Predictive Scheduling**
   - AI-powered optimal send time prediction
   - Audience timezone optimization
   - Engagement pattern analysis

2. **Advanced AI Agents**
   - Subject line optimization agent
   - Content recommendation agent
   - Audience segmentation agent
   - Competitor analysis agent

3. **Real-Time Monitoring**
   - Live campaign performance dashboard
   - Real-time engagement metrics
   - Automated anomaly detection
   - Instant alerts for issues

4. **Enhanced Reporting**
   - Executive summary generation
   - Trend analysis across campaigns
   - ROI calculation and forecasting
   - Benchmarking against industry standards

5. **Automated Optimization**
   - A/B test scheduling
   - Dynamic content personalization
   - List hygiene automation
   - Bounce suppression workflow

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept and brainstorm
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [02_architecture.md](./02_architecture.md) - Technical architecture
- [../01_workflow.md](../01_workflow.md) - Core system workflow
- [../08_multi_agent_implementation.md](../08_multi_agent_implementation.md) - AI agent architecture
- [../09_user_segmentation_strategy.md](../09_user_segmentation_strategy.md) - User segmentation methodology
- [../10_bounce_management_guide.md](../10_bounce_management_guide.md) - Bounce handling procedures
- MailJet API: https://dev.mailjet.com/email/reference/
- Google Gemini: https://ai.google.dev/docs

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: 🔄 In Development
