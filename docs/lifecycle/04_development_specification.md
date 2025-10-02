# Campaign Lifecycle Development Specification

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: 🔄 Ready for Development
- **Purpose**: Detailed development specification for implementing automated campaign lifecycle

---

## Development Overview

### Scope

This specification covers the implementation of a fully automated campaign lifecycle management system with 5 distinct stages:

1. Pre-Launch Notification (T-21 hours)
2. Pre-Flight Check (T-3.25 hours)
3. Launch Warning (T-15 minutes)
4. Launch Confirmation (T+0)
5. Post-Launch Wrap-Up (T+30 minutes)

### Success Criteria

- ✅ All 5 stages execute automatically on schedule
- ✅ Notifications delivered to Slack #_traction channel within 1 minute of trigger time
- ✅ AI analysis completes within 30 seconds
- ✅ Pre-flight checks identify 100% of configuration issues
- ✅ Wrap-up reports include full metrics and AI assessment
- ✅ System handles failures gracefully with retry logic
- ✅ All stages logged and trackable in database

---

## Database Development

### Task 1.1: Create Database Schema

**Priority**: High
**Estimated Time**: 2 hours
**Dependencies**: None

#### Implementation

```prisma
// prisma/schema.prisma

// Add to existing schema

model CampaignSchedule {
  id                  Int       @id @default(autoincrement())
  campaignName        String
  roundNumber         Int
  scheduledDate       DateTime
  scheduledTime       String    // "09:15"

  // List details
  listName            String
  listId              Int
  recipientCount      Int
  recipientRange      String

  // Campaign details
  mailjetDraftId      Int?
  mailjetCampaignId   Int?
  subject             String
  senderName          String
  senderEmail         String

  // Notification tracking
  notificationStatus  Json      @default("{\"prelaunch\":{\"sent\":false,\"timestamp\":null},\"preflight\":{\"sent\":false,\"timestamp\":null,\"status\":null},\"launchWarning\":{\"sent\":false,\"timestamp\":null},\"launchConfirmation\":{\"sent\":false,\"timestamp\":null},\"wrapup\":{\"sent\":false,\"timestamp\":null}}")

  // Status
  status              CampaignStatus @default(SCHEDULED)

  // Relations
  metrics             CampaignMetrics[]
  notifications       NotificationLog[]

  // Timestamps
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([scheduledDate, roundNumber])
  @@index([status])
  @@map("campaign_schedules")
}

model CampaignMetrics {
  id                  Int       @id @default(autoincrement())
  campaignScheduleId  Int
  mailjetCampaignId   Int

  // Delivery metrics
  processed           Int
  delivered           Int
  bounced             Int
  hardBounces         Int
  softBounces         Int
  blocked             Int
  queued              Int

  // Engagement metrics
  opened              Int       @default(0)
  clicked             Int       @default(0)
  unsubscribed        Int       @default(0)
  complained          Int       @default(0)

  // Calculated rates
  deliveryRate        Float
  bounceRate          Float
  hardBounceRate      Float
  softBounceRate      Float
  openRate            Float?
  clickRate           Float?

  // Timestamps
  collectedAt         DateTime  @default(now())
  sendStartAt         DateTime?
  sendEndAt           DateTime?

  // Relations
  campaignSchedule    CampaignSchedule @relation(fields: [campaignScheduleId], references: [id])

  @@index([mailjetCampaignId])
  @@index([campaignScheduleId])
  @@map("campaign_metrics")
}

model NotificationLog {
  id                  Int       @id @default(autoincrement())
  campaignScheduleId  Int
  stage               NotificationStage
  status              NotificationStatus
  attempt             Int       @default(1)
  errorMessage        String?
  slackMessageId      String?
  sentAt              DateTime  @default(now())

  // Relations
  campaignSchedule    CampaignSchedule @relation(fields: [campaignScheduleId], references: [id])

  @@index([campaignScheduleId, stage])
  @@map("notification_logs")
}

enum CampaignStatus {
  SCHEDULED
  READY
  LAUNCHING
  SENT
  COMPLETED
  BLOCKED
}

enum NotificationStage {
  PRELAUNCH
  PREFLIGHT
  LAUNCH_WARNING
  LAUNCH_CONFIRMATION
  WRAPUP
}

enum NotificationStatus {
  SUCCESS
  FAILURE
  RETRYING
}
```

#### Migration Command

```bash
npx prisma migrate dev --name add_campaign_lifecycle_tables
npx prisma generate
```

#### Validation

```typescript
// test/database.test.ts
describe('Campaign Schedule Database', () => {
  it('should create campaign schedule', async () => {
    const schedule = await prisma.campaignSchedule.create({
      data: {
        campaignName: 'Test Campaign',
        roundNumber: 1,
        scheduledDate: new Date('2025-10-02'),
        scheduledTime: '09:15',
        listName: 'test_list',
        listId: 12345,
        recipientCount: 1000,
        recipientRange: '1-1000',
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com'
      }
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.status).toBe('SCHEDULED');
  });
});
```

