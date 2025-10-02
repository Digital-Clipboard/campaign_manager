# Campaign Lifecycle Architecture

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Complete
- **Purpose**: Technical architecture for automated campaign lifecycle system

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Campaign Manager System                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   Scheduler    │  │   Lifecycle    │  │   AI Analysis  │        │
│  │    Layer       │→ │     Layer      │→ │     Layer      │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│          ↓                   ↓                    ↓                  │
│  ┌────────────────────────────────────────────────────────┐        │
│  │              Data & Integration Layer                   │        │
│  └────────────────────────────────────────────────────────┘        │
│          ↓                   ↓                    ↓                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   MailJet    │  │    Slack     │  │   Gemini     │             │
│  │     API      │  │  MCP Server  │  │     AI       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↕
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   (Prisma ORM)   │
                    └──────────────────┘
```

---

## Component Architecture

### 1. Scheduler Layer

**Purpose**: Manage time-based triggers for all lifecycle events

#### Components

```typescript
interface SchedulerLayer {
  cronManager: CronManager;
  jobQueue: JobQueue;
  schedulers: {
    prelaunchScheduler: PreLaunchScheduler;
    preflightScheduler: PreFlightScheduler;
    launchWarningScheduler: LaunchWarningScheduler;
    wrapupScheduler: WrapUpScheduler;
  };
}

class CronManager {
  // Manages all cron jobs
  jobs: Map<string, CronJob>;

  schedule(name: string, pattern: string, handler: Function): void;
  unschedule(name: string): void;
  reschedule(name: string, newPattern: string): void;
  list(): CronJob[];
}

class JobQueue {
  // Manages job execution queue
  queue: Queue<Job>;

  add(job: Job, options?: JobOptions): Promise<void>;
  process(concurrency: number): void;
  retry(jobId: string): Promise<void>;
  remove(jobId: string): void;
}
```

#### Scheduling Patterns

```typescript
const SCHEDULE_PATTERNS = {
  // Pre-launch: 3 PM UTC day before
  prelaunch: (launchDate: Date) => {
    const trigger = new Date(launchDate);
    trigger.setDate(trigger.getDate() - 1);
    trigger.setHours(15, 0, 0, 0);
    return trigger;
  },

  // Pre-flight: 6 AM UTC launch day
  preflight: (launchDate: Date) => {
    const trigger = new Date(launchDate);
    trigger.setHours(6, 0, 0, 0);
    return trigger;
  },

  // Launch warning: 15 minutes before launch
  launchWarning: (launchDate: Date) => {
    const trigger = new Date(launchDate);
    trigger.setMinutes(trigger.getMinutes() - 15);
    return trigger;
  },

  // Wrap-up: 30 minutes after launch
  wrapup: (launchDate: Date) => {
    const trigger = new Date(launchDate);
    trigger.setMinutes(trigger.getMinutes() + 30);
    return trigger;
  }
};
```

#### Technology Stack

- **Bull Queue**: Job queue management with Redis
- **node-cron**: Cron job scheduling
- **Heroku Scheduler**: Backup scheduling mechanism
- **Redis**: Job queue persistence

---

### 2. Lifecycle Layer

**Purpose**: Orchestrate campaign lifecycle stages and notifications

#### Service Architecture

```typescript
interface LifecycleLayer {
  services: {
    campaignService: CampaignService;
    notificationService: NotificationService;
    verificationService: VerificationService;
    metricsService: MetricsService;
  };
}

class CampaignService {
  // Manages campaign scheduling and state
  async createCampaignSchedule(params: CampaignParams): Promise<CampaignSchedule>;
  async getCampaignSchedule(id: number): Promise<CampaignSchedule>;
  async updateCampaignStatus(id: number, status: CampaignStatus): Promise<void>;
  async getNextScheduledCampaign(): Promise<CampaignSchedule | null>;
  async splitIntoBatches(totalRecipients: number, startDate: Date): Promise<BatchSchedule[]>;
}

