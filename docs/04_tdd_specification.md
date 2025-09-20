# Campaign Manager - Test-Driven Development Specification

## Document Information
- Version: 1.0
- Date: 2025-09-20
- Status: Active
- Purpose: Define comprehensive TDD approach for Campaign Manager development
- Language: TypeScript
- Testing Framework: Jest with ts-jest

## Testing Philosophy

### Core Principles
1. **Test-First Development**: Write tests before implementation
2. **Behavior-Driven**: Test user behavior, not implementation details
3. **Fast Feedback Loop**: Unit tests < 10ms, integration < 100ms
4. **Isolated Testing**: No external dependencies in unit tests
5. **Comprehensive Coverage**: Minimum 85% coverage across all metrics

## Testing Stack

### Core Technologies
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0",
    "jest-extended": "^4.0.0",
    "@faker-js/faker": "^8.3.0",
    "supertest": "^6.3.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "jest-mock-extended": "^3.0.0",
    "nock": "^13.4.0"
  }
}
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  maxWorkers: '50%',
};
```

## Test Structure

### Directory Organization
```
tests/
├── unit/
│   ├── services/
│   │   ├── campaign/
│   │   │   ├── campaign.service.test.ts
│   │   │   ├── timeline.service.test.ts
│   │   │   └── scheduling.service.test.ts
│   │   ├── task/
│   │   │   ├── task.service.test.ts
│   │   │   ├── assignment.service.test.ts
│   │   │   └── escalation.service.test.ts
│   │   └── notification/
│   │       ├── notification.service.test.ts
│   │       └── slack.service.test.ts
│   ├── api/
│   │   ├── middleware/
│   │   └── validators/
│   └── workers/
├── integration/
│   ├── api/
│   │   ├── campaigns.test.ts
│   │   ├── tasks.test.ts
│   │   └── approvals.test.ts
│   ├── database/
│   │   ├── repositories/
│   │   └── transactions/
│   └── workers/
│       ├── notification.worker.test.ts
│       └── escalation.worker.test.ts
├── e2e/
│   ├── campaign-creation.test.ts
│   ├── task-management.test.ts
│   ├── approval-workflow.test.ts
│   └── campaign-launch.test.ts
├── fixtures/
│   ├── campaigns.ts
│   ├── tasks.ts
│   ├── teams.ts
│   └── approvals.ts
├── factories/
│   ├── campaign.factory.ts
│   ├── task.factory.ts
│   └── notification.factory.ts
├── mocks/
│   ├── handlers/
│   │   ├── slack.ts
│   │   ├── mailjet.ts
│   │   └── marketing.ts
│   └── server.ts
└── setup.ts
```

## Unit Tests (60% of tests)

### Campaign Service Tests
```typescript
// tests/unit/services/campaign/campaign.service.test.ts
import { CampaignService } from '@/services/campaign/campaign.service';
import { prismaMock } from '@tests/mocks/prisma';
import { createCampaignFactory } from '@tests/factories/campaign.factory';