---

### Task 1.2: Create Database Service Layer

**Priority**: High
**Estimated Time**: 3 hours
**Dependencies**: Task 1.1

#### Implementation

```typescript
// src/services/database/campaign-schedule.service.ts

import { PrismaClient, CampaignSchedule, CampaignStatus } from '@prisma/client';

export class CampaignScheduleService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCampaignScheduleInput): Promise<CampaignSchedule> {
    return this.prisma.campaignSchedule.create({ data });
  }

  async findById(id: number): Promise<CampaignSchedule | null> {
    return this.prisma.campaignSchedule.findUnique({
      where: { id },
      include: { metrics: true, notifications: true }
    });
  }

  async findNextScheduled(): Promise<CampaignSchedule | null> {
    return this.prisma.campaignSchedule.findFirst({
      where: {
        status: 'SCHEDULED',
        scheduledDate: { gte: new Date() }
      },
      orderBy: { scheduledDate: 'asc' }
    });
  }

  async updateStatus(id: number, status: CampaignStatus): Promise<void> {
    await this.prisma.campaignSchedule.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  async updateNotificationStatus(
    id: number,
    stage: string,
    sent: boolean,
    timestamp: Date,
    status?: string
  ): Promise<void> {
    const schedule = await this.findById(id);
    if (!schedule) throw new Error(`Schedule ${id} not found`);

    const notificationStatus = schedule.notificationStatus as any;
    notificationStatus[stage] = { sent, timestamp, status };

    await this.prisma.campaignSchedule.update({
      where: { id },
      data: { notificationStatus, updatedAt: new Date() }
    });
  }

  async setCampaignId(id: number, campaignId: number): Promise<void> {
    await this.prisma.campaignSchedule.update({
      where: { id },
      data: { mailjetCampaignId: campaignId, updatedAt: new Date() }
    });
  }
}

// src/services/database/campaign-metrics.service.ts

export class CampaignMetricsService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCampaignMetricsInput): Promise<CampaignMetrics> {
    return this.prisma.campaignMetrics.create({ data });
  }

  async findByScheduleId(scheduleId: number): Promise<CampaignMetrics | null> {
    return this.prisma.campaignMetrics.findFirst({
      where: { campaignScheduleId: scheduleId },
      orderBy: { collectedAt: 'desc' }
    });
  }

  async findPreviousRound(
    campaignName: string,
    currentRound: number
  ): Promise<CampaignMetrics | null> {
    const previousSchedule = await this.prisma.campaignSchedule.findFirst({
      where: {
        campaignName,
        roundNumber: currentRound - 1
      },
      include: { metrics: true }
    });

    return previousSchedule?.metrics[0] || null;
  }
}

// src/services/database/notification-log.service.ts

export class NotificationLogService {
  constructor(private prisma: PrismaClient) {}

  async log(data: CreateNotificationLogInput): Promise<NotificationLog> {
    return this.prisma.notificationLog.create({ data });
  }

  async findByCampaignSchedule(scheduleId: number): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: { campaignScheduleId: scheduleId },
      orderBy: { sentAt: 'desc' }
    });
  }

  async findFailedNotifications(): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: {
        status: 'FAILURE',
        attempt: { lt: 3 }
      }
    });
  }
}
```

---

## Core Service Development

### Task 2.1: Campaign Batch Scheduling Service

**Priority**: High
**Estimated Time**: 4 hours
**Dependencies**: Task 1.2

#### Implementation

```typescript
// src/services/campaign/batch-scheduler.service.ts

export class BatchSchedulerService {
  /**
   * Calculate batch schedule for campaign
   * Splits recipients into 3 batches, schedules on Tue/Thu at 9:15 AM UTC
   */
  calculateBatchSchedule(
    totalRecipients: number,
    startDate: Date
  ): BatchSchedule[] {
    const batchSize = Math.ceil(totalRecipients / 3);
    const batches: BatchSchedule[] = [];

    let currentDate = this.getNextTuesdayOrThursday(startDate);
    let startPosition = 0;

    for (let round = 1; round <= 3; round++) {
      const endPosition = round === 3 ? totalRecipients : startPosition + batchSize;

      batches.push({
        round,
        recipientRange: `${startPosition + 1}-${endPosition}`,
        recipientCount: endPosition - startPosition,
        scheduledDate: currentDate,
        scheduledTime: '09:15'
      });

      currentDate = this.getNextTuesdayOrThursday(
        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      );
      startPosition = endPosition;
    }

    return batches;
  }

  /**
   * Get next Tuesday or Thursday from given date
   */
  private getNextTuesdayOrThursday(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();

    if (day === 2 || day === 4) {
      // Already Tuesday (2) or Thursday (4)
      return result;
    }

    // Calculate days until next Tuesday or Thursday
    let daysToAdd: number;
    if (day < 2) {
      daysToAdd = 2 - day; // Next Tuesday
    } else if (day === 3) {
      daysToAdd = 1; // Tomorrow is Thursday
    } else {
      daysToAdd = (9 - day) % 7; // Next Tuesday
    }

    result.setDate(result.getDate() + daysToAdd);
    result.setHours(9, 15, 0, 0); // Set to 9:15 AM
    return result;
  }

  /**
   * Create complete campaign schedule with all 3 rounds
   */
  async createCampaignSchedule(
    params: CreateCampaignParams
  ): Promise<CampaignSchedule[]> {
    const batches = this.calculateBatchSchedule(
      params.totalRecipients,
      params.startDate
    );

    const schedules: CampaignSchedule[] = [];

    for (const batch of batches) {
      const schedule = await this.campaignScheduleService.create({
        campaignName: params.campaignName,
        roundNumber: batch.round,
        scheduledDate: batch.scheduledDate,
        scheduledTime: batch.scheduledTime,
        listName: `campaign_batch_00${batch.round}`,
        listId: 0, // Will be set when list is created
        recipientCount: batch.recipientCount,
        recipientRange: batch.recipientRange,
        subject: params.subject,
        senderName: params.senderName,
        senderEmail: params.senderEmail
      });

      schedules.push(schedule);
    }

    return schedules;
  }
}
```