class NotificationService {
  // Handles all Slack notifications
  async sendPreLaunchNotification(schedule: CampaignSchedule): Promise<void>;
  async sendPreFlightNotification(schedule: CampaignSchedule, checks: PreFlightChecklist): Promise<void>;
  async sendLaunchWarning(schedule: CampaignSchedule): Promise<void>;
  async sendLaunchConfirmation(schedule: CampaignSchedule, campaignId: number): Promise<void>;
  async sendWrapUpReport(schedule: CampaignSchedule, report: WrapUpReport): Promise<void>;

  private formatBlocks(stage: LifecycleStage, data: any): Block[];
  private handleDeliveryError(error: Error, notification: Notification): Promise<void>;
}

class VerificationService {
  // Pre-flight verification checks
  async verifyList(listId: number, expectedCount: number): Promise<ListVerification>;
  async verifyCampaignSetup(draftId: number): Promise<CampaignSetupVerification>;
  async verifyTechnicalConfig(draftId: number): Promise<TechnicalVerification>;
  async runAllChecks(schedule: CampaignSchedule): Promise<PreFlightChecklist>;
}

class MetricsService {
  // Collects and analyzes campaign metrics
  async collectMetrics(campaignId: number): Promise<CampaignMetrics>;
  async getPreviousRoundMetrics(campaignName: string, roundNumber: number): Promise<CampaignMetrics | null>;
  async calculateDeltas(current: CampaignMetrics, previous: CampaignMetrics): Promise<MetricDeltas>;
  async saveMetrics(campaignId: number, metrics: CampaignMetrics): Promise<void>;
}
```

#### Data Models

```typescript
// Campaign Schedule Model
interface CampaignSchedule {
  id: number;
  campaignName: string;
  roundNumber: number; // 1, 2, or 3
  scheduledDate: Date;
  scheduledTime: string; // "09:15"

  // List details
  listName: string; // "campaign_batch_001"
  listId: number; // MailJet list ID
  recipientCount: number;
  recipientRange: string; // "1-1000"

  // Campaign details
  mailjetDraftId: number | null;
  mailjetCampaignId: number | null;
  subject: string;
  senderName: string;
  senderEmail: string;

  // Notification tracking
  notificationStatus: {
    prelaunch: { sent: boolean; timestamp: Date | null; };
    preflight: { sent: boolean; timestamp: Date | null; status: string | null; };
    launchWarning: { sent: boolean; timestamp: Date | null; };
    launchConfirmation: { sent: boolean; timestamp: Date | null; };
    wrapup: { sent: boolean; timestamp: Date | null; };
  };

  // Status
  status: 'scheduled' | 'ready' | 'launching' | 'sent' | 'completed' | 'blocked';

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Campaign Metrics Model
interface CampaignMetrics {
  id: number;
  campaignScheduleId: number;
  mailjetCampaignId: number;

  // Delivery metrics
  processed: number;
  delivered: number;
  bounced: number;
  hardBounces: number;
  softBounces: number;
  blocked: number;
  queued: number;

  // Engagement metrics
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;

  // Calculated rates
  deliveryRate: number;
  bounceRate: number;
  hardBounceRate: number;
  softBounceRate: number;
  openRate: number | null;
  clickRate: number | null;

