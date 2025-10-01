# Automated Campaign Lifecycle - TDD Specification

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: 📋 Ready for Implementation
- **Purpose**: Test-Driven Development specification for automated campaign lifecycle

---

## Testing Overview

### Testing Philosophy

**Test-First Development**
- Write tests before implementation
- Tests define expected behavior
- Implementation must pass all tests
- Refactor with confidence

### Coverage Requirements

| Component | Unit Tests | Integration Tests | E2E Tests | Min Coverage |
|-----------|------------|-------------------|-----------|--------------|
| Database Services | ✅ Required | ✅ Required | ❌ Not Required | 90% |
| Core Services | ✅ Required | ✅ Required | ✅ Required | 85% |
| External Clients | ✅ Required | ✅ Required | ❌ Not Required | 80% |
| Schedulers | ✅ Required | ✅ Required | ✅ Required | 85% |
| Overall | ✅ Required | ✅ Required | ✅ Required | 85% |

### Testing Stack

```typescript
const TESTING_STACK = {
  framework: 'Jest 29.x',
  assertions: '@testing-library/jest-dom',
  mocking: 'jest.mock() + jest.spyOn()',
  fixtures: 'Custom test data generators',
  coverage: 'Istanbul (built into Jest)',
  ci: 'GitHub Actions'
};
```

---

## Unit Tests

### Test Structure

```typescript
// Standard test file structure
describe('ServiceName', () => {
  // Setup
  let service: ServiceType;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(() => {
    // Reset mocks and initialize service
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do expected behavior when valid input', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw error when invalid input', () => {
      // Arrange
      // Act & Assert
    });

    it('should handle edge case', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

### Database Service Tests

#### CampaignScheduleService Tests

```typescript
// test/services/database/campaign-schedule.service.test.ts

import { PrismaClient } from '@prisma/client';
import { CampaignScheduleService } from '@/services/database/campaign-schedule.service';

describe('CampaignScheduleService', () => {
  let prisma: PrismaClient;
  let service: CampaignScheduleService;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new CampaignScheduleService(prisma);
  });

  afterEach(async () => {
    await prisma.campaignSchedule.deleteMany();
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('should create campaign schedule with valid data', async () => {
      const data = {
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
      };

      const schedule = await service.create(data);

      expect(schedule.id).toBeDefined();
      expect(schedule.campaignName).toBe('Test Campaign');
      expect(schedule.status).toBe('SCHEDULED');
      expect(schedule.notificationStatus).toBeDefined();
    });

    it('should set default notification status', async () => {
      const data = createTestScheduleData();
      const schedule = await service.create(data);

      const notifStatus = schedule.notificationStatus as any;
      expect(notifStatus.prelaunch.sent).toBe(false);
      expect(notifStatus.preflight.sent).toBe(false);
      expect(notifStatus.launchWarning.sent).toBe(false);
      expect(notifStatus.launchConfirmation.sent).toBe(false);
      expect(notifStatus.wrapup.sent).toBe(false);
    });

    it('should throw error with invalid data', async () => {
      const invalidData = { ...createTestScheduleData(), recipientCount: -1 };

      await expect(service.create(invalidData)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return schedule when exists', async () => {
      const created = await service.create(createTestScheduleData());
      const found = await service.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null when not exists', async () => {
      const found = await service.findById(99999);
      expect(found).toBeNull();
    });

    it('should include relations when requested', async () => {
      const created = await service.create(createTestScheduleData());
      const found = await service.findById(created.id);

      expect(found?.metrics).toBeDefined();
      expect(found?.notifications).toBeDefined();
    });
  });

  describe('findNextScheduled', () => {
    it('should return next scheduled campaign', async () => {
      await service.create({
        ...createTestScheduleData(),
        scheduledDate: new Date('2025-10-05')
      });

      await service.create({
        ...createTestScheduleData(),
        scheduledDate: new Date('2025-10-02')
      });

      const next = await service.findNextScheduled();
      expect(next?.scheduledDate).toEqual(new Date('2025-10-02'));
    });

    it('should return null when no future campaigns', async () => {
      await service.create({
        ...createTestScheduleData(),
        scheduledDate: new Date('2020-01-01')
      });

      const next = await service.findNextScheduled();
      expect(next).toBeNull();
    });

    it('should only return SCHEDULED status', async () => {
      await service.create({
        ...createTestScheduleData(),
        status: 'COMPLETED',
        scheduledDate: new Date('2025-10-02')
      });

      const next = await service.findNextScheduled();
      expect(next).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update campaign status', async () => {
      const schedule = await service.create(createTestScheduleData());

      await service.updateStatus(schedule.id, 'READY');

      const updated = await service.findById(schedule.id);
      expect(updated?.status).toBe('READY');
    });

    it('should update updatedAt timestamp', async () => {
      const schedule = await service.create(createTestScheduleData());
      const originalUpdatedAt = schedule.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 100));
      await service.updateStatus(schedule.id, 'READY');

      const updated = await service.findById(schedule.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update notification status for stage', async () => {
      const schedule = await service.create(createTestScheduleData());
      const timestamp = new Date();

      await service.updateNotificationStatus(
        schedule.id,
        'prelaunch',
        true,
        timestamp
      );

      const updated = await service.findById(schedule.id);
      const notifStatus = updated?.notificationStatus as any;

      expect(notifStatus.prelaunch.sent).toBe(true);
      expect(new Date(notifStatus.prelaunch.timestamp)).toEqual(timestamp);
    });

    it('should throw error when schedule not found', async () => {
      await expect(
        service.updateNotificationStatus(99999, 'prelaunch', true, new Date())
      ).rejects.toThrow('Schedule 99999 not found');
    });
  });

  describe('setCampaignId', () => {
    it('should set MailJet campaign ID', async () => {
      const schedule = await service.create(createTestScheduleData());

      await service.setCampaignId(schedule.id, 7758947928);

      const updated = await service.findById(schedule.id);
      expect(updated?.mailjetCampaignId).toBe(7758947928);
    });
  });
});