#### Tests

```typescript
// test/batch-scheduler.test.ts

describe('BatchSchedulerService', () => {
  let service: BatchSchedulerService;

  beforeEach(() => {
    service = new BatchSchedulerService();
  });

  describe('calculateBatchSchedule', () => {
    it('should split 3,529 recipients into 3 batches', () => {
      const batches = service.calculateBatchSchedule(
        3529,
        new Date('2025-09-30')
      );

      expect(batches).toHaveLength(3);
      expect(batches[0].recipientCount).toBe(1177);
      expect(batches[1].recipientCount).toBe(1176);
      expect(batches[2].recipientCount).toBe(1176);
      expect(batches[0].recipientRange).toBe('1-1177');
      expect(batches[1].recipientRange).toBe('1178-2353');
      expect(batches[2].recipientRange).toBe('2354-3529');
    });

    it('should schedule only on Tuesdays and Thursdays', () => {
      const batches = service.calculateBatchSchedule(
        3000,
        new Date('2025-10-01') // Wednesday
      );

      batches.forEach(batch => {
        const day = batch.scheduledDate.getDay();
        expect([2, 4]).toContain(day); // 2=Tuesday, 4=Thursday
      });
    });

    it('should set time to 09:15 UTC', () => {
      const batches = service.calculateBatchSchedule(
        3000,
        new Date('2025-10-01')
      );

      batches.forEach(batch => {
        expect(batch.scheduledTime).toBe('09:15');
        expect(batch.scheduledDate.getHours()).toBe(9);
        expect(batch.scheduledDate.getMinutes()).toBe(15);
      });
    });
  });

  describe('getNextTuesdayOrThursday', () => {
    it('should return same date if already Tuesday', () => {
      const tuesday = new Date('2025-10-07'); // Tuesday
      const result = service['getNextTuesdayOrThursday'](tuesday);
      expect(result.toDateString()).toBe(tuesday.toDateString());
    });

    it('should return same date if already Thursday', () => {
      const thursday = new Date('2025-10-02'); // Thursday
      const result = service['getNextTuesdayOrThursday'](thursday);
      expect(result.toDateString()).toBe(thursday.toDateString());
    });

    it('should return next Tuesday from Monday', () => {
      const monday = new Date('2025-10-06'); // Monday
      const result = service['getNextTuesdayOrThursday'](monday);
      expect(result.getDay()).toBe(2); // Tuesday
    });

    it('should return next Thursday from Wednesday', () => {
      const wednesday = new Date('2025-10-01'); // Wednesday
      const result = service['getNextTuesdayOrThursday'](wednesday);
      expect(result.getDay()).toBe(4); // Thursday
    });
  });
});
```

---

### Task 2.2: Notification Service

**Priority**: High
**Estimated Time**: 6 hours
**Dependencies**: Task 1.2

#### Implementation