  // Timestamps
  collectedAt: Date;
  sendStartAt: Date | null;
  sendEndAt: Date | null;
}

// Notification Log Model
interface NotificationLog {
  id: number;
  campaignScheduleId: number;
  stage: 'prelaunch' | 'preflight' | 'launchWarning' | 'launchConfirmation' | 'wrapup';
  status: 'success' | 'failure' | 'retrying';
  attempt: number;
  errorMessage: string | null;
  slackMessageId: string | null;
  sentAt: Date;
}
```

---

### 3. AI Analysis Layer

**Purpose**: Multi-agent AI system for campaign analysis and recommendations

#### Agent Architecture

```typescript
interface AIAnalysisLayer {
  client: GeminiClient;
  agents: {
    listQualityAgent: ListQualityAgent;
    deliveryAnalysisAgent: DeliveryAnalysisAgent;
    comparisonAgent: ComparisonAgent;
    recommendationAgent: RecommendationAgent;
    reportFormattingAgent: ReportFormattingAgent;
  };
  orchestrator: AgentOrchestrator;
}

class GeminiClient {
  private apiKey: string;
  private model: string = 'gemini-2.0-flash-exp';

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse>;
  async chat(messages: Message[]): Promise<string>;
}

class ListQualityAgent {
  // Analyzes list quality based on bounce rates
  async analyze(metrics: CampaignMetrics): Promise<ListQualityAnalysis> {
    const prompt = `
      Analyze the following email campaign delivery metrics:
      - Processed: ${metrics.processed}
      - Delivered: ${metrics.delivered}
      - Bounced: ${metrics.bounced}
      - Hard Bounces: ${metrics.hardBounces}
      - Soft Bounces: ${metrics.softBounces}

      Provide:
      1. List quality assessment (excellent/good/concerning/poor)
      2. Analysis of bounce rates
      3. Specific concerns about hard vs soft bounces
      4. Impact on sender reputation
    `;

    return this.gemini.analyze({ agent: 'list-quality', prompt });
  }
}

class DeliveryAnalysisAgent {
  // Analyzes delivery performance
  async analyze(metrics: CampaignMetrics): Promise<DeliveryAnalysis> {
    const deliveryRate = (metrics.delivered / metrics.processed) * 100;
    const bounceRate = (metrics.bounced / metrics.processed) * 100;

    const prompt = `
      Analyze email delivery performance:
      - Delivery Rate: ${deliveryRate.toFixed(2)}%
      - Bounce Rate: ${bounceRate.toFixed(2)}%
      - Hard Bounce Rate: ${metrics.hardBounceRate.toFixed(2)}%
      - Soft Bounce Rate: ${metrics.softBounceRate.toFixed(2)}%

      Provide:
      1. Performance assessment
      2. ISP/provider insights
      3. Technical issues detected
      4. Reputation impact
    `;

    return this.gemini.analyze({ agent: 'delivery-analysis', prompt });
  }
}

class ComparisonAgent {
  // Compares current round to previous rounds
  async analyze(current: CampaignMetrics, previous: CampaignMetrics): Promise<ComparisonAnalysis> {
    const deltas = {
      deliveryRate: current.deliveryRate - previous.deliveryRate,
      bounceRate: current.bounceRate - previous.bounceRate,
      hardBounceRate: current.hardBounceRate - previous.hardBounceRate
    };

    const prompt = `
      Compare Round ${current.campaignScheduleId} vs Round ${previous.campaignScheduleId}:

      Current:
      - Delivery Rate: ${current.deliveryRate.toFixed(2)}%
      - Bounce Rate: ${current.bounceRate.toFixed(2)}%

      Previous:
      - Delivery Rate: ${previous.deliveryRate.toFixed(2)}%
      - Bounce Rate: ${previous.bounceRate.toFixed(2)}%

      Deltas:
      - Delivery Rate: ${deltas.deliveryRate > 0 ? '+' : ''}${deltas.deliveryRate.toFixed(2)}%
      - Bounce Rate: ${deltas.bounceRate > 0 ? '+' : ''}${deltas.bounceRate.toFixed(2)}%

      Provide:
      1. Trend analysis
      2. Insights on round-to-round changes
      3. Concerns about degradation
    `;

    return this.gemini.analyze({ agent: 'comparison', prompt });
  }
}

class RecommendationAgent {
  // Generates actionable recommendations
  async analyze(context: AnalysisContext): Promise<Recommendations> {
    const prompt = `
      Based on the following campaign analysis:
      ${JSON.stringify(context, null, 2)}

      Provide:
      1. Top 3-5 actionable recommendations (prioritized)
      2. Predictions for next round performance
      3. Risk factors to monitor
      4. Specific steps to improve delivery
    `;

    return this.gemini.analyze({ agent: 'recommendation', prompt });
  }
}

class AgentOrchestrator {
  // Orchestrates multi-agent analysis
  async generateFullAssessment(
    metrics: CampaignMetrics,
    previousMetrics?: CampaignMetrics
  ): Promise<FullAssessment> {
    // Run agents in parallel
    const [listQuality, delivery, comparison, recommendations] = await Promise.all([
      this.agents.listQualityAgent.analyze(metrics),
      this.agents.deliveryAnalysisAgent.analyze(metrics),
      previousMetrics
        ? this.agents.comparisonAgent.analyze(metrics, previousMetrics)
        : null,
      this.agents.recommendationAgent.analyze({
        metrics,
        previousMetrics,
        listQuality: null, // Will be filled after
        delivery: null
      })
    ]);

    // Format final report
    const report = await this.agents.reportFormattingAgent.format({
      listQuality,
      delivery,
      comparison,
      recommendations
    });

    return report;
  }
}
```

#### AI Configuration

```typescript
const AI_CONFIG = {
  model: 'gemini-2.0-flash-exp',
  temperature: 0.7,
  maxOutputTokens: 2048,
  topP: 0.95,
  topK: 40,

  systemPrompts: {
    listQuality: `You are an email deliverability expert specializing in list quality analysis.
                  Focus on bounce rates, sender reputation, and list hygiene.`,

    deliveryAnalysis: `You are an ISP and email delivery expert.
                       Analyze delivery performance and identify technical issues.`,

    comparison: `You are a campaign analytics expert.
                 Compare performance across rounds and identify trends.`,

    recommendation: `You are a senior email marketing strategist.
                     Provide actionable, prioritized recommendations.`,

    reportFormatting: `You are a technical writer specializing in executive reports.
                       Format analysis into clear, concise insights.`
  }
};
```

---

### 4. Data & Integration Layer

**Purpose**: Manage data persistence and external service integration

#### External Service Clients

```typescript
// MailJet API Client
class MailJetClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string = 'https://api.mailjet.com/v3';