// Test data helper
function createTestScheduleData() {
  return {
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
  };
}
```

**Coverage Target**: 95%+
**Critical Paths**: create, findById, updateNotificationStatus

---

#### CampaignMetricsService Tests

```typescript
// test/services/database/campaign-metrics.service.test.ts

describe('CampaignMetricsService', () => {
  describe('create', () => {
    it('should create metrics with calculated rates', async () => {
      const data = {
        campaignScheduleId: 1,
        mailjetCampaignId: 7758947928,
        processed: 1000,
        delivered: 750,
        bounced: 250,
        hardBounces: 240,
        softBounces: 10,
        blocked: 0,
        queued: 0,
        opened: 200,
        clicked: 50,
        unsubscribed: 5,
        complained: 2,
        deliveryRate: 75.0,
        bounceRate: 25.0,
        hardBounceRate: 24.0,
        softBounceRate: 1.0,
        openRate: 26.67,
        clickRate: 6.67
      };

      const metrics = await service.create(data);

      expect(metrics.deliveryRate).toBe(75.0);
      expect(metrics.bounceRate).toBe(25.0);
      expect(metrics.openRate).toBeCloseTo(26.67, 2);
    });

    it('should handle zero processed count', async () => {
      const data = createTestMetricsData({ processed: 0 });

      await expect(service.create(data)).rejects.toThrow();
    });
  });

  describe('findPreviousRound', () => {
    it('should return metrics from previous round', async () => {
      // Create Round 1
      const schedule1 = await createTestSchedule({ roundNumber: 1 });
      const metrics1 = await service.create({
        ...createTestMetricsData(),
        campaignScheduleId: schedule1.id
      });

      // Create Round 2
      const schedule2 = await createTestSchedule({ roundNumber: 2 });

      // Find previous
      const previous = await service.findPreviousRound(
        schedule2.campaignName,
        schedule2.roundNumber
      );

      expect(previous?.id).toBe(metrics1.id);
    });

    it('should return null for Round 1', async () => {
      const previous = await service.findPreviousRound('Test Campaign', 1);
      expect(previous).toBeNull();
    });
  });
});
```

**Coverage Target**: 90%+

---

### Core Service Tests

#### BatchSchedulerService Tests

```typescript
// test/services/campaign/batch-scheduler.service.test.ts

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
    });

    it('should calculate correct recipient ranges', () => {
      const batches = service.calculateBatchSchedule(
        3529,
        new Date('2025-09-30')
      );

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

    it('should handle edge case of 1 recipient', () => {
      const batches = service.calculateBatchSchedule(1, new Date('2025-10-01'));

      expect(batches).toHaveLength(3);
      expect(batches[0].recipientCount).toBe(1);
      expect(batches[1].recipientCount).toBe(0);
      expect(batches[2].recipientCount).toBe(0);
    });

    it('should handle edge case of 2 recipients', () => {
      const batches = service.calculateBatchSchedule(2, new Date('2025-10-01'));

      expect(batches).toHaveLength(3);
      expect(batches[0].recipientCount).toBe(1);
      expect(batches[1].recipientCount).toBe(1);
      expect(batches[2].recipientCount).toBe(0);
    });
  });

  describe('getNextTuesdayOrThursday', () => {
    it('should return same date if already Tuesday', () => {
      const tuesday = new Date('2025-10-07'); // Tuesday
      const result = service['getNextTuesdayOrThursday'](tuesday);

      expect(result.getDay()).toBe(2);
      expect(result.toDateString()).toBe(tuesday.toDateString());
    });

    it('should return same date if already Thursday', () => {
      const thursday = new Date('2025-10-02'); // Thursday
      const result = service['getNextTuesdayOrThursday'](thursday);

      expect(result.getDay()).toBe(4);
      expect(result.toDateString()).toBe(thursday.toDateString());
    });

    it('should return next Tuesday from Monday', () => {
      const monday = new Date('2025-10-06');
      const result = service['getNextTuesdayOrThursday'](monday);

      expect(result.getDay()).toBe(2);
      expect(result.getDate()).toBe(7);
    });

    it('should return next Thursday from Wednesday', () => {
      const wednesday = new Date('2025-10-01');
      const result = service['getNextTuesdayOrThursday'](wednesday);

      expect(result.getDay()).toBe(4);
      expect(result.getDate()).toBe(2);
    });

    it('should return next Tuesday from Friday', () => {
      const friday = new Date('2025-10-03');
      const result = service['getNextTuesdayOrThursday'](friday);

      expect(result.getDay()).toBe(2);
      expect(result.getDate()).toBe(7);
    });

    it('should set time to 09:15:00', () => {
      const result = service['getNextTuesdayOrThursday'](new Date());

      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('createCampaignSchedule', () => {
    it('should create 3 campaign schedules', async () => {
      const params = {
        campaignName: 'Test Campaign',
        totalRecipients: 3000,
        startDate: new Date('2025-10-02'),
        subject: 'Test Subject',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com'
      };

      const schedules = await service.createCampaignSchedule(params);

      expect(schedules).toHaveLength(3);
      expect(schedules[0].roundNumber).toBe(1);
      expect(schedules[1].roundNumber).toBe(2);
      expect(schedules[2].roundNumber).toBe(3);
    });

    it('should use correct list names', async () => {
      const schedules = await service.createCampaignSchedule(
        createTestCampaignParams()
      );

      expect(schedules[0].listName).toBe('campaign_batch_001');
      expect(schedules[1].listName).toBe('campaign_batch_002');
      expect(schedules[2].listName).toBe('campaign_batch_003');
    });
  });
});
```

**Coverage Target**: 95%+
**Critical Paths**: calculateBatchSchedule, getNextTuesdayOrThursday

---

#### PreFlightVerificationService Tests

```typescript
// test/services/verification/preflight-verification.service.test.ts

describe('PreFlightVerificationService', () => {
  let service: PreFlightVerificationService;
  let mailjetClient: jest.Mocked<MailJetClient>;

  beforeEach(() => {
    mailjetClient = createMockMailJetClient();
    service = new PreFlightVerificationService(mailjetClient);
  });

  describe('verifyList', () => {
    it('should pass when list exists and count matches', async () => {
      mailjetClient.getContactsList.mockResolvedValue({
        ID: 12345,
        Name: 'test_list',
        SubscriberCount: 1000
      });

      const result = await service.verifyList(12345, 1000);

      expect(result.status).toBe('pass');
      expect(result.listExists).toBe(true);
      expect(result.subscriberCount).toBe(1000);
      expect(result.discrepancy).toBeNull();
    });

    it('should warn when count discrepancy < 10', async () => {
      mailjetClient.getContactsList.mockResolvedValue({
        ID: 12345,
        SubscriberCount: 1005
      });

      const result = await service.verifyList(12345, 1000);

      expect(result.status).toBe('warning');
      expect(result.discrepancy).toBe(5);
    });

    it('should warn when count discrepancy > 10', async () => {
      mailjetClient.getContactsList.mockResolvedValue({
        ID: 12345,
        SubscriberCount: 950
      });

      const result = await service.verifyList(12345, 1000);

      expect(result.status).toBe('warning');
      expect(result.discrepancy).toBe(50);
    });

    it('should fail when list does not exist', async () => {
      mailjetClient.getContactsList.mockRejectedValue(
        new Error('List not found')
      );

      const result = await service.verifyList(12345, 1000);

      expect(result.status).toBe('fail');
      expect(result.listExists).toBe(false);
    });
  });

  describe('verifyCampaignSetup', () => {
    it('should pass when all checks pass', async () => {
      mailjetClient.getCampaignDraft.mockResolvedValue({
        ID: 14119635,
        Subject: 'Test Subject',
        SenderEmail: 'test@example.com',
        SenderName: 'Test Sender',
        ContactsListID: 12345
      });

      mailjetClient.getCampaignContent.mockResolvedValue(
        '<html><body>Test content</body></html>'
      );

      const result = await service.verifyCampaignSetup(14119635);

      expect(result.status).toBe('pass');
      expect(result.draftExists).toBe(true);
      expect(result.contentLoaded).toBe(true);
      expect(result.subjectLineSet).toBe(true);
      expect(result.senderConfigured).toBe(true);
      expect(result.recipientListAttached).toBe(true);
    });

    it('should fail when draft does not exist', async () => {
      mailjetClient.getCampaignDraft.mockRejectedValue(
        new Error('Draft not found')
      );

      const result = await service.verifyCampaignSetup(14119635);

      expect(result.status).toBe('fail');
      expect(result.draftExists).toBe(false);
    });

    it('should fail when subject not set', async () => {
      mailjetClient.getCampaignDraft.mockResolvedValue({
        ID: 14119635,
        Subject: '',
        SenderEmail: 'test@example.com',
        SenderName: 'Test Sender',
        ContactsListID: 12345
      });

      mailjetClient.getCampaignContent.mockResolvedValue('content');

      const result = await service.verifyCampaignSetup(14119635);

      expect(result.status).toBe('fail');
      expect(result.subjectLineSet).toBe(false);
    });
  });

  describe('verifyTechnicalConfig', () => {
    it('should pass when all checks pass', async () => {
      mailjetClient.getCampaignContent.mockResolvedValue(`
        <html>
          <body>
            <a href="https://example.com">Link</a>
            <a href="[[UNSUB_LINK_EN]]">Unsubscribe</a>
          </body>
        </html>
      `);

      const result = await service.verifyTechnicalConfig(14119635);

      expect(result.status).toBe('pass');
      expect(result.linksValid).toBe(true);
      expect(result.unsubscribeLinkPresent).toBe(true);
    });

    it('should fail when no unsubscribe link', async () => {
      mailjetClient.getCampaignContent.mockResolvedValue(`
        <html><body><a href="https://example.com">Link</a></body></html>
      `);

      const result = await service.verifyTechnicalConfig(14119635);

      expect(result.status).toBe('warning');
      expect(result.unsubscribeLinkPresent).toBe(false);
    });
  });

  describe('runAllChecks', () => {
    it('should return ready when all checks pass', async () => {
      // Mock all checks to pass
      jest.spyOn(service, 'verifyList').mockResolvedValue({
        listExists: true,
        subscriberCount: 1000,
        expectedCount: 1000,
        discrepancy: null,
        status: 'pass'
      });

      jest.spyOn(service, 'verifyCampaignSetup').mockResolvedValue({
        draftExists: true,
        contentLoaded: true,
        subjectLineSet: true,
        senderConfigured: true,
        recipientListAttached: true,
        status: 'pass'
      });

      jest.spyOn(service, 'verifyTechnicalConfig').mockResolvedValue({
        linksValid: true,
        unsubscribeLinkPresent: true,
        trackingConfigured: true,
        spfDkimValid: true,
        status: 'pass'
      });

      const schedule = createTestSchedule();
      const result = await service.runAllChecks(schedule);

      expect(result.overallStatus).toBe('ready');
    });

    it('should return blocked when any check fails', async () => {
      jest.spyOn(service, 'verifyList').mockResolvedValue({
        listExists: false,
        subscriberCount: 0,
        expectedCount: 1000,
        discrepancy: 1000,
        status: 'fail'
      });

      const schedule = createTestSchedule();
      const result = await service.runAllChecks(schedule);

      expect(result.overallStatus).toBe('blocked');
    });

    it('should return needs_attention when warnings', async () => {
      jest.spyOn(service, 'verifyList').mockResolvedValue({
        listExists: true,
        subscriberCount: 950,
        expectedCount: 1000,
        discrepancy: 50,
        status: 'warning'
      });

      jest.spyOn(service, 'verifyCampaignSetup').mockResolvedValue({
        draftExists: true,
        contentLoaded: true,
        subjectLineSet: true,
        senderConfigured: true,
        recipientListAttached: true,
        status: 'pass'
      });

      jest.spyOn(service, 'verifyTechnicalConfig').mockResolvedValue({
        linksValid: true,
        unsubscribeLinkPresent: true,
        trackingConfigured: true,
        spfDkimValid: true,
        status: 'pass'
      });

      const schedule = createTestSchedule();
      const result = await service.runAllChecks(schedule);

      expect(result.overallStatus).toBe('needs_attention');
    });
  });
});
```

**Coverage Target**: 90%+
**Critical Paths**: runAllChecks, determineOverallStatus

---

## Integration Tests

### MailJet API Integration

```typescript
// test/integration/mailjet-api.integration.test.ts

describe('MailJet API Integration', () => {
  let client: MailJetClient;

  beforeAll(() => {
    client = new MailJetClient({
      apiKey: process.env.MAILJET_API_KEY!,
      secretKey: process.env.MAILJET_SECRET_KEY!
    });
  });

  describe('getCampaignStatistics', () => {
    it('should fetch real campaign statistics', async () => {
      const campaignId = 7758947928; // Round 1 campaign

      const stats = await client.getCampaignStatistics(campaignId);

      expect(stats.ProcessedCount).toBeGreaterThan(0);
      expect(stats.DeliveredCount).toBeGreaterThan(0);
      expect(stats.BouncedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-existent campaign', async () => {
      await expect(client.getCampaignStatistics(99999999)).rejects.toThrow();
    });
  });

  describe('getContactsList', () => {
    it('should fetch real contact list', async () => {
      const listId = 10502980; // campaign_batch_001

      const list = await client.getContactsList(listId);

      expect(list.ID).toBe(listId);
      expect(list.Name).toBe('campaign_batch_001');
      expect(list.SubscriberCount).toBeGreaterThan(0);
    });
  });
});
```

**Test Environment**: Staging MailJet account
**Coverage Target**: 80%+

---

### Slack MCP Integration

```typescript
// test/integration/slack-mcp.integration.test.ts

describe('Slack MCP Integration', () => {
  let client: SlackMCPClient;
  const testChannelId = process.env.SLACK_TEST_CHANNEL_ID!;

  beforeAll(() => {
    client = new SlackMCPClient({
      serverUrl: process.env.SLACK_MANAGER_URL!,
      apiToken: process.env.SLACK_MANAGER_API_TOKEN!
    });
  });

  describe('postMessage', () => {
    it('should post simple text message', async () => {
      const result = await client.postMessage({
        channel: testChannelId,
        text: 'Test message from integration test'
      });

      expect(result.ok).toBe(true);
      expect(result.ts).toBeDefined();
    });

    it('should post Block Kit message', async () => {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Test Header'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test content'
          }
        }
      ];

      const result = await client.postMessage({
        channel: testChannelId,
        blocks,
        text: 'Fallback text'
      });

      expect(result.ok).toBe(true);
    });

    it('should handle invalid channel', async () => {
      await expect(
        client.postMessage({
          channel: 'INVALID',
          text: 'Test'
        })
      ).rejects.toThrow();
    });
  });
});
```

**Test Environment**: Staging Slack channel (#test-lifecycle)
**Coverage Target**: 75%+

---

### Database Integration

```typescript
// test/integration/database.integration.test.ts