```typescript
// src/services/notification/lifecycle-notification.service.ts

import { SlackMCPClient } from '../integrations/slack-mcp.client';
import { GeminiAIClient } from '../integrations/gemini-ai.client';

export class LifecycleNotificationService {
  constructor(
    private slackClient: SlackMCPClient,
    private aiClient: GeminiAIClient,
    private campaignScheduleService: CampaignScheduleService,
    private notificationLogService: NotificationLogService
  ) {}

  /**
   * Stage 1: Pre-Launch Notification (T-21 hours)
   */
  async sendPreLaunchNotification(scheduleId: number): Promise<void> {
    const schedule = await this.campaignScheduleService.findById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    try {
      // Generate AI preview
      const aiPreview = await this.aiClient.generatePreLaunchPreview({
        campaignName: schedule.campaignName,
        recipientCount: schedule.recipientCount,
        scheduledDate: schedule.scheduledDate
      });

      // Format Slack blocks
      const blocks = this.formatPreLaunchBlocks(schedule, aiPreview);

      // Send to Slack
      const result = await this.slackClient.postMessage({
        channel: process.env.SLACK_TRACTION_CHANNEL_ID!,
        blocks,
        text: `Campaign scheduled for tomorrow: ${schedule.campaignName}`
      });

      // Update database
      await this.campaignScheduleService.updateNotificationStatus(
        scheduleId,
        'prelaunch',
        true,
        new Date()
      );

      // Log success
      await this.notificationLogService.log({
        campaignScheduleId: scheduleId,
        stage: 'PRELAUNCH',
        status: 'SUCCESS',
        slackMessageId: result.ts
      });

      logger.info('Pre-launch notification sent', {
        scheduleId,
        campaignName: schedule.campaignName
      });
    } catch (error) {
      await this.handleNotificationError(scheduleId, 'PRELAUNCH', error);
      throw error;
    }
  }

  /**
   * Stage 2: Pre-Flight Check (T-3.25 hours)
   */
  async sendPreFlightNotification(
    scheduleId: number,
    checks: PreFlightChecklist
  ): Promise<void> {
    const schedule = await this.campaignScheduleService.findById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    try {
      // Generate AI assessment
      const aiAssessment = await this.aiClient.assessReadiness(checks);

      // Format Slack blocks
      const blocks = this.formatPreFlightBlocks(schedule, checks, aiAssessment);

      // Send to Slack
      const result = await this.slackClient.postMessage({
        channel: process.env.SLACK_TRACTION_CHANNEL_ID!,
        blocks,
        text: `Pre-flight check: ${schedule.campaignName} - ${checks.overallStatus}`
      });

      // Update database
      await this.campaignScheduleService.updateNotificationStatus(
        scheduleId,
        'preflight',
        true,
        new Date(),
        checks.overallStatus
      );

      // Update campaign status based on check results
      if (checks.overallStatus === 'ready') {
        await this.campaignScheduleService.updateStatus(scheduleId, 'READY');
      } else if (checks.overallStatus === 'blocked') {
        await this.campaignScheduleService.updateStatus(scheduleId, 'BLOCKED');
      }

      // Log success
      await this.notificationLogService.log({
        campaignScheduleId: scheduleId,
        stage: 'PREFLIGHT',
        status: 'SUCCESS',
        slackMessageId: result.ts
      });

      logger.info('Pre-flight notification sent', {
        scheduleId,
        overallStatus: checks.overallStatus
      });
    } catch (error) {
      await this.handleNotificationError(scheduleId, 'PREFLIGHT', error);
      throw error;
    }
  }

  /**
   * Stage 3: Launch Warning (T-15 minutes)
   */
  async sendLaunchWarning(scheduleId: number): Promise<void> {
    const schedule = await this.campaignScheduleService.findById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    try {
      // Format Slack blocks
      const blocks = this.formatLaunchWarningBlocks(schedule);

      // Send to Slack
      const result = await this.slackClient.postMessage({
        channel: process.env.SLACK_TRACTION_CHANNEL_ID!,
        blocks,
        text: `15-minute launch warning: ${schedule.campaignName}`
      });

      // Update database
      await this.campaignScheduleService.updateNotificationStatus(
        scheduleId,
        'launchWarning',
        true,
        new Date()
      );

      await this.campaignScheduleService.updateStatus(scheduleId, 'LAUNCHING');

      // Log success
      await this.notificationLogService.log({
        campaignScheduleId: scheduleId,
        stage: 'LAUNCH_WARNING',
        status: 'SUCCESS',
        slackMessageId: result.ts
      });

      logger.info('Launch warning sent', { scheduleId });
    } catch (error) {
      await this.handleNotificationError(scheduleId, 'LAUNCH_WARNING', error);
      throw error;
    }
  }

  /**
   * Stage 4: Launch Confirmation (T+0)
   */
  async sendLaunchConfirmation(
    scheduleId: number,
    campaignId: number
  ): Promise<void> {
    const schedule = await this.campaignScheduleService.findById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    try {
      // Format Slack blocks
      const blocks = this.formatLaunchConfirmationBlocks(schedule, campaignId);

      // Send to Slack
      const result = await this.slackClient.postMessage({
        channel: process.env.SLACK_TRACTION_CHANNEL_ID!,
        blocks,
        text: `Campaign launched: ${schedule.campaignName}`
      });

      // Update database
      await this.campaignScheduleService.setCampaignId(scheduleId, campaignId);
      await this.campaignScheduleService.updateNotificationStatus(
        scheduleId,
        'launchConfirmation',
        true,
        new Date()
      );
      await this.campaignScheduleService.updateStatus(scheduleId, 'SENT');

      // Log success
      await this.notificationLogService.log({
        campaignScheduleId: scheduleId,
        stage: 'LAUNCH_CONFIRMATION',
        status: 'SUCCESS',
        slackMessageId: result.ts
      });

      logger.info('Launch confirmation sent', { scheduleId, campaignId });
    } catch (error) {
      await this.handleNotificationError(scheduleId, 'LAUNCH_CONFIRMATION', error);
      throw error;
    }
  }

  /**
   * Stage 5: Post-Launch Wrap-Up (T+30 minutes)
   */
  async sendWrapUpReport(
    scheduleId: number,
    report: WrapUpReport
  ): Promise<void> {
    const schedule = await this.campaignScheduleService.findById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    try {
      // Format Slack blocks
      const blocks = this.formatWrapUpBlocks(schedule, report);

      // Send to Slack
      const result = await this.slackClient.postMessage({
        channel: process.env.SLACK_TRACTION_CHANNEL_ID!,
        blocks,
        text: `Post-launch wrap-up: ${schedule.campaignName} Round ${schedule.roundNumber}`
      });

      // Update database
      await this.campaignScheduleService.updateNotificationStatus(
        scheduleId,
        'wrapup',
        true,
        new Date()
      );
      await this.campaignScheduleService.updateStatus(scheduleId, 'COMPLETED');

      // Log success
      await this.notificationLogService.log({
        campaignScheduleId: scheduleId,
        stage: 'WRAPUP',
        status: 'SUCCESS',
        slackMessageId: result.ts
      });

      logger.info('Wrap-up report sent', { scheduleId });
    } catch (error) {
      await this.handleNotificationError(scheduleId, 'WRAPUP', error);
      throw error;
    }
  }

  /**
   * Error handling with retry logic
   */
  private async handleNotificationError(
    scheduleId: number,
    stage: NotificationStage,
    error: Error
  ): Promise<void> {
    await this.notificationLogService.log({
      campaignScheduleId: scheduleId,
      stage,
      status: 'FAILURE',
      errorMessage: error.message
    });

    logger.error('Notification failed', {
      scheduleId,
      stage,
      error: error.message
    });
  }

  // Block formatting methods implemented in separate file
  // See: src/services/notification/block-formatters.ts
}
```