  // Campaign operations
  async getCampaignDraft(draftId: number): Promise<CampaignDraft>;
  async getCampaign(campaignId: number): Promise<Campaign>;
  async getCampaignStatistics(campaignId: number): Promise<CampaignStatistics>;
  async sendCampaign(draftId: number): Promise<{ campaignId: number }>;

  // List operations
  async getContactsList(listId: number): Promise<ContactsList>;
  async getListRecipients(listId: number, limit?: number): Promise<ListRecipient[]>;
  async createContactsList(name: string): Promise<{ listId: number }>;
  async addContactsToList(listId: number, contacts: Contact[]): Promise<JobId>;

  // Statistics operations
  async getDetailedStatistics(campaignId: number): Promise<DetailedStats>;
  async getBounceDetails(campaignId: number): Promise<BounceDetail[]>;
  async getEngagementDetails(campaignId: number): Promise<EngagementDetail[]>;
}

// Slack MCP Client
class SlackMCPClient {
  private serverUrl: string;
  private apiToken: string;

  async postMessage(params: PostMessageParams): Promise<MessageResult>;
  async updateMessage(params: UpdateMessageParams): Promise<MessageResult>;
  async deleteMessage(params: DeleteMessageParams): Promise<void>;

  private async callTool(toolName: string, params: any): Promise<any>;
  private formatBlocks(blocks: Block[]): any[];
}