describe('CampaignService', () => {
  let service: CampaignService;

  beforeEach(() => {
    service = new CampaignService();
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create campaign with auto-generated timeline', async () => {
      const input = createCampaignFactory();
      prismaMock.campaign.create.mockResolvedValue(input);

      const result = await service.createCampaign(input);

      expect(result).toHaveProperty('id');
      expect(result.timeline).toBeDefined();
      expect(result.timeline.milestones).toBeArrayOfSize(4);
    });

    it('should detect scheduling conflicts', async () => {
      const existingCampaign = createCampaignFactory({
        targetDate: new Date('2025-02-01')
      });
      prismaMock.campaign.findMany.mockResolvedValue([existingCampaign]);

      const newCampaign = createCampaignFactory({
        targetDate: new Date('2025-02-01')
      });

      await expect(service.createCampaign(newCampaign))
        .rejects.toThrow('Schedule conflict detected');
    });

    it('should apply campaign template correctly', async () => {
      const input = createCampaignFactory({ type: 'webinar' });

      const result = await service.createCampaign(input);

      expect(result.timeline.template).toBe('webinar');
      expect(result.timeline.buffer).toBe(72); // 3 days for webinar
    });
  });

  describe('updateCampaignStatus', () => {
    it('should transition status correctly', async () => {
      const campaign = createCampaignFactory({ status: 'planning' });
      prismaMock.campaign.findUnique.mockResolvedValue(campaign);

      await service.updateStatus(campaign.id, 'preparation');

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: campaign.id },
        data: expect.objectContaining({ status: 'preparation' })
      });
    });

    it('should reject invalid status transitions', async () => {
      const campaign = createCampaignFactory({ status: 'completed' });
      prismaMock.campaign.findUnique.mockResolvedValue(campaign);

      await expect(service.updateStatus(campaign.id, 'planning'))
        .rejects.toThrow('Invalid status transition');
    });

    it('should trigger notifications on status change', async () => {
      const notificationSpy = jest.spyOn(service, 'notifyStatusChange');
      const campaign = createCampaignFactory({ status: 'review' });

      await service.updateStatus(campaign.id, 'scheduled');

      expect(notificationSpy).toHaveBeenCalledWith(
        campaign.id,
        'review',
        'scheduled'
      );
    });
  });
});
```

### Task Assignment Tests
```typescript
// tests/unit/services/task/assignment.service.test.ts
describe('AssignmentService', () => {
  describe('assignTask', () => {
    it('should assign to least busy team member', async () => {
      const members = [
        createTeamMember({ id: '1', currentTasks: 2 }),
        createTeamMember({ id: '2', currentTasks: 5 }),
        createTeamMember({ id: '3', currentTasks: 1 }),
      ];
      prismaMock.teamMember.findMany.mockResolvedValue(members);

      const task = createTask({ skills: ['copywriting'] });
      const assignee = await service.assignTask(task);

      expect(assignee.id).toBe('3'); // Member with 1 task
    });

    it('should match required skills', async () => {
      const members = [
        createTeamMember({ skills: ['design'] }),
        createTeamMember({ skills: ['copywriting', 'seo'] }),
      ];

      const task = createTask({ requiredSkills: ['copywriting'] });
      const assignee = await service.assignTask(task);

      expect(assignee.skills).toContain('copywriting');
    });

    it('should consider timezone for urgent tasks', async () => {
      const task = createTask({
        priority: 'critical',
        dueDate: addHours(new Date(), 4)
      });

      const assignee = await service.assignTask(task);

      expect(isWithinWorkingHours(assignee.timezone)).toBe(true);
    });

    it('should handle no available assignees', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([]);

      const task = createTask();

      await expect(service.assignTask(task))
        .rejects.toThrow('No available team members');
    });
  });

  describe('reassignTask', () => {
    it('should reassign and notify both parties', async () => {
      const task = createTask({ assigneeId: 'user1' });
      const newAssignee = createTeamMember({ id: 'user2' });

      await service.reassignTask(task.id, newAssignee.id);

      expect(notificationService.send).toHaveBeenCalledTimes(2);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user1',
          type: 'task_removed'
        })
      );
    });
  });
});
```

### Notification Service Tests
```typescript
// tests/unit/services/notification/notification.service.test.ts
describe('NotificationService', () => {
  describe('sendNotification', () => {
    it('should route to correct channel', async () => {
      const slackSpy = jest.spyOn(slackService, 'send');
      const emailSpy = jest.spyOn(emailService, 'send');

      await service.send({
        channel: 'slack',
        recipient: 'U123456',
        message: 'Test message'
      });

      expect(slackSpy).toHaveBeenCalled();
      expect(emailSpy).not.toHaveBeenCalled();
    });

    it('should batch notifications when appropriate', async () => {
      const notifications = Array(5).fill(null).map(() =>
        createNotification({ recipient: 'user1', urgency: 'low' })
      );

      await Promise.all(notifications.map(n => service.send(n)));

      expect(emailService.sendBatch).toHaveBeenCalledTimes(1);
      expect(emailService.sendBatch).toHaveBeenCalledWith(
        expect.arrayContaining(notifications)
      );
    });

    it('should escalate on delivery failure', async () => {
      slackService.send.mockRejectedValue(new Error('API error'));

      await service.send({
        channel: 'slack',
        recipient: 'U123456',
        urgency: 'critical',
        message: 'Critical alert'
      });

      expect(escalationService.escalate).toHaveBeenCalled();
    });
  });

  describe('scheduleReminders', () => {
    it('should schedule progressive reminders', async () => {
      const task = createTask({
        dueDate: addDays(new Date(), 3)
      });

      const reminders = await service.scheduleReminders(task);

      expect(reminders).toHaveLength(3);
      expect(reminders[0].scheduledFor).toBeCloseTo(
        subDays(task.dueDate, 2),
        { hours: 1 }
      );
    });

    it('should skip reminders for completed tasks', async () => {
      const task = createTask({ status: 'completed' });

      const reminders = await service.scheduleReminders(task);

      expect(reminders).toHaveLength(0);
    });
  });
});
```

### Approval Workflow Tests
```typescript
// tests/unit/services/approval/approval.service.test.ts
describe('ApprovalService', () => {
  describe('requestApproval', () => {
    it('should create approval request with deadline', async () => {
      const campaign = createCampaign();
      const approvers = ['user1', 'user2'];

      await service.requestApproval(campaign.id, 'content', approvers);

      expect(prismaMock.approval.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            campaignId: campaign.id,
            stage: 'content',
            approverId: 'user1',
            deadline: expect.any(Date)
          })
        ])
      });
    });

    it('should enforce unanimous approval when required', async () => {
      const approvals = [
        createApproval({ status: 'approved' }),
        createApproval({ status: 'approved' }),
        createApproval({ status: 'rejected' }),
      ];

      const result = service.evaluateApprovals(approvals, true);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('unanimous');
    });
  });

  describe('autoApprove', () => {
    it('should auto-approve after timeout', async () => {
      jest.useFakeTimers();
      const approval = createApproval({
        deadline: new Date(),
        autoApproveAfter: 24 // hours
      });

      jest.advanceTimersByTime(25 * 60 * 60 * 1000);
      await service.processAutoApprovals();

      expect(prismaMock.approval.update).toHaveBeenCalledWith({
        where: { id: approval.id },
        data: { status: 'approved', comments: 'Auto-approved after timeout' }
      });
    });
  });
});
```

## Integration Tests (30% of tests)

### API Integration Tests
```typescript
// tests/integration/api/campaigns.test.ts
import { buildApp } from '@/api/server';
import request from 'supertest';
import { FastifyInstance } from 'fastify';