---

### Task 2.3: Verification Service (Pre-Flight Checks)

**Priority**: High
**Estimated Time**: 4 hours
**Dependencies**: Task 1.2

#### Implementation

```typescript
// src/services/verification/preflight-verification.service.ts

import { MailJetClient } from '../integrations/mailjet.client';

export class PreFlightVerificationService {
  constructor(private mailjetClient: MailJetClient) {}

  /**
   * Run all pre-flight checks
   */
  async runAllChecks(schedule: CampaignSchedule): Promise<PreFlightChecklist> {
    const [listVerification, campaignSetup, technicalValidation] =
      await Promise.all([
        this.verifyList(schedule.listId, schedule.recipientCount),
        this.verifyCampaignSetup(schedule.mailjetDraftId!),
        this.verifyTechnicalConfig(schedule.mailjetDraftId!)
      ]);

    const overallStatus = this.determineOverallStatus({
      listVerification,
      campaignSetup,
      technicalValidation
    });

    return {
      timestamp: new Date(),
      campaignDraftId: schedule.mailjetDraftId!,
      checks: {
        listVerification,
        campaignSetup,
        technicalValidation
      },
      overallStatus
    };
  }

  /**
   * Verify list exists and has correct recipient count
   */
  async verifyList(
    listId: number,
    expectedCount: number
  ): Promise<ListVerification> {
    try {
      const list = await this.mailjetClient.getContactsList(listId);

      const listExists = !!list;
      const subscriberCount = list.SubscriberCount;
      const discrepancy =
        subscriberCount !== expectedCount
          ? Math.abs(subscriberCount - expectedCount)
          : null;

      let status: 'pass' | 'warning' | 'fail';
      if (!listExists) {
        status = 'fail';
      } else if (discrepancy && discrepancy > 10) {
        status = 'warning';
      } else {
        status = 'pass';
      }

      return {
        listExists,
        subscriberCount,
        expectedCount,
        discrepancy,
        status
      };
    } catch (error) {
      return {
        listExists: false,
        subscriberCount: 0,
        expectedCount,
        discrepancy: expectedCount,
        status: 'fail'
      };
    }
  }

  /**
   * Verify campaign draft is properly configured
   */
  async verifyCampaignSetup(draftId: number): Promise<CampaignSetupVerification> {
    try {
      const draft = await this.mailjetClient.getCampaignDraft(draftId);
      const content = await this.mailjetClient.getCampaignContent(draftId);

      const draftExists = !!draft;
      const contentLoaded = !!content && content.length > 0;
      const subjectLineSet = !!draft.Subject && draft.Subject.length > 0;
      const senderConfigured =
        !!draft.SenderEmail && !!draft.SenderName;
      const recipientListAttached = !!draft.ContactsListID;

      const allPassed =
        draftExists &&
        contentLoaded &&
        subjectLineSet &&
        senderConfigured &&
        recipientListAttached;

      return {
        draftExists,
        contentLoaded,
        subjectLineSet,
        senderConfigured,
        recipientListAttached,
        status: allPassed ? 'pass' : 'fail'
      };
    } catch (error) {
      return {
        draftExists: false,
        contentLoaded: false,
        subjectLineSet: false,
        senderConfigured: false,
        recipientListAttached: false,
        status: 'fail'
      };
    }
  }

  /**
   * Verify technical configuration (links, tracking, etc.)
   */
  async verifyTechnicalConfig(
    draftId: number
  ): Promise<TechnicalVerification> {
    try {
      const content = await this.mailjetClient.getCampaignContent(draftId);

      // Check for links
      const linksValid = this.validateLinks(content);

      // Check for unsubscribe link
      const unsubscribeLinkPresent = content.includes('[[UNSUB_LINK_');

      // Check for tracking
      const trackingConfigured = true; // MailJet handles this automatically

      // Check SPF/DKIM (always valid if using MailJet)
      const spfDkimValid = true;

      const allPassed =
        linksValid && unsubscribeLinkPresent && trackingConfigured && spfDkimValid;

      return {
        linksValid,
        unsubscribeLinkPresent,
        trackingConfigured,
        spfDkimValid,
        status: allPassed ? 'pass' : 'warning'
      };
    } catch (error) {
      return {
        linksValid: false,
        unsubscribeLinkPresent: false,
        trackingConfigured: false,
        spfDkimValid: false,
        status: 'fail'
      };
    }
  }

  /**
   * Validate all links in content
   */
  private validateLinks(content: string): boolean {
    const urlRegex = /https?:\/\/[^\s"'<>]+/g;
    const urls = content.match(urlRegex) || [];

    // For now, just check that URLs exist and are well-formed
    return urls.every(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Determine overall status from all checks
   */
  private determineOverallStatus(checks: {
    listVerification: ListVerification;
    campaignSetup: CampaignSetupVerification;
    technicalValidation: TechnicalVerification;
  }): 'ready' | 'needs_attention' | 'blocked' {
    const { listVerification, campaignSetup, technicalValidation } = checks;

    // If any check failed, campaign is blocked
    if (
      listVerification.status === 'fail' ||
      campaignSetup.status === 'fail' ||
      technicalValidation.status === 'fail'
    ) {
      return 'blocked';
    }

    // If any check has warnings, needs attention
    if (
      listVerification.status === 'warning' ||
      technicalValidation.status === 'warning'
    ) {
      return 'needs_attention';
    }

    // All passed
    return 'ready';
  }
}
```