describe('Database Integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CampaignSchedule Lifecycle', () => {
    it('should create, update, and query schedule', async () => {
      // Create
      const schedule = await prisma.campaignSchedule.create({
        data: createTestScheduleData()
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.status).toBe('SCHEDULED');

      // Update
      await prisma.campaignSchedule.update({
        where: { id: schedule.id },
        data: { status: 'READY' }
      });

      // Query
      const updated = await prisma.campaignSchedule.findUnique({
        where: { id: schedule.id }
      });

      expect(updated?.status).toBe('READY');

      // Cleanup
      await prisma.campaignSchedule.delete({
        where: { id: schedule.id }
      });
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create metrics without schedule
      await expect(
        prisma.campaignMetrics.create({
          data: {
            campaignScheduleId: 99999,
            mailjetCampaignId: 12345,
            ...createTestMetricsData()
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Complex Queries', () => {
    it('should query schedules with metrics', async () => {
      const schedule = await prisma.campaignSchedule.create({
        data: createTestScheduleData()
      });

      await prisma.campaignMetrics.create({
        data: {
          campaignScheduleId: schedule.id,
          mailjetCampaignId: 12345,
          ...createTestMetricsData()
        }
      });

      const result = await prisma.campaignSchedule.findUnique({
        where: { id: schedule.id },
        include: { metrics: true }
      });

      expect(result?.metrics).toHaveLength(1);

      // Cleanup
      await prisma.campaignMetrics.deleteMany({
        where: { campaignScheduleId: schedule.id }
      });
      await prisma.campaignSchedule.delete({
        where: { id: schedule.id }
      });
    });
  });
});
```

**Test Environment**: Test database (separate from staging/prod)
**Coverage Target**: 85%+

---

## End-to-End Tests

### Complete Lifecycle Test

```typescript
// test/e2e/campaign-lifecycle.e2e.test.ts

describe('Campaign Lifecycle E2E', () => {
  let system: LifecycleSystem;

  beforeAll(async () => {
    system = await initializeTestSystem();
  });

  afterAll(async () => {
    await system.cleanup();
  });

  it('should execute complete lifecycle for Round 1', async () => {
    // Create campaign schedule
    const schedule = await system.campaignService.createCampaignSchedule({
      campaignName: 'E2E Test Campaign',
      totalRecipients: 300,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      subject: 'E2E Test Subject',
      senderName: 'E2E Test Sender',
      senderEmail: 'test@example.com'
    });

    expect(schedule).toHaveLength(3);

    // Stage 1: Pre-Launch (simulate T-21 hours)
    await system.notificationService.sendPreLaunchNotification(schedule[0].id);

    let updated = await system.campaignService.findById(schedule[0].id);
    expect((updated.notificationStatus as any).prelaunch.sent).toBe(true);

    // Stage 2: Pre-Flight (simulate T-3.25 hours)
    const checks = await system.verificationService.runAllChecks(schedule[0]);
    await system.notificationService.sendPreFlightNotification(
      schedule[0].id,
      checks
    );

    updated = await system.campaignService.findById(schedule[0].id);
    expect((updated.notificationStatus as any).preflight.sent).toBe(true);

    // Stage 3: Launch Warning (simulate T-15 min)
    await system.notificationService.sendLaunchWarning(schedule[0].id);

    updated = await system.campaignService.findById(schedule[0].id);
    expect((updated.notificationStatus as any).launchWarning.sent).toBe(true);
    expect(updated.status).toBe('LAUNCHING');

    // Stage 4: Launch Confirmation (simulate T+0)
    const campaignId = await system.launchCampaign(schedule[0].id);
    await system.notificationService.sendLaunchConfirmation(
      schedule[0].id,
      campaignId
    );

    updated = await system.campaignService.findById(schedule[0].id);
    expect((updated.notificationStatus as any).launchConfirmation.sent).toBe(true);
    expect(updated.status).toBe('SENT');

    // Stage 5: Wrap-Up (simulate T+30 min)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for metrics

    const metrics = await system.metricsService.collectAndSaveMetrics(
      schedule[0].id,
      campaignId
    );

    const assessment = await system.aiService.generateAssessment(metrics);

    await system.notificationService.sendWrapUpReport(schedule[0].id, {
      metrics,
      assessment
    });

    updated = await system.campaignService.findById(schedule[0].id);
    expect((updated.notificationStatus as any).wrapup.sent).toBe(true);
    expect(updated.status).toBe('COMPLETED');

    // Verify all stages completed
    const notifStatus = updated.notificationStatus as any;
    expect(notifStatus.prelaunch.sent).toBe(true);
    expect(notifStatus.preflight.sent).toBe(true);
    expect(notifStatus.launchWarning.sent).toBe(true);
    expect(notifStatus.launchConfirmation.sent).toBe(true);
    expect(notifStatus.wrapup.sent).toBe(true);

    // Verify metrics saved
    const savedMetrics = await system.metricsService.findByScheduleId(
      schedule[0].id
    );
    expect(savedMetrics).toBeDefined();

    // Verify Slack notifications sent
    const notifications = await system.notificationLogService.findByCampaignSchedule(
      schedule[0].id
    );
    expect(notifications).toHaveLength(5);
    expect(notifications.every(n => n.status === 'SUCCESS')).toBe(true);
  });

  it('should handle pre-flight check failure', async () => {
    // Create schedule with invalid list ID
    const schedule = await system.campaignService.create({
      ...createTestScheduleData(),
      listId: 99999999 // Non-existent list
    });

    // Run pre-flight checks
    const checks = await system.verificationService.runAllChecks(schedule);

    expect(checks.overallStatus).toBe('blocked');
    expect(checks.checks.listVerification.status).toBe('fail');

    // Send notification
    await system.notificationService.sendPreFlightNotification(
      schedule.id,
      checks
    );

    // Verify status updated
    const updated = await system.campaignService.findById(schedule.id);
    expect(updated.status).toBe('BLOCKED');
  });

  it('should compare Round 2 to Round 1', async () => {
    // Create both rounds
    const schedules = await system.campaignService.createCampaignSchedule({
      campaignName: 'Comparison Test',
      totalRecipients: 300,
      startDate: new Date(),
      subject: 'Test',
      senderName: 'Test',
      senderEmail: 'test@example.com'
    });

    // Simulate Round 1 completion
    const round1CampaignId = await system.launchCampaign(schedules[0].id);
    const round1Metrics = await system.metricsService.collectAndSaveMetrics(
      schedules[0].id,
      round1CampaignId
    );

    // Simulate Round 2 completion
    const round2CampaignId = await system.launchCampaign(schedules[1].id);
    const round2Metrics = await system.metricsService.collectAndSaveMetrics(
      schedules[1].id,
      round2CampaignId
    );

    // Generate comparison
    const assessment = await system.aiService.generateAssessment(
      round2Metrics,
      round1Metrics
    );

    expect(assessment.comparison).toBeDefined();
    expect(assessment.comparison).toContain('Round 1');
  });
});
```

**Test Environment**: Staging environment with real APIs
**Duration**: 5-10 minutes per test
**Coverage Target**: 80%+

---

## Performance Tests

### Load Testing

```typescript
// test/performance/scheduler.performance.test.ts

describe('Scheduler Performance', () => {
  it('should handle 100 concurrent campaigns', async () => {
    const campaigns = Array.from({ length: 100 }, (_, i) =>
      createTestScheduleData({ campaignName: `Campaign ${i}` })
    );

    const startTime = Date.now();

    await Promise.all(
      campaigns.map(data => campaignService.create(data))
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
  });

  it('should process notifications within SLA', async () => {
    const schedule = await createTestSchedule();

    const startTime = Date.now();
    await notificationService.sendPreLaunchNotification(schedule.id);
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(60000); // < 60 seconds
  });
});
```

**Performance Targets**:
- Notification delivery: < 60 seconds
- Pre-flight checks: < 30 seconds
- AI analysis: < 30 seconds
- Database queries: < 1 second

---

## Test Data Management

### Test Fixtures

```typescript
// test/fixtures/campaign-schedule.fixture.ts

export function createTestScheduleData(overrides = {}) {
  return {
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
    senderEmail: 'test@example.com',
    ...overrides
  };
}

export function createTestMetricsData(overrides = {}) {
  return {
    processed: 1000,
    delivered: 750,
    bounced: 250,
    hardBounces: 240,
    softBounces: 10,
    blocked: 0,
    queued: 0,
    opened: 200,
    clicked: 50,
    unsubscribed: 5,
    complained: 2,
    deliveryRate: 75.0,
    bounceRate: 25.0,
    hardBounceRate: 24.0,
    softBounceRate: 1.0,
    openRate: 26.67,
    clickRate: 6.67,
    ...overrides
  };
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          MAILJET_API_KEY: ${{ secrets.MAILJET_TEST_API_KEY }}
          MAILJET_SECRET_KEY: ${{ secrets.MAILJET_TEST_SECRET_KEY }}
          SLACK_MANAGER_URL: ${{ secrets.SLACK_TEST_URL }}
          SLACK_MANAGER_API_TOKEN: ${{ secrets.SLACK_TEST_TOKEN }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [02_architecture.md](./02_architecture.md) - Technical architecture
- [03_feature_specification.md](./03_feature_specification.md) - Feature details
- [04_development_specification.md](./04_development_specification.md) - Development tasks
- [06_implementation_plan.md](./06_implementation_plan.md) - Implementation plan

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: 📋 Ready for Implementation