describe('Campaign API Integration', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Get auth token
    const loginRes = await request(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/campaigns', () => {
    it('should create campaign with full workflow', async () => {
      const campaignData = {
        name: 'Q1 Product Launch',
        type: 'product_launch',
        targetDate: '2025-03-01',
        objectives: ['Increase awareness', 'Drive signups'],
        priority: 'high'
      };

      const response = await request(app.server)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        campaign: expect.objectContaining({
          id: expect.any(String),
          name: campaignData.name,
          status: 'planning'
        }),
        timeline: expect.objectContaining({
          milestones: expect.arrayContaining([
            expect.objectContaining({ name: 'Content Draft' })
          ])
        }),
        tasks: expect.arrayContaining([
          expect.objectContaining({ title: expect.any(String) })
        ])
      });

      // Verify database state
      const campaign = await prisma.campaign.findUnique({
        where: { id: response.body.campaign.id },
        include: { tasks: true, timeline: true }
      });

      expect(campaign?.tasks).toHaveLength(response.body.tasks.length);
    });

    it('should validate request schema', async () => {
      const invalidData = {
        name: 'Test',
        // Missing required fields
      };

      const response = await request(app.server)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VAL_002');
    });
  });

  describe('GET /api/v1/campaigns/:id', () => {
    it('should return campaign with computed readiness score', async () => {
      const campaign = await createTestCampaign();

      const response = await request(app.server)
        .get(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.readinessScore).toBeGreaterThanOrEqual(0);
      expect(response.body.readinessScore).toBeLessThanOrEqual(100);
    });

    it('should include real-time task statistics', async () => {
      const campaign = await createTestCampaign();
      await createTestTasks(campaign.id, 10);

      const response = await request(app.server)
        .get(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { tasks } = response.body;
      expect(tasks.total).toBe(10);
      expect(tasks.completed + tasks.inProgress + tasks.blocked).toBeLessThanOrEqual(10);
    });
  });
});
```

### Database Integration Tests
```typescript
// tests/integration/database/campaign.repository.test.ts
describe('CampaignRepository Integration', () => {
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE campaigns CASCADE`;
  });

  describe('complex queries', () => {
    it('should filter campaigns with multiple criteria', async () => {
      await createTestCampaigns(20);

      const results = await repository.findCampaigns({
        status: ['scheduled', 'live'],
        assignee: 'user1',
        dateRange: {
          from: new Date('2025-01-01'),
          to: new Date('2025-03-31')
        },
        hasBlockers: false
      });

      expect(results).toSatisfyAll(campaign =>
        ['scheduled', 'live'].includes(campaign.status)
      );
    });

    it('should handle concurrent updates safely', async () => {
      const campaign = await createTestCampaign();

      const updates = Array(10).fill(null).map((_, i) =>
        repository.updateCampaign(campaign.id, {
          name: `Update ${i}`
        })
      );

      await Promise.all(updates);

      const final = await repository.getCampaign(campaign.id);
      expect(final.name).toMatch(/Update \d+/);
    });
  });

  describe('transaction handling', () => {
    it('should rollback on failure', async () => {
      const campaign = await createTestCampaign();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.campaign.update({
            where: { id: campaign.id },
            data: { status: 'cancelled' }
          });

          // This should fail
          await tx.task.create({
            data: {
              campaignId: campaign.id,
              invalidField: 'value' // This will cause error
            }
          });
        })
      ).rejects.toThrow();

      // Verify rollback
      const unchanged = await prisma.campaign.findUnique({
        where: { id: campaign.id }
      });
      expect(unchanged?.status).not.toBe('cancelled');
    });
  });
});
```

### Worker Integration Tests
```typescript
// tests/integration/workers/notification.worker.test.ts
import { Queue, Worker } from 'bullmq';

describe('NotificationWorker Integration', () => {
  let queue: Queue;
  let worker: Worker;

  beforeAll(() => {
    queue = new Queue('notifications', { connection });
    worker = new Worker('notifications', notificationProcessor, { connection });
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
  });

  it('should process notification job successfully', async () => {
    const job = await queue.add('send', {
      type: 'task_reminder',
      recipient: 'user@example.com',
      channel: 'email',
      payload: { taskId: '123', dueIn: '2 hours' }
    });

    const completed = await job.waitUntilFinished(worker);

    expect(completed).toMatchObject({
      sent: true,
      timestamp: expect.any(Date)
    });
  });

  it('should retry failed jobs', async () => {
    const job = await queue.add('send', {
      type: 'invalid_type',
      recipient: 'user@example.com'
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });

    await expect(job.waitUntilFinished(worker)).rejects.toThrow();

    const jobState = await job.getState();
    expect(jobState).toBe('failed');
    expect(await job.getFailedReason()).toContain('invalid_type');
  });
});
```

## End-to-End Tests (10% of tests)

### Campaign Creation Flow
```typescript
// tests/e2e/campaign-creation.test.ts
import { test, expect } from '@playwright/test';

test.describe('Campaign Creation E2E', () => {
  test('should create campaign from start to finish', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'manager@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Navigate to campaigns
    await page.click('a[href="/campaigns"]');
    await page.click('button:text("New Campaign")');

    // Fill campaign details
    await page.fill('[name="name"]', 'Summer Sale 2025');
    await page.selectOption('[name="type"]', 'email_blast');
    await page.fill('[name="targetDate"]', '2025-07-01');
    await page.click('button:text("Next")');

    // Configure timeline
    await page.click('input[value="standard"]');
    await page.click('button:text("Generate Timeline")');

    // Wait for timeline generation
    await expect(page.locator('.timeline-milestones')).toBeVisible();
    await page.click('button:text("Next")');

    // Assign team
    await page.click('.team-member-card:first-child');
    await page.click('button:text("Auto-assign remaining")');
    await page.click('button:text("Create Campaign")');

    // Verify creation
    await expect(page).toHaveURL(/\/campaigns\/[\w-]+/);
    await expect(page.locator('h1')).toContainText('Summer Sale 2025');
    await expect(page.locator('.campaign-status')).toContainText('Planning');

    // Verify tasks created
    const taskCount = await page.locator('.task-list-item').count();
    expect(taskCount).toBeGreaterThan(0);

    // Verify notifications sent
    await page.click('button[aria-label="Notifications"]');
    await expect(page.locator('.notification-item')).toContainText('assigned');
  });

  test('should handle scheduling conflicts', async ({ page }) => {
    await createExistingCampaign('2025-07-01');

    await page.goto('/campaigns/new');
    await page.fill('[name="targetDate"]', '2025-07-01');
    await page.click('button:text("Check Availability")');

    await expect(page.locator('.conflict-warning')).toContainText(
      'Schedule conflict detected'
    );
  });
});
```

## Test Data Management

### Factories
```typescript
// tests/factories/campaign.factory.ts
import { faker } from '@faker-js/faker';

export const createCampaignFactory = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.commerce.productName(),
  type: faker.helpers.arrayElement(['email_blast', 'webinar', 'product_launch']),
  status: 'planning',
  targetDate: faker.date.future(),
  objectives: faker.lorem.sentences(2).split('.').filter(Boolean),
  priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
  createdAt: faker.date.recent(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

// tests/factories/task.factory.ts
export const createTaskFactory = (overrides = {}) => ({
  id: faker.string.uuid(),
  campaignId: faker.string.uuid(),
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  assigneeId: faker.string.uuid(),
  dueDate: faker.date.future(),
  priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
  status: 'pending',
  dependencies: [],
  createdAt: faker.date.recent(),
  ...overrides,
});
```

### MSW Mocks
```typescript
// tests/mocks/handlers/slack.ts
import { rest } from 'msw';

export const slackHandlers = [
  rest.post('http://slack-manager:3002/mcp/tools/slack_post_message', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        message_id: 'MSG123',
        timestamp: new Date().toISOString()
      })
    );
  }),

  rest.post('http://slack-manager:3002/mcp/tools/slack_send_dm', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        message_id: 'DM456'
      })
    );
  }),
];

// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { slackHandlers } from './handlers/slack';
import { mailjetHandlers } from './handlers/mailjet';
import { marketingHandlers } from './handlers/marketing';

export const server = setupServer(
  ...slackHandlers,
  ...mailjetHandlers,
  ...marketingHandlers
);
```

## Coverage Requirements

### Component Coverage Targets

| Component | Line | Branch | Function | Statement |
|-----------|------|--------|----------|-----------|
| Services | 90% | 85% | 95% | 90% |
| API Routes | 85% | 80% | 90% | 85% |
| Workers | 85% | 80% | 90% | 85% |
| Validators | 95% | 90% | 100% | 95% |
| Utilities | 95% | 90% | 100% | 95% |
| **Overall** | **85%** | **80%** | **90%** | **85%** |

## Test Execution

### NPM Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm prisma migrate deploy

      - run: pnpm test:ci

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
```

## Performance Testing

### Load Testing
```typescript
// tests/performance/load.test.ts
describe('Performance Tests', () => {
  it('should handle 100 concurrent campaign creations', async () => {
    const startTime = Date.now();

    const campaigns = Array(100).fill(null).map(() =>
      service.createCampaign(createCampaignFactory())
    );

    await Promise.all(campaigns);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Under 5 seconds
  });

  it('should process 1000 notifications per minute', async () => {
    const notifications = Array(1000).fill(null).map(() =>
      createNotification()
    );

    const startTime = Date.now();

    for (const notification of notifications) {
      await queue.add('send', notification);
    }

    await queue.drain();

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(60000); // Under 1 minute
  });
});
```

## Test Review Checklist

### Before Committing
- [ ] All tests pass locally
- [ ] Coverage meets minimums
- [ ] No `.only` or `.skip` in tests
- [ ] Test names describe behavior
- [ ] AAA pattern followed
- [ ] Mocks cleaned up
- [ ] No hardcoded values

### During Review
- [ ] Tests are readable
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] Integration points tested
- [ ] Performance acceptable
- [ ] No flaky tests