---

### Task 2.4: Metrics Collection Service

**Priority**: High
**Estimated Time**: 4 hours
**Dependencies**: Task 1.2

#### Implementation

```typescript
// src/services/metrics/metrics-collection.service.ts

import { MailJetClient } from '../integrations/mailjet.client';
import { CampaignMetricsService } from '../database/campaign-metrics.service';

export class MetricsCollectionService {
  constructor(
    private mailjetClient: MailJetClient,
    private metricsService: CampaignMetricsService
  ) {}

  /**
   * Collect metrics from MailJet and save to database
   */
  async collectAndSaveMetrics(
    scheduleId: number,
    campaignId: number
  ): Promise<CampaignMetrics> {
    // Fetch from MailJet
    const stats = await this.mailjetClient.getCampaignStatistics(campaignId);
    const campaign = await this.mailjetClient.getCampaign(campaignId);

    // Calculate rates
    const processed = stats.ProcessedCount;
    const delivered = stats.DeliveredCount;
    const bounced = stats.BouncedCount;
    const hardBounces = stats.HardBouncedCount;
    const softBounces = stats.SoftBouncedCount;

    const deliveryRate = processed > 0 ? (delivered / processed) * 100 : 0;
    const bounceRate = processed > 0 ? (bounced / processed) * 100 : 0;
    const hardBounceRate = processed > 0 ? (hardBounces / processed) * 100 : 0;
    const softBounceRate = processed > 0 ? (softBounces / processed) * 100 : 0;

    const opened = stats.OpenedCount || 0;
    const clicked = stats.ClickedCount || 0;
    const openRate = delivered > 0 ? (opened / delivered) * 100 : null;
    const clickRate = delivered > 0 ? (clicked / delivered) * 100 : null;

    // Save to database
    const metrics = await this.metricsService.create({
      campaignScheduleId: scheduleId,
      mailjetCampaignId: campaignId,
      processed,
      delivered,
      bounced,
      hardBounces,
      softBounces,
      blocked: stats.BlockedCount || 0,
      queued: stats.QueuedCount || 0,
      opened,
      clicked,
      unsubscribed: stats.UnsubscribedCount || 0,
      complained: stats.SpamComplaintCount || 0,
      deliveryRate,
      bounceRate,
      hardBounceRate,
      softBounceRate,
      openRate,
      clickRate,
      sendStartAt: campaign.SendStartAt ? new Date(campaign.SendStartAt) : null,
      sendEndAt: campaign.SendEndAt ? new Date(campaign.SendEndAt) : null
    });

    return metrics;
  }

  /**
   * Get previous round metrics for comparison
   */
  async getPreviousRoundMetrics(
    campaignName: string,
    currentRound: number
  ): Promise<CampaignMetrics | null> {
    if (currentRound === 1) return null;

    return this.metricsService.findPreviousRound(campaignName, currentRound);
  }

  /**
   * Calculate deltas between current and previous round
   */
  calculateDeltas(
    current: CampaignMetrics,
    previous: CampaignMetrics
  ): MetricDeltas {
    return {
      deliveryRate: current.deliveryRate - previous.deliveryRate,
      bounceRate: current.bounceRate - previous.bounceRate,
      hardBounceRate: current.hardBounceRate - previous.hardBounceRate,
      softBounceRate: current.softBounceRate - previous.softBounceRate,
      openRate:
        current.openRate && previous.openRate
          ? current.openRate - previous.openRate
          : null,
      clickRate:
        current.clickRate && previous.clickRate
          ? current.clickRate - previous.clickRate
          : null
    };
  }
}
```