// Gemini AI Client
class GeminiAIClient {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  async generateContent(params: GenerateContentParams): Promise<GenerateContentResponse>;
  async chat(messages: Message[]): Promise<string>;
  async streamGenerate(params: GenerateContentParams): AsyncIterator<string>;
}
```

#### Database Schema (Prisma)

```prisma
model CampaignSchedule {
  id                  Int       @id @default(autoincrement())
  campaignName        String
  roundNumber         Int
  scheduledDate       DateTime
  scheduledTime       String

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

  // Notification tracking (JSON)
  notificationStatus  Json

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

---

## Technology Stack

### Backend

```typescript
const TECHNOLOGY_STACK = {
  runtime: {
    platform: 'Node.js 20.x',
    language: 'TypeScript 5.x',
    packageManager: 'npm'
  },

  framework: {
    api: 'Express.js',
    orm: 'Prisma 5.x',
    validation: 'Zod'
  },

  scheduling: {
    cron: 'node-cron',
    queue: 'Bull (Redis-backed)',
    heroku: 'Heroku Scheduler (backup)'
  },

  database: {
    primary: 'PostgreSQL 15',
    cache: 'Redis 7.x',
    migrations: 'Prisma Migrate'
  },

  external: {
    mailjet: 'MailJet REST API v3',
    slack: 'Slack MCP Server',
    ai: 'Google Gemini 2.0 Flash'
  },

  infrastructure: {
    hosting: 'Heroku',
    environment: 'Production (campaign-manager-prod)',
    monitoring: 'Heroku Metrics + Custom Logging'
  }
};
```

### Dependencies

```json
{
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "axios": "^1.6.0",
    "bull": "^4.11.0",
    "express": "^4.18.0",
    "node-cron": "^3.0.0",
    "redis": "^4.6.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "prisma": "^5.0.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0"
  }
}
```

---

## Deployment Architecture

### Heroku Setup

```yaml
# Procfile
web: node dist/api/server.js
worker: node dist/workers/lifecycle-worker.js

# app.json
{
  "name": "campaign-manager",
  "stack": "heroku-22",
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ],
  "formation": {
    "web": {
      "quantity": 1,
      "size": "basic"
    },
    "worker": {
      "quantity": 1,
      "size": "basic"
    }
  },
  "addons": [
    "heroku-postgresql:mini",
    "heroku-redis:mini"
  ],
  "env": {
    "NODE_ENV": "production",
    "MAILJET_API_KEY": {
      "required": true
    },
    "MAILJET_SECRET_KEY": {
      "required": true
    },
    "SLACK_MANAGER_URL": {
      "required": true
    },
    "SLACK_MANAGER_API_TOKEN": {
      "required": true
    },
    "SLACK_TRACTION_CHANNEL_ID": {
      "required": true
    },
    "GEMINI_API_KEY": {
      "required": true
    }
  }
}
```

### Worker Process

```typescript
// workers/lifecycle-worker.ts
import Bull from 'bull';

const lifecycleQueue = new Bull('lifecycle-notifications', {
  redis: process.env.REDIS_URL
});

// Process jobs
lifecycleQueue.process('prelaunch', async (job) => {
  const { scheduleId } = job.data;
  await notificationService.sendPreLaunchNotification(scheduleId);
});

lifecycleQueue.process('preflight', async (job) => {
  const { scheduleId } = job.data;
  await verificationService.runPreFlightChecks(scheduleId);
});

lifecycleQueue.process('launch-warning', async (job) => {
  const { scheduleId } = job.data;
  await notificationService.sendLaunchWarning(scheduleId);
});

lifecycleQueue.process('wrapup', async (job) => {
  const { scheduleId } = job.data;
  await metricsService.generatePostLaunchWrapup(scheduleId);
});

// Error handling
lifecycleQueue.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    queue: 'lifecycle-notifications',
    error: err.message
  });
});
```

---

## Security Architecture

### API Security

```typescript
interface SecurityConfig {
  authentication: {
    mailjet: {
      method: 'Basic Auth';
      format: 'base64(apiKey:secretKey)';
    };
    slack: {
      method: 'Bearer Token';
      token: 'SLACK_MANAGER_API_TOKEN';
    };
    gemini: {
      method: 'API Key';
      header: 'x-goog-api-key';
    };
  };

  secrets: {
    storage: 'Heroku Config Vars';
    rotation: 'Manual (quarterly)';
    access: 'Admin only';
  };

  network: {
    outbound: ['MailJet API', 'Slack MCP', 'Gemini API'];
    inbound: ['Heroku internal only'];
    tls: 'Required for all connections';
  };
}
```

### Data Protection

```typescript
const DATA_PROTECTION = {
  encryption: {
    atRest: 'PostgreSQL encryption (Heroku managed)',
    inTransit: 'TLS 1.3',
    secrets: 'Heroku Config Vars (encrypted)'
  },

  retention: {
    campaignSchedules: 'Indefinite (historical data)',
    metrics: 'Indefinite (analytics)',
    notificationLogs: '90 days',
    errorLogs: '30 days'
  },

  pii: {
    emailAddresses: 'Not stored (only in MailJet)',
    contactData: 'Reference IDs only',
    analytics: 'Aggregate metrics only'
  }
};
```

---

## Monitoring & Observability

### Logging Strategy

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Structured logging
logger.info('Campaign scheduled', {
  campaignId: schedule.id,
  campaignName: schedule.campaignName,
  roundNumber: schedule.roundNumber,
  scheduledDate: schedule.scheduledDate,
  recipientCount: schedule.recipientCount
});

logger.error('Notification failed', {
  stage: 'preflight',
  campaignId: schedule.id,
  error: error.message,
  stack: error.stack,
  attempt: retryAttempt
});
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      mailjet: await checkMailJet(),
      slack: await checkSlack(),
      gemini: await checkGemini()
    }
  };

  const allHealthy = Object.values(health.checks).every(c => c.status === 'healthy');
  res.status(allHealthy ? 200 : 503).json(health);
});