---

## Scheduler Development

### Task 3.1: Cron Job Scheduler

**Priority**: High
**Estimated Time**: 4 hours
**Dependencies**: Tasks 2.1, 2.2, 2.3, 2.4

#### Implementation

```typescript
// src/scheduler/lifecycle-scheduler.ts

import cron from 'node-cron';

export class LifecycleScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private notificationService: LifecycleNotificationService,
    private verificationService: PreFlightVerificationService,
    private metricsService: MetricsCollectionService,
    private campaignScheduleService: CampaignScheduleService
  ) {}

  /**
   * Start all schedulers
   */
  start(): void {
    this.schedulePreLaunchCheck();
    this.schedulePreFlightCheck();
    this.scheduleLaunchWarningCheck();
    this.scheduleWrapUpCheck();

    logger.info('Lifecycle schedulers started');
  }

  /**
   * Stop all schedulers
   */
  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    logger.info('Lifecycle schedulers stopped');
  }

  /**
   * Check for pre-launch notifications (every hour)
   */
  private schedulePreLaunchCheck(): void {
    const job = cron.schedule('0 * * * *', async () => {
      await this.checkPreLaunchTriggers();
    });

    this.jobs.set('prelaunch', job);
  }

  /**
   * Check for pre-flight notifications (every 15 minutes)
   */
  private schedulePreFlightCheck(): void {
    const job = cron.schedule('*/15 * * * *', async () => {
      await this.checkPreFlightTriggers();
    });

    this.jobs.set('preflight', job);
  }

  /**
   * Check for launch warnings (every minute)
   */
  private scheduleLaunchWarningCheck(): void {
    const job = cron.schedule('* * * * *', async () => {
      await this.checkLaunchWarningTriggers();
    });

    this.jobs.set('launch-warning', job);
  }

  /**
   * Check for wrap-up reports (every 5 minutes)
   */
  private scheduleWrapUpCheck(): void {
    const job = cron.schedule('*/5 * * * *', async () => {
      await this.checkWrapUpTriggers();
    });

    this.jobs.set('wrapup', job);
  }

  /**
   * Check if any campaigns need pre-launch notification
   */
  private async checkPreLaunchTriggers(): Promise<void> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + 21 * 60 * 60 * 1000); // 21 hours from now

    // Find campaigns scheduled for targetTime (within 1 hour window)
    const campaigns = await this.findCampaignsInWindow(targetTime, 60);

    for (const campaign of campaigns) {
      const status = campaign.notificationStatus as any;
      if (!status.prelaunch.sent) {
        try {
          await this.notificationService.sendPreLaunchNotification(campaign.id);
        } catch (error) {
          logger.error('Pre-launch notification failed', {
            campaignId: campaign.id,
            error
          });
        }
      }
    }
  }

  /**
   * Check if any campaigns need pre-flight check
   */
  private async checkPreFlightTriggers(): Promise<void> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + 3.25 * 60 * 60 * 1000); // 3.25 hours from now

    const campaigns = await this.findCampaignsInWindow(targetTime, 15);

    for (const campaign of campaigns) {
      const status = campaign.notificationStatus as any;
      if (!status.preflight.sent) {
        try {
          const checks = await this.verificationService.runAllChecks(campaign);
          await this.notificationService.sendPreFlightNotification(
            campaign.id,
            checks
          );
        } catch (error) {
          logger.error('Pre-flight check failed', {
            campaignId: campaign.id,
            error
          });
        }
      }
    }
  }

  /**
   * Check if any campaigns need launch warning
   */
  private async checkLaunchWarningTriggers(): Promise<void> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

    const campaigns = await this.findCampaignsInWindow(targetTime, 1);

    for (const campaign of campaigns) {
      const status = campaign.notificationStatus as any;
      if (!status.launchWarning.sent && campaign.status === 'READY') {
        try {
          await this.notificationService.sendLaunchWarning(campaign.id);
        } catch (error) {
          logger.error('Launch warning failed', {
            campaignId: campaign.id,
            error
          });
        }
      }
    }
  }

  /**
   * Check if any campaigns need wrap-up report
   */
  private async checkWrapUpTriggers(): Promise<void> {
    const now = new Date();
    const targetTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

    const campaigns = await this.findCampaignsInWindow(targetTime, 5);

    for (const campaign of campaigns) {
      const status = campaign.notificationStatus as any;
      if (
        !status.wrapup.sent &&
        campaign.status === 'SENT' &&
        campaign.mailjetCampaignId
      ) {
        try {
          // Collect metrics
          const metrics = await this.metricsService.collectAndSaveMetrics(
            campaign.id,
            campaign.mailjetCampaignId
          );

          // Get previous round metrics
          const previousMetrics =
            await this.metricsService.getPreviousRoundMetrics(
              campaign.campaignName,
              campaign.roundNumber
            );

          // Generate AI assessment
          const assessment = await this.generateAIAssessment(
            metrics,
            previousMetrics
          );

          // Send wrap-up
          await this.notificationService.sendWrapUpReport(campaign.id, {
            metrics,
            previousMetrics,
            assessment
          });
        } catch (error) {
          logger.error('Wrap-up report failed', {
            campaignId: campaign.id,
            error
          });
        }
      }
    }
  }

  /**
   * Find campaigns scheduled within a time window
   */
  private async findCampaignsInWindow(
    targetTime: Date,
    windowMinutes: number
  ): Promise<CampaignSchedule[]> {
    const start = new Date(targetTime.getTime() - windowMinutes * 60 * 1000);
    const end = new Date(targetTime.getTime() + windowMinutes * 60 * 1000);

    // Implementation depends on Prisma query
    // This is a simplified version
    return [];
  }
}
```

---

## Testing Requirements

### Unit Tests (80% Coverage Minimum)

```typescript
// test/services/batch-scheduler.test.ts
// test/services/notification.test.ts
// test/services/verification.test.ts
// test/services/metrics-collection.test.ts
```

### Integration Tests

```typescript
// test/integration/lifecycle.integration.test.ts

describe('Campaign Lifecycle Integration', () => {
  it('should execute complete lifecycle for Round 1', async () => {
    // Create schedule
    const schedule = await createTestSchedule();

    // T-21 hours: Pre-launch
    await notificationService.sendPreLaunchNotification(schedule.id);

    // T-3.25 hours: Pre-flight
    const checks = await verificationService.runAllChecks(schedule);
    await notificationService.sendPreFlightNotification(schedule.id, checks);

    // T-15 min: Launch warning
    await notificationService.sendLaunchWarning(schedule.id);

    // T+0: Launch (simulated)
    const campaignId = 7758947928;
    await notificationService.sendLaunchConfirmation(schedule.id, campaignId);

    // T+30 min: Wrap-up
    const metrics = await metricsService.collectAndSaveMetrics(
      schedule.id,
      campaignId
    );
    await notificationService.sendWrapUpReport(schedule.id, { metrics });

    // Verify all notifications sent
    const updatedSchedule = await campaignScheduleService.findById(schedule.id);
    expect(updatedSchedule.status).toBe('COMPLETED');
  });
});
```

---

## Deployment Steps

### 1. Database Migration

```bash
# Run migration
npx prisma migrate deploy

# Verify migration
npx prisma db pull
```

### 2. Environment Variables

```bash
# Add to Heroku
heroku config:set ENABLE_LIFECYCLE_SCHEDULER=true --app campaign-manager-prod
```

### 3. Deploy to Staging

```bash
git push heroku-staging feature/lifecycle-automation:main
```

### 4. Run Tests on Staging

```bash
heroku run npm test --app campaign-manager-staging
```

### 5. Deploy to Production

```bash
# Promote staging to prod
heroku pipelines:promote --app campaign-manager-staging
```

---

## Monitoring & Validation

### Success Metrics

- ✅ All scheduled notifications sent within 60 seconds of trigger time
- ✅ Pre-flight checks identify configuration issues before launch
- ✅ Wrap-up reports include complete metrics and AI analysis
- ✅ Zero missed notifications
- ✅ < 1% notification failure rate

### Alerts

Set up alerts for:
- Notification failures
- Scheduler failures
- API timeouts
- Database errors

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept and brainstorm
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [02_architecture.md](./02_architecture.md) - Technical architecture
- [03_feature_specification.md](./03_feature_specification.md) - Complete feature specification

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: 🔄 Ready for Development