async function checkDatabase(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latency: 0 };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

### Metrics & Alerting

```typescript
interface SystemMetrics {
  // Performance metrics
  notificationLatency: {
    prelaunch: number; // milliseconds
    preflight: number;
    launchWarning: number;
    wrapup: number;
  };

  // Success metrics
  notificationSuccessRate: {
    prelaunch: number; // percentage
    preflight: number;
    launchWarning: number;
    wrapup: number;
  };

  // Queue metrics
  queueDepth: number;
  queueProcessingRate: number; // jobs per minute
  queueAverageWaitTime: number; // seconds

  // External service metrics
  mailjetResponseTime: number;
  slackResponseTime: number;
  geminiResponseTime: number;
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  notificationLatency: 60000, // 1 minute
  notificationFailureRate: 0.05, // 5%
  queueDepth: 100,
  queueWaitTime: 300, // 5 minutes
  externalServiceTimeout: 30000 // 30 seconds
};
```

---

## Scalability Considerations

### Horizontal Scaling

```typescript
const SCALING_CONFIG = {
  web: {
    minDynos: 1,
    maxDynos: 3,
    scaling: 'Auto-scale on CPU > 80%'
  },

  worker: {
    minDynos: 1,
    maxDynos: 5,
    scaling: 'Queue depth > 50 jobs'
  },

  database: {
    connectionPool: 10,
    maxConnections: 20,
    readReplicas: 0 // Add if needed
  },

  redis: {
    maxConnections: 50,
    clustering: false // Upgrade if needed
  }
};
```

### Performance Optimization

```typescript
const PERFORMANCE_CONFIG = {
  caching: {
    campaignSchedules: '5 minutes',
    mailjetData: '1 minute',
    aiResponses: false // Real-time only
  },

  batching: {
    metricsCollection: 'Batch MailJet API calls',
    notificationSending: 'Individual (real-time)'
  },

  parallelization: {
    aiAgents: 'Run all agents in parallel',
    verificationChecks: 'Run checks concurrently',
    dataCollection: 'Parallel API calls'
  }
};
```

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept and brainstorm
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [03_feature_specification.md](./03_feature_specification.md) - Feature specification
- [../02_architecture.md](../02_architecture.md) - Core system architecture
- [../08_multi_agent_implementation.md](../08_multi_agent_implementation.md) - AI agent details

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Complete
