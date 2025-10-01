# List Management - Development Specification

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Approved
- **Purpose**: Complete development tasks and implementation details for AI-driven list management

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Service Layer](#service-layer)
4. [AI Agent Implementation](#ai-agent-implementation)
5. [Workflow Services](#workflow-services)
6. [Integration Services](#integration-services)
7. [Caching Layer](#caching-layer)
8. [Scheduler Jobs](#scheduler-jobs)
9. [API Endpoints](#api-endpoints)
10. [Testing Requirements](#testing-requirements)
11. [Deployment](#deployment)
12. [Configuration](#configuration)

---

## Overview

### Development Phases

This specification follows a **bottom-up implementation approach**:

1. **Phase 1**: Database schema and models
2. **Phase 2**: External client integrations (Mailjet, Redis)
3. **Phase 3**: AI agents and orchestrator
4. **Phase 4**: Workflow services
5. **Phase 5**: Scheduler jobs and automation
6. **Phase 6**: API endpoints and monitoring
7. **Phase 7**: Testing and validation
8. **Phase 8**: Production deployment

### Technology Stack

```typescript
const TECH_STACK = {
  runtime: 'Node.js 20.x',
  language: 'TypeScript 5.3+',
  framework: 'Express 4.x',
  database: 'PostgreSQL 15+',
  orm: 'Prisma 5.x',
  cache: 'Redis 7.x',
  scheduler: 'node-cron + Bull Queue',
  ai: 'Google Gemini 2.0 Flash',
  notifications: 'Slack MCP Server',
  email: 'Mailjet REST API v3',
  deployment: 'Heroku (web + worker dynos)',
};
```

### Project Structure

```
src/
├── agents/
│   ├── gemini-client.ts
│   ├── list-management-orchestrator.ts
│   ├── list-health-agent.ts
│   ├── rebalancing-agent.ts
│   ├── optimization-agent.ts
│   └── reporting-agent.ts
├── services/
│   ├── list-management/
│   │   ├── post-campaign-maintenance.service.ts
│   │   ├── weekly-health-check.service.ts
│   │   ├── pre-campaign-validation.service.ts
│   │   └── list-operations.service.ts
│   ├── mailjet/
│   │   ├── mailjet-client.ts
│   │   ├── list-sync.service.ts
│   │   └── bounce-processor.service.ts
│   └── cache/
│       ├── redis-client.ts
│       └── list-cache.service.ts
├── schedulers/
│   ├── list-management.scheduler.ts
│   └── jobs/
│       ├── post-campaign-maintenance.job.ts
│       ├── weekly-health-check.job.ts
│       └── cache-refresh.job.ts
├── api/
│   ├── routes/
│   │   └── list-management.routes.ts
│   └── controllers/
│       └── list-management.controller.ts
├── utils/
│   ├── list-distribution.util.ts
│   └── validation.util.ts
└── types/
    └── list-management.types.ts
```

---

## Database Schema

### Prisma Schema Extensions

Add to `prisma/schema.prisma`:

```prisma
// ============================================
// LIST MANAGEMENT MODELS
// ============================================

/// Tracks all list maintenance operations
model ListMaintenanceLog {
  id                    Int       @id @default(autoincrement())
  campaignScheduleId    Int?      // Null for weekly health checks
  executedAt            DateTime  @default(now())
  maintenanceType       String    // 'post_campaign' | 'weekly_health' | 'pre_campaign_validation'

  // Input Data
  bounceData            Json?     // Raw bounce data from Mailjet
  bounceAnalysis        Json?     // ListHealthAgent analysis output

  // AI Decisions
  suppressionPlan       Json?     // OptimizationAgent output
  rebalancingPlan       Json?     // RebalancingAgent output
  aiAssessments         Json      // All AI agent outputs

  // State Tracking
  beforeState           Json      // List sizes before maintenance
  afterState            Json      // List sizes after maintenance

  // Execution Results
  contactsSuppressed    Int       @default(0)
  contactsRebalanced    Int       @default(0)
  executionTimeMs       Int       // Total execution time

  // Status
  status                String    // 'success' | 'partial_success' | 'failed'
  errors                Json?     // Array of errors if any

  // Notifications
  slackNotificationSent Boolean   @default(false)
  slackMessageTs        String?   // Slack message timestamp for threading

  // Relationships
  campaignSchedule      CampaignSchedule? @relation(fields: [campaignScheduleId], references: [id])
  suppressionHistory    ContactSuppressionHistory[]

  @@index([campaignScheduleId])
  @@index([executedAt])
  @@index([maintenanceType])
  @@index([status])
}

/// Weekly health check results
model ListHealthCheck {
  id                    Int       @id @default(autoincrement())
  executedAt            DateTime  @default(now())

  // List Sizes
  masterListSize        Int
  campaignList1Size     Int
  campaignList2Size     Int
  campaignList3Size     Int
  suppressionListSize   Int

  // Balance Analysis
  balanceDeviation      Float     // Percentage deviation from perfect balance
  isBalanced            Boolean   // Within ±5% tolerance

  // Health Metrics
  averageBounceRate     Float
  averageDeliveryRate   Float

  // AI Assessments
  healthAssessments     Json      // Per-list health analysis
  weeklyReport          Json      // ReportingAgent output

  // Recommendations
  actionItems           Json      // Array of recommended actions
  urgency               String    // 'low' | 'medium' | 'high' | 'critical'

  // Execution
  executionTimeMs       Int
  status                String    // 'success' | 'failed'
  errors                Json?

  // Notifications
  slackNotificationSent Boolean   @default(false)
  slackMessageTs        String?

  @@index([executedAt])
  @@index([urgency])
}

/// History of all contact suppressions
model ContactSuppressionHistory {
  id                      Int       @id @default(autoincrement())

  // Contact Information
  contactId               BigInt    // Mailjet contact ID
  email                   String

  // Suppression Details
  suppressedAt            DateTime  @default(now())
  reason                  String    // 'hard_bounce' | 'soft_bounce_pattern' | 'manual'
  bounceType              String?   // Specific bounce error (e.g., 'user_unknown')
  bounceCount             Int?      // Number of bounces if soft bounce pattern

  // AI Decision
  aiRationale             String?   // OptimizationAgent's explanation
  aiConfidence            Float?    // Confidence score 0-1

  // Execution
  removedFromLists        String[]  // List IDs contact was removed from
  addedToSuppressionList  Boolean   @default(false)

  // Tracking
  maintenanceLogId        Int?
  maintenanceLog          ListMaintenanceLog? @relation(fields: [maintenanceLogId], references: [id])

  @@index([email])
  @@index([contactId])
  @@index([suppressedAt])
  @@index([reason])
  @@index([maintenanceLogId])
}

/// Cache of contact list membership
model ContactListMembership {
  id                Int       @id @default(autoincrement())

  // Contact Information
  contactId         BigInt
  email             String

  // List Membership
  inMasterList      Boolean   @default(false)
  inCampaignList1   Boolean   @default(false)
  inCampaignList2   Boolean   @default(false)
  inCampaignList3   Boolean   @default(false)
  inSuppressionList Boolean   @default(false)

  // Metadata
  lastUpdated       DateTime  @default(now())

  // Bounce History
  hardBounceCount   Int       @default(0)
  softBounceCount   Int       @default(0)
  lastBounceDate    DateTime?

  @@unique([contactId])
  @@index([email])
  @@index([lastUpdated])
}

/// Extension to existing CampaignSchedule model
model CampaignSchedule {
  // ... existing fields ...

  // Add relationship
  listMaintenanceLogs   ListMaintenanceLog[]
}
```

### Migration Script

Create `prisma/migrations/YYYYMMDDHHMMSS_add_list_management/migration.sql`:

```sql
-- ListMaintenanceLog table
CREATE TABLE "ListMaintenanceLog" (
    "id" SERIAL NOT NULL,
    "campaignScheduleId" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceType" TEXT NOT NULL,
    "bounceData" JSONB,
    "bounceAnalysis" JSONB,
    "suppressionPlan" JSONB,
    "rebalancingPlan" JSONB,
    "aiAssessments" JSONB NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "contactsSuppressed" INTEGER NOT NULL DEFAULT 0,
    "contactsRebalanced" INTEGER NOT NULL DEFAULT 0,
    "executionTimeMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errors" JSONB,
    "slackNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "slackMessageTs" TEXT,

    CONSTRAINT "ListMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- ListHealthCheck table
CREATE TABLE "ListHealthCheck" (
    "id" SERIAL NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masterListSize" INTEGER NOT NULL,
    "campaignList1Size" INTEGER NOT NULL,
    "campaignList2Size" INTEGER NOT NULL,
    "campaignList3Size" INTEGER NOT NULL,
    "suppressionListSize" INTEGER NOT NULL,
    "balanceDeviation" DOUBLE PRECISION NOT NULL,
    "isBalanced" BOOLEAN NOT NULL,
    "averageBounceRate" DOUBLE PRECISION NOT NULL,
    "averageDeliveryRate" DOUBLE PRECISION NOT NULL,
    "healthAssessments" JSONB NOT NULL,
    "weeklyReport" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "urgency" TEXT NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errors" JSONB,
    "slackNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "slackMessageTs" TEXT,

    CONSTRAINT "ListHealthCheck_pkey" PRIMARY KEY ("id")
);

-- ContactSuppressionHistory table
CREATE TABLE "ContactSuppressionHistory" (
    "id" SERIAL NOT NULL,
    "contactId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "bounceType" TEXT,
    "bounceCount" INTEGER,
    "aiRationale" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "removedFromLists" TEXT[],
    "addedToSuppressionList" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceLogId" INTEGER,

    CONSTRAINT "ContactSuppressionHistory_pkey" PRIMARY KEY ("id")
);

-- ContactListMembership table
CREATE TABLE "ContactListMembership" (
    "id" SERIAL NOT NULL,
    "contactId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "inMasterList" BOOLEAN NOT NULL DEFAULT false,
    "inCampaignList1" BOOLEAN NOT NULL DEFAULT false,
    "inCampaignList2" BOOLEAN NOT NULL DEFAULT false,
    "inCampaignList3" BOOLEAN NOT NULL DEFAULT false,
    "inSuppressionList" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardBounceCount" INTEGER NOT NULL DEFAULT 0,
    "softBounceCount" INTEGER NOT NULL DEFAULT 0,
    "lastBounceDate" TIMESTAMP(3),

    CONSTRAINT "ContactListMembership_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ListMaintenanceLog_campaignScheduleId_idx" ON "ListMaintenanceLog"("campaignScheduleId");
CREATE INDEX "ListMaintenanceLog_executedAt_idx" ON "ListMaintenanceLog"("executedAt");
CREATE INDEX "ListMaintenanceLog_maintenanceType_idx" ON "ListMaintenanceLog"("maintenanceType");
CREATE INDEX "ListMaintenanceLog_status_idx" ON "ListMaintenanceLog"("status");

CREATE INDEX "ListHealthCheck_executedAt_idx" ON "ListHealthCheck"("executedAt");
CREATE INDEX "ListHealthCheck_urgency_idx" ON "ListHealthCheck"("urgency");

CREATE INDEX "ContactSuppressionHistory_email_idx" ON "ContactSuppressionHistory"("email");
CREATE INDEX "ContactSuppressionHistory_contactId_idx" ON "ContactSuppressionHistory"("contactId");
CREATE INDEX "ContactSuppressionHistory_suppressedAt_idx" ON "ContactSuppressionHistory"("suppressedAt");
CREATE INDEX "ContactSuppressionHistory_reason_idx" ON "ContactSuppressionHistory"("reason");
CREATE INDEX "ContactSuppressionHistory_maintenanceLogId_idx" ON "ContactSuppressionHistory"("maintenanceLogId");

CREATE UNIQUE INDEX "ContactListMembership_contactId_key" ON "ContactListMembership"("contactId");
CREATE INDEX "ContactListMembership_email_idx" ON "ContactListMembership"("email");
CREATE INDEX "ContactListMembership_lastUpdated_idx" ON "ContactListMembership"("lastUpdated");

-- Foreign Keys
ALTER TABLE "ListMaintenanceLog" ADD CONSTRAINT "ListMaintenanceLog_campaignScheduleId_fkey"
    FOREIGN KEY ("campaignScheduleId") REFERENCES "CampaignSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactSuppressionHistory" ADD CONSTRAINT "ContactSuppressionHistory_maintenanceLogId_fkey"
    FOREIGN KEY ("maintenanceLogId") REFERENCES "ListMaintenanceLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Service Layer

### List Operations Service

`src/services/list-management/list-operations.service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { MailjetClient } from '../mailjet/mailjet-client';
import { ListCacheService } from '../cache/list-cache.service';

const prisma = new PrismaClient();

export interface ListState {
  masterList: number;
  campaignList1: number;
  campaignList2: number;
  campaignList3: number;
  suppressionList: number;
  timestamp: Date;
}

export interface ContactMovement {
  contactId: number;
  email: string;
  fromList: string;
  toList: string;
  reason: string;
}

export class ListOperationsService {
  private mailjetClient: MailjetClient;
  private cacheService: ListCacheService;

  constructor() {
    this.mailjetClient = new MailjetClient();
    this.cacheService = new ListCacheService();
  }

  /**
   * Get current state of all lists
   */
  async getCurrentListState(): Promise<ListState> {
    const [master, list1, list2, list3, suppression] = await Promise.all([
      this.mailjetClient.getListContactCount(process.env.MAILJET_MASTER_LIST_ID!),
      this.mailjetClient.getListContactCount(process.env.MAILJET_CAMPAIGN_LIST_1_ID!),
      this.mailjetClient.getListContactCount(process.env.MAILJET_CAMPAIGN_LIST_2_ID!),
      this.mailjetClient.getListContactCount(process.env.MAILJET_CAMPAIGN_LIST_3_ID!),
      this.mailjetClient.getListContactCount(process.env.MAILJET_SUPPRESSION_LIST_ID!),
    ]);

    return {
      masterList: master,
      campaignList1: list1,
      campaignList2: list2,
      campaignList3: list3,
      suppressionList: suppression,
      timestamp: new Date(),
    };
  }

  /**
   * Suppress contacts (remove from all lists, add to suppression)
   */
  async suppressContacts(
    contacts: Array<{ contactId: number; email: string; reason: string; bounceType?: string }>,
    aiRationale?: string,
    aiConfidence?: number
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    for (const contact of contacts) {
      try {
        // Remove from all campaign lists
        const removedFrom = await this.removeFromCampaignLists(contact.contactId);

        // Add to suppression list
        await this.mailjetClient.addContactToList(
          process.env.MAILJET_SUPPRESSION_LIST_ID!,
          contact.contactId
        );

        // Log suppression
        await prisma.contactSuppressionHistory.create({
          data: {
            contactId: contact.contactId,
            email: contact.email,
            reason: contact.reason,
            bounceType: contact.bounceType,
            aiRationale,
            aiConfidence,
            removedFromLists: removedFrom,
            addedToSuppressionList: true,
          },
        });

        // Update cache
        await this.cacheService.updateContactMembership(contact.contactId, {
          inCampaignList1: false,
          inCampaignList2: false,
          inCampaignList3: false,
          inSuppressionList: true,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: contact.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Execute rebalancing plan
   */
  async executeRebalancing(
    movements: ContactMovement[]
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    // Group movements by contact to handle atomically
    const movementsByContact = this.groupMovementsByContact(movements);

    for (const [contactId, contactMovements] of movementsByContact.entries()) {
      try {
        for (const movement of contactMovements) {
          // Remove from source list
          if (movement.fromList !== 'none') {
            await this.mailjetClient.removeContactFromList(
              this.getListId(movement.fromList),
              contactId
            );
          }

          // Add to destination list
          if (movement.toList !== 'none') {
            await this.mailjetClient.addContactToList(
              this.getListId(movement.toList),
              contactId
            );
          }
        }

        // Update cache
        await this.cacheService.invalidateContact(contactId);

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: contactMovements[0].email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Calculate balance deviation across campaign lists
   */
  calculateBalanceDeviation(list1: number, list2: number, list3: number): number {
    const total = list1 + list2 + list3;
    const target = total / 3;

    const deviations = [
      Math.abs(list1 - target) / target,
      Math.abs(list2 - target) / target,
      Math.abs(list3 - target) / target,
    ];

    return Math.max(...deviations) * 100; // Return as percentage
  }

  /**
   * Check if lists are balanced (within ±5%)
   */
  isBalanced(list1: number, list2: number, list3: number): boolean {
    return this.calculateBalanceDeviation(list1, list2, list3) <= 5;
  }

  // Private helper methods

  private async removeFromCampaignLists(contactId: number): Promise<string[]> {
    const removedFrom: string[] = [];
    const listIds = [
      process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
      process.env.MAILJET_CAMPAIGN_LIST_2_ID!,
      process.env.MAILJET_CAMPAIGN_LIST_3_ID!,
    ];

    for (const listId of listIds) {
      try {
        await this.mailjetClient.removeContactFromList(listId, contactId);
        removedFrom.push(listId);
      } catch (error) {
        // Contact might not be in this list, continue
      }
    }

    return removedFrom;
  }

  private groupMovementsByContact(
    movements: ContactMovement[]
  ): Map<number, ContactMovement[]> {
    const grouped = new Map<number, ContactMovement[]>();

    for (const movement of movements) {
      if (!grouped.has(movement.contactId)) {
        grouped.set(movement.contactId, []);
      }
      grouped.get(movement.contactId)!.push(movement);
    }

    return grouped;
  }

  private getListId(listName: string): string {
    const mapping: Record<string, string> = {
      campaign_list_1: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
      campaign_list_2: process.env.MAILJET_CAMPAIGN_LIST_2_ID!,
      campaign_list_3: process.env.MAILJET_CAMPAIGN_LIST_3_ID!,
      suppression_list: process.env.MAILJET_SUPPRESSION_LIST_ID!,
    };

    return mapping[listName] || listName;
  }
}
```

### Post-Campaign Maintenance Service

`src/services/list-management/post-campaign-maintenance.service.ts`:

```typescript
import { PrismaClient, CampaignSchedule } from '@prisma/client';
import { ListManagementOrchestrator } from '../../agents/list-management-orchestrator';
import { ListOperationsService } from './list-operations.service';
import { BounceProcessorService } from '../mailjet/bounce-processor.service';
import { SlackMCPClient } from '../slack/slack-mcp-client';

const prisma = new PrismaClient();

export interface MaintenanceReport {
  maintenanceLogId: number;
  status: 'success' | 'partial_success' | 'failed';
  contactsSuppressed: number;
  contactsRebalanced: number;
  executionTimeMs: number;
  errors?: Array<{ stage: string; error: string }>;
}

export class PostCampaignMaintenanceService {
  private orchestrator: ListManagementOrchestrator;
  private listOps: ListOperationsService;
  private bounceProcessor: BounceProcessorService;
  private slackClient: SlackMCPClient;

  constructor() {
    this.orchestrator = new ListManagementOrchestrator();
    this.listOps = new ListOperationsService();
    this.bounceProcessor = new BounceProcessorService();
    this.slackClient = new SlackMCPClient();
  }

  /**
   * Execute post-campaign maintenance workflow
   * Runs 24 hours after campaign send
   */
  async execute(campaignSchedule: CampaignSchedule): Promise<MaintenanceReport> {
    const startTime = Date.now();
    const errors: Array<{ stage: string; error: string }> = [];

    console.log(`[PostCampaignMaintenance] Starting for campaign ${campaignSchedule.id}`);

    // Step 1: Capture before state
    const beforeState = await this.listOps.getCurrentListState();

    // Step 2: Fetch bounce data from Mailjet
    let bounceData;
    try {
      bounceData = await this.bounceProcessor.fetchCampaignBounces(
        campaignSchedule.mailjetCampaignId!
      );
    } catch (error) {
      errors.push({
        stage: 'fetch_bounces',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createFailedReport(campaignSchedule.id, startTime, errors);
    }

    // Step 3: AI analysis of bounces
    let aiAnalysis;
    try {
      aiAnalysis = await this.orchestrator.analyzePostCampaign(
        bounceData,
        beforeState,
        campaignSchedule.roundNumber || 1
      );
    } catch (error) {
      errors.push({
        stage: 'ai_analysis',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createFailedReport(campaignSchedule.id, startTime, errors);
    }

    // Step 4: Execute suppression plan
    let suppressionResults = { success: 0, failed: 0, errors: [] };
    if (aiAnalysis.suppressionPlan.contactsToSuppress.length > 0) {
      try {
        suppressionResults = await this.listOps.suppressContacts(
          aiAnalysis.suppressionPlan.contactsToSuppress,
          aiAnalysis.suppressionPlan.rationale,
          aiAnalysis.suppressionPlan.confidence
        );
      } catch (error) {
        errors.push({
          stage: 'suppression',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Step 5: Execute rebalancing plan
    let rebalancingResults = { success: 0, failed: 0, errors: [] };
    if (aiAnalysis.rebalancingPlan.movements.length > 0) {
      try {
        rebalancingResults = await this.listOps.executeRebalancing(
          aiAnalysis.rebalancingPlan.movements
        );
      } catch (error) {
        errors.push({
          stage: 'rebalancing',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Step 6: Capture after state
    const afterState = await this.listOps.getCurrentListState();

    // Step 7: Create maintenance log
    const log = await prisma.listMaintenanceLog.create({
      data: {
        campaignScheduleId: campaignSchedule.id,
        maintenanceType: 'post_campaign',
        bounceData: bounceData as any,
        bounceAnalysis: aiAnalysis.bounceAnalysis as any,
        suppressionPlan: aiAnalysis.suppressionPlan as any,
        rebalancingPlan: aiAnalysis.rebalancingPlan as any,
        aiAssessments: {
          listHealth: aiAnalysis.listHealthAssessments,
          reporting: aiAnalysis.maintenanceReport,
        },
        beforeState: beforeState as any,
        afterState: afterState as any,
        contactsSuppressed: suppressionResults.success,
        contactsRebalanced: rebalancingResults.success,
        executionTimeMs: Date.now() - startTime,
        status: errors.length === 0 ? 'success' : suppressionResults.success > 0 ? 'partial_success' : 'failed',
        errors: errors.length > 0 ? errors : null,
      },
    });

    // Step 8: Send Slack notification
    try {
      await this.sendMaintenanceNotification(log.id, aiAnalysis, beforeState, afterState);
      await prisma.listMaintenanceLog.update({
        where: { id: log.id },
        data: { slackNotificationSent: true },
      });
    } catch (error) {
      console.error('[PostCampaignMaintenance] Slack notification failed:', error);
    }

    console.log(`[PostCampaignMaintenance] Completed in ${Date.now() - startTime}ms`);

    return {
      maintenanceLogId: log.id,
      status: log.status as any,
      contactsSuppressed: suppressionResults.success,
      contactsRebalanced: rebalancingResults.success,
      executionTimeMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async createFailedReport(
    campaignScheduleId: number,
    startTime: number,
    errors: Array<{ stage: string; error: string }>
  ): Promise<MaintenanceReport> {
    const log = await prisma.listMaintenanceLog.create({
      data: {
        campaignScheduleId,
        maintenanceType: 'post_campaign',
        aiAssessments: {},
        beforeState: {},
        afterState: {},
        executionTimeMs: Date.now() - startTime,
        status: 'failed',
        errors,
      },
    });

    return {
      maintenanceLogId: log.id,
      status: 'failed',
      contactsSuppressed: 0,
      contactsRebalanced: 0,
      executionTimeMs: Date.now() - startTime,
      errors,
    };
  }

  private async sendMaintenanceNotification(
    logId: number,
    analysis: any,
    beforeState: any,
    afterState: any
  ): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔄 Post-Campaign List Maintenance Complete',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Contacts Suppressed:*\n${analysis.suppressionPlan.contactsToSuppress.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*Contacts Rebalanced:*\n${analysis.rebalancingPlan.movements.length}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Assessment:*\n${analysis.maintenanceReport.executiveSummary}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Maintenance Log ID: ${logId} | <${process.env.APP_URL}/admin/list-management/${logId}|View Details>`,
          },
        ],
      },
    ];

    await this.slackClient.sendMessage('#_traction', { blocks });
  }
}
```

---

## AI Agent Implementation

### Gemini Client

`src/agents/gemini-client.ts`:

```typescript
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private defaultTemperature: number;

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.defaultTemperature = config.temperature || 0.7;

    this.model = this.genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: this.defaultTemperature,
        maxOutputTokens: config.maxOutputTokens || 2048,
      },
    });
  }

  /**
   * Generate completion with system prompt and user prompt
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number
  ): Promise<GeminiResponse> {
    try {
      // Gemini doesn't have explicit system prompts, so we prepend to user message
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: temperature !== undefined ? temperature : this.defaultTemperature,
        },
      });

      const response = result.response;
      const text = response.text();

      return {
        text,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      console.error('[GeminiClient] Error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Generate structured JSON response
   */
  async generateJSON<T = any>(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number
  ): Promise<T> {
    const response = await this.generateCompletion(
      systemPrompt + '\n\nYou MUST respond with valid JSON only. No markdown, no explanations.',
      userPrompt,
      temperature
    );

    try {
      // Remove markdown code blocks if present
      let jsonText = response.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[GeminiClient] JSON parse error:', error);
      console.error('[GeminiClient] Raw response:', response.text);
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}
```

### List Health Agent

`src/agents/list-health-agent.ts`:

```typescript
import { GeminiClient } from './gemini-client';

export interface ListHealthInput {
  name: string;
  subscriberCount: number;
  targetSize: number;
  bounceRate: number;
  hardBounces: number;
  softBounces: number;
  deliveryRate: number;
  lastCampaignDate: Date | null;
  bounceRateTrend: 'improving' | 'stable' | 'degrading';
  sizeTrend: 'growing' | 'stable' | 'shrinking';
  suppressionRate: number;
}

export interface ListHealthOutput {
  status: 'healthy' | 'warning' | 'critical';
  concerns: string[];
  riskFactors: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

const SYSTEM_PROMPT = `You are an email deliverability expert specializing in list health analysis.

Your role is to assess the health of email marketing lists based on bounce rates, delivery metrics, and list dynamics.

Key considerations:
- Hard bounce rate > 2% is concerning, > 5% is critical
- Soft bounce rate > 5% needs monitoring, > 10% is concerning
- Delivery rate < 95% indicates issues, < 90% is critical
- List shrinkage > 10% monthly needs investigation
- Sustained bounce trends are more concerning than one-time spikes

Provide honest, data-driven assessments with specific concerns and risk factors.`;

export class ListHealthAgent {
  private geminiClient: GeminiClient;
  private temperature = 0.7;

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  async analyze(input: ListHealthInput): Promise<ListHealthOutput> {
    const userPrompt = this.buildPrompt(input);

    const response = await this.geminiClient.generateJSON<ListHealthOutput>(
      SYSTEM_PROMPT,
      userPrompt,
      this.temperature
    );

    // Validate response structure
    this.validateOutput(response);

    return response;
  }

  private buildPrompt(input: ListHealthInput): string {
    return `Analyze the health of this email list:

**List Information:**
- Name: ${input.name}
- Current Size: ${input.subscriberCount.toLocaleString()}
- Target Size: ${input.targetSize.toLocaleString()}
- Size Variance: ${input.subscriberCount - input.targetSize} (${((input.subscriberCount / input.targetSize - 1) * 100).toFixed(1)}%)

**Bounce Metrics:**
- Total Bounce Rate: ${input.bounceRate.toFixed(2)}%
- Hard Bounces: ${input.hardBounces} (${((input.hardBounces / input.subscriberCount) * 100).toFixed(2)}%)
- Soft Bounces: ${input.softBounces} (${((input.softBounces / input.subscriberCount) * 100).toFixed(2)}%)
- Delivery Rate: ${input.deliveryRate.toFixed(2)}%

**Trends:**
- Bounce Rate Trend: ${input.bounceRateTrend}
- List Size Trend: ${input.sizeTrend}
- Recent Suppression Rate: ${input.suppressionRate.toFixed(2)}%
- Last Campaign: ${input.lastCampaignDate ? input.lastCampaignDate.toISOString().split('T')[0] : 'Never'}

Provide your assessment in JSON format:
{
  "status": "healthy" | "warning" | "critical",
  "concerns": ["array", "of", "specific", "concerns"],
  "riskFactors": ["array", "of", "risk", "factors"],
  "urgency": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0
}`;
  }

  private validateOutput(output: any): void {
    const required = ['status', 'concerns', 'riskFactors', 'urgency', 'confidence'];
    for (const field of required) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!['healthy', 'warning', 'critical'].includes(output.status)) {
      throw new Error(`Invalid status: ${output.status}`);
    }

    if (!Array.isArray(output.concerns) || !Array.isArray(output.riskFactors)) {
      throw new Error('concerns and riskFactors must be arrays');
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
      throw new Error('confidence must be a number between 0 and 1');
    }
  }
}
```

### Rebalancing Agent

`src/agents/rebalancing-agent.ts`:

```typescript
import { GeminiClient } from './gemini-client';

export interface RebalancingInput {
  currentDistribution: {
    list1: number;
    list2: number;
    list3: number;
  };
  suppressedContacts: {
    fromList1: number;
    fromList2: number;
    fromList3: number;
  };
  availableForRebalancing: number; // Contacts in master list not in any campaign list
  balanceThreshold: number; // ±5%
}

export interface ContactMovement {
  contactId: number;
  email: string;
  fromList: 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3' | 'none';
  toList: 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3' | 'none';
  reason: string;
}

export interface RebalancingOutput {
  requiresRebalancing: boolean;
  targetDistribution: {
    list1: number;
    list2: number;
    list3: number;
  };
  movements: ContactMovement[];
  rationale: string;
  expectedImpact: string;
  alternativesConsidered: string[];
  confidence: number;
}

const SYSTEM_PROMPT = `You are a data distribution optimization expert specializing in email campaign list management.

Your role is to determine the optimal way to rebalance contacts across three campaign lists after suppressions.

Key principles:
1. Maintain ±5% balance across all three lists
2. Preserve FIFO ordering (first contacts stay in earlier lists when possible)
3. Minimize unnecessary movements (only move what's needed)
4. Backfill from master list if available
5. Consider upcoming campaign schedule (List 1 → List 2 → List 3 rotation)

Provide clear rationale for all redistribution decisions.`;

export class RebalancingAgent {
  private geminiClient: GeminiClient;
  private temperature = 0.5; // Lower temperature for more deterministic output

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  async determineRebalancing(input: RebalancingInput): Promise<RebalancingOutput> {
    const userPrompt = this.buildPrompt(input);

    const response = await this.geminiClient.generateJSON<RebalancingOutput>(
      SYSTEM_PROMPT,
      userPrompt,
      this.temperature
    );

    this.validateOutput(response);

    return response;
  }

  private buildPrompt(input: RebalancingInput): string {
    const total =
      input.currentDistribution.list1 +
      input.currentDistribution.list2 +
      input.currentDistribution.list3;
    const targetPerList = total / 3;
    const balanceThreshold = input.balanceThreshold;

    return `Determine if rebalancing is needed and generate a rebalancing plan:

**Current Distribution:**
- Campaign List 1: ${input.currentDistribution.list1} contacts
- Campaign List 2: ${input.currentDistribution.list2} contacts
- Campaign List 3: ${input.currentDistribution.list3} contacts
- **Total**: ${total} contacts
- **Target per list**: ${Math.round(targetPerList)} contacts (±${balanceThreshold}% = ${Math.round(targetPerList * (1 - balanceThreshold / 100))}-${Math.round(targetPerList * (1 + balanceThreshold / 100))})

**Recent Suppressions:**
- From List 1: ${input.suppressedContacts.fromList1} contacts
- From List 2: ${input.suppressedContacts.fromList2} contacts
- From List 3: ${input.suppressedContacts.fromList3} contacts

**Available for Backfill:**
- Master list contacts not in any campaign list: ${input.availableForRebalancing}

**Requirements:**
1. Determine if current distribution is balanced (within ±${balanceThreshold}%)
2. If not balanced, calculate target distribution
3. Generate minimal movement plan to achieve balance
4. Preserve FIFO ordering when possible
5. Backfill from master list if needed

Respond in JSON format:
{
  "requiresRebalancing": boolean,
  "targetDistribution": {
    "list1": number,
    "list2": number,
    "list3": number
  },
  "movements": [
    {
      "contactId": number,
      "email": "string",
      "fromList": "campaign_list_1" | "campaign_list_2" | "campaign_list_3" | "none",
      "toList": "campaign_list_1" | "campaign_list_2" | "campaign_list_3" | "none",
      "reason": "string explaining why this contact is being moved"
    }
  ],
  "rationale": "Overall explanation of the rebalancing strategy",
  "expectedImpact": "Description of how this will improve list balance",
  "alternativesConsidered": ["alternative 1", "alternative 2"],
  "confidence": 0.0-1.0
}

NOTE: If requiresRebalancing is false, movements should be an empty array.`;
  }

  private validateOutput(output: any): void {
    const required = [
      'requiresRebalancing',
      'targetDistribution',
      'movements',
      'rationale',
      'expectedImpact',
      'alternativesConsidered',
      'confidence',
    ];

    for (const field of required) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(output.movements)) {
      throw new Error('movements must be an array');
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
      throw new Error('confidence must be between 0 and 1');
    }
  }
}
```

### Optimization Agent

`src/agents/optimization-agent.ts`:

```typescript
import { GeminiClient } from './gemini-client';

export interface BounceContact {
  contactId: number;
  email: string;
  bounceType: string; // 'hard' | 'soft'
  bounceReason: string; // e.g., 'user_unknown', 'mailbox_full'
  bounceCount: number;
  bounceHistory: Array<{
    date: Date;
    campaignId: string;
    reason: string;
  }>;
}

export interface OptimizationOutput {
  contactsToSuppress: Array<{
    contactId: number;
    email: string;
    reason: string;
    bounceType?: string;
  }>;
  rationale: string;
  expectedImpact: string;
  suppressionBreakdown: {
    hardBounces: number;
    softBouncePatterns: number;
    total: number;
  };
  confidence: number;
}

const SYSTEM_PROMPT = `You are an email list optimization specialist focused on maintaining high deliverability and sender reputation.

Your role is to identify which contacts should be suppressed (removed from active lists) based on bounce behavior.

Suppression Criteria:
1. **Hard Bounces** - Suppress immediately for:
   - user_unknown
   - domain_error
   - mailbox_inactive
   - mailbox_full (if persistent)

2. **Soft Bounce Patterns** - Suppress if:
   - 3 or more soft bounces across 3+ campaigns
   - Consistent pattern (same reason repeatedly)
   - Recent soft bounces (within last 30 days)

3. **DO NOT Suppress** for:
   - Single soft bounces (temporary issues)
   - Different soft bounce reasons (might be transient)
   - Recent additions to list (< 2 campaigns)

Be conservative but decisive. Protecting sender reputation is critical.`;

export class OptimizationAgent {
  private geminiClient: GeminiClient;
  private temperature = 0.3; // Low temperature for consistent, conservative decisions

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  async determineSuppression(bounces: BounceContact[]): Promise<OptimizationOutput> {
    const userPrompt = this.buildPrompt(bounces);

    const response = await this.geminiClient.generateJSON<OptimizationOutput>(
      SYSTEM_PROMPT,
      userPrompt,
      this.temperature
    );

    this.validateOutput(response);

    return response;
  }

  private buildPrompt(bounces: BounceContact[]): string {
    const bouncesSummary = bounces
      .map(
        (b) =>
          `- Contact ${b.contactId} (${b.email}): ${b.bounceType} bounce, reason: ${b.bounceReason}, count: ${b.bounceCount}`
      )
      .join('\n');

    return `Analyze these bounced contacts and determine which should be suppressed:

**Bounce Data (${bounces.length} total):**
${bouncesSummary}

**Task:**
1. Identify contacts that meet suppression criteria
2. Explain rationale for each suppression decision
3. Estimate impact on list health and deliverability

Respond in JSON format:
{
  "contactsToSuppress": [
    {
      "contactId": number,
      "email": "string",
      "reason": "specific reason for suppression",
      "bounceType": "hard" | "soft"
    }
  ],
  "rationale": "Overall explanation of suppression strategy",
  "expectedImpact": "How this will affect deliverability and sender reputation",
  "suppressionBreakdown": {
    "hardBounces": number,
    "softBouncePatterns": number,
    "total": number
  },
  "confidence": 0.0-1.0
}`;
  }

  private validateOutput(output: any): void {
    const required = [
      'contactsToSuppress',
      'rationale',
      'expectedImpact',
      'suppressionBreakdown',
      'confidence',
    ];

    for (const field of required) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(output.contactsToSuppress)) {
      throw new Error('contactsToSuppress must be an array');
    }

    if (
      typeof output.suppressionBreakdown !== 'object' ||
      !('hardBounces' in output.suppressionBreakdown) ||
      !('softBouncePatterns' in output.suppressionBreakdown) ||
      !('total' in output.suppressionBreakdown)
    ) {
      throw new Error('Invalid suppressionBreakdown structure');
    }
  }
}
```

### Reporting Agent

`src/agents/reporting-agent.ts`:

```typescript
import { GeminiClient } from './gemini-client';

export interface ReportingInput {
  maintenanceType: 'post_campaign' | 'weekly_health';
  listHealthAssessments: any[];
  suppressionPlan?: any;
  rebalancingPlan?: any;
  beforeState: any;
  afterState: any;
  executionResults: {
    contactsSuppressed: number;
    contactsRebalanced: number;
    errors: any[];
  };
}

export interface ReportingOutput {
  executiveSummary: string;
  keyMetrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  actionsTaken: string[];
  recommendations: string[];
  concerns: string[];
  nextSteps: string[];
}

const SYSTEM_PROMPT = `You are a technical writer specializing in executive-level reporting for email marketing operations.

Your role is to synthesize complex list management data into clear, actionable reports for stakeholders.

Report Structure:
1. **Executive Summary** - 2-3 sentences explaining what happened and why it matters
2. **Key Metrics** - Most important numbers with context
3. **Actions Taken** - What the system did automatically
4. **Recommendations** - What humans should consider doing
5. **Concerns** - Issues requiring attention
6. **Next Steps** - Clear action items with timing

Writing Style:
- Clear and concise
- Focus on business impact, not technical details
- Use specific numbers and percentages
- Avoid jargon
- Action-oriented

Your output will be sent to stakeholders via Slack.`;

export class ReportingAgent {
  private geminiClient: GeminiClient;
  private temperature = 0.6;

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  async generateReport(input: ReportingInput): Promise<ReportingOutput> {
    const userPrompt = this.buildPrompt(input);

    const response = await this.geminiClient.generateJSON<ReportingOutput>(
      SYSTEM_PROMPT,
      userPrompt,
      this.temperature
    );

    this.validateOutput(response);

    return response;
  }

  private buildPrompt(input: ReportingInput): string {
    const beforeTotal =
      input.beforeState.campaignList1 + input.beforeState.campaignList2 + input.beforeState.campaignList3;
    const afterTotal =
      input.afterState.campaignList1 + input.afterState.campaignList2 + input.afterState.campaignList3;

    return `Generate an executive report for this list maintenance operation:

**Operation Type:** ${input.maintenanceType}

**Before State:**
- Campaign List 1: ${input.beforeState.campaignList1}
- Campaign List 2: ${input.beforeState.campaignList2}
- Campaign List 3: ${input.beforeState.campaignList3}
- Total Active: ${beforeTotal}
- Suppression List: ${input.beforeState.suppressionList}

**After State:**
- Campaign List 1: ${input.afterState.campaignList1}
- Campaign List 2: ${input.afterState.campaignList2}
- Campaign List 3: ${input.afterState.campaignList3}
- Total Active: ${afterTotal}
- Suppression List: ${input.afterState.suppressionList}

**Actions Performed:**
- Contacts Suppressed: ${input.executionResults.contactsSuppressed}
- Contacts Rebalanced: ${input.executionResults.contactsRebalanced}
- Errors Encountered: ${input.executionResults.errors.length}

**AI Assessments:**
${JSON.stringify(input.listHealthAssessments, null, 2)}

${input.suppressionPlan ? `**Suppression Plan:**\n${JSON.stringify(input.suppressionPlan, null, 2)}` : ''}

${input.rebalancingPlan ? `**Rebalancing Plan:**\n${JSON.stringify(input.rebalancingPlan, null, 2)}` : ''}

Generate a report in JSON format:
{
  "executiveSummary": "2-3 sentence summary of what happened and business impact",
  "keyMetrics": [
    {
      "label": "Metric name",
      "value": "Value with units",
      "trend": "up" | "down" | "stable"
    }
  ],
  "actionsTaken": ["action 1", "action 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "concerns": ["concern 1", "concern 2"],
  "nextSteps": ["next step 1", "next step 2"]
}`;
  }

  private validateOutput(output: any): void {
    const required = [
      'executiveSummary',
      'keyMetrics',
      'actionsTaken',
      'recommendations',
      'concerns',
      'nextSteps',
    ];

    for (const field of required) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(output.keyMetrics)) {
      throw new Error('keyMetrics must be an array');
    }

    for (const metric of output.keyMetrics) {
      if (!metric.label || !metric.value) {
        throw new Error('Each keyMetric must have label and value');
      }
    }
  }
}
```

### List Management Orchestrator

`src/agents/list-management-orchestrator.ts`:

```typescript
import { GeminiClient } from './gemini-client';
import { ListHealthAgent, ListHealthInput } from './list-health-agent';
import { RebalancingAgent, RebalancingInput } from './rebalancing-agent';
import { OptimizationAgent, BounceContact } from './optimization-agent';
import { ReportingAgent, ReportingInput } from './reporting-agent';

export class ListManagementOrchestrator {
  private geminiClient: GeminiClient;
  private agents: {
    listHealth: ListHealthAgent;
    rebalancing: RebalancingAgent;
    optimization: OptimizationAgent;
    reporting: ReportingAgent;
  };

  constructor() {
    this.geminiClient = new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'gemini-2.0-flash-exp',
    });

    this.agents = {
      listHealth: new ListHealthAgent(this.geminiClient),
      rebalancing: new RebalancingAgent(this.geminiClient),
      optimization: new OptimizationAgent(this.geminiClient),
      reporting: new ReportingAgent(this.geminiClient),
    };
  }

  /**
   * Orchestrate post-campaign analysis
   */
  async analyzePostCampaign(
    bounceData: any,
    currentState: any,
    roundNumber: number
  ): Promise<{
    bounceAnalysis: any;
    listHealthAssessments: any[];
    suppressionPlan: any;
    rebalancingPlan: any;
    maintenanceReport: any;
  }> {
    console.log('[Orchestrator] Starting post-campaign analysis...');

    // Step 1: Analyze bounces and determine suppressions
    const bounceContacts: BounceContact[] = this.parseBounceData(bounceData);
    const suppressionPlan = await this.agents.optimization.determineSuppression(bounceContacts);

    console.log(`[Orchestrator] Identified ${suppressionPlan.contactsToSuppress.length} contacts for suppression`);

    // Step 2: Analyze health of each list
    const listHealthInputs: ListHealthInput[] = this.buildListHealthInputs(currentState, bounceData);
    const listHealthAssessments = await Promise.all(
      listHealthInputs.map((input) => this.agents.listHealth.analyze(input))
    );

    console.log('[Orchestrator] List health analysis complete');

    // Step 3: Determine rebalancing needs
    const rebalancingInput: RebalancingInput = this.buildRebalancingInput(
      currentState,
      suppressionPlan
    );
    const rebalancingPlan = await this.agents.rebalancing.determineRebalancing(rebalancingInput);

    console.log(`[Orchestrator] Rebalancing ${rebalancingPlan.requiresRebalancing ? 'REQUIRED' : 'NOT NEEDED'}`);

    // Step 4: Generate executive report
    const reportingInput: ReportingInput = {
      maintenanceType: 'post_campaign',
      listHealthAssessments,
      suppressionPlan,
      rebalancingPlan,
      beforeState: currentState,
      afterState: this.calculateAfterState(currentState, suppressionPlan, rebalancingPlan),
      executionResults: {
        contactsSuppressed: suppressionPlan.contactsToSuppress.length,
        contactsRebalanced: rebalancingPlan.movements.length,
        errors: [],
      },
    };

    const maintenanceReport = await this.agents.reporting.generateReport(reportingInput);

    console.log('[Orchestrator] Analysis complete');

    return {
      bounceAnalysis: bounceData,
      listHealthAssessments,
      suppressionPlan,
      rebalancingPlan,
      maintenanceReport,
    };
  }

  /**
   * Orchestrate weekly health check
   */
  async analyzeWeeklyHealth(currentState: any): Promise<{
    listHealthAssessments: any[];
    weeklyReport: any;
  }> {
    console.log('[Orchestrator] Starting weekly health check...');

    // Analyze each list
    const listHealthInputs = this.buildListHealthInputs(currentState, null);
    const listHealthAssessments = await Promise.all(
      listHealthInputs.map((input) => this.agents.listHealth.analyze(input))
    );

    // Generate weekly report
    const reportingInput: ReportingInput = {
      maintenanceType: 'weekly_health',
      listHealthAssessments,
      beforeState: currentState,
      afterState: currentState,
      executionResults: {
        contactsSuppressed: 0,
        contactsRebalanced: 0,
        errors: [],
      },
    };

    const weeklyReport = await this.agents.reporting.generateReport(reportingInput);

    console.log('[Orchestrator] Weekly health check complete');

    return {
      listHealthAssessments,
      weeklyReport,
    };
  }

  // Private helper methods

  private parseBounceData(bounceData: any): BounceContact[] {
    // Transform Mailjet bounce data into BounceContact format
    // This will depend on actual Mailjet API response structure
    return bounceData.bounces || [];
  }

  private buildListHealthInputs(currentState: any, bounceData: any): ListHealthInput[] {
    // Build health inputs for each campaign list
    // Implementation depends on data structure
    return [];
  }

  private buildRebalancingInput(currentState: any, suppressionPlan: any): RebalancingInput {
    const suppressedByList = this.groupSuppressionsByList(suppressionPlan.contactsToSuppress);

    return {
      currentDistribution: {
        list1: currentState.campaignList1,
        list2: currentState.campaignList2,
        list3: currentState.campaignList3,
      },
      suppressedContacts: {
        fromList1: suppressedByList.list1,
        fromList2: suppressedByList.list2,
        fromList3: suppressedByList.list3,
      },
      availableForRebalancing: currentState.masterList - (currentState.campaignList1 + currentState.campaignList2 + currentState.campaignList3),
      balanceThreshold: 5,
    };
  }

  private groupSuppressionsByList(suppressions: any[]): { list1: number; list2: number; list3: number } {
    // Group suppressions by source list
    return { list1: 0, list2: 0, list3: 0 };
  }

  private calculateAfterState(currentState: any, suppressionPlan: any, rebalancingPlan: any): any {
    // Calculate expected state after maintenance
    return currentState;
  }
}
```

---

## Caching Layer

### Redis Client

`src/services/cache/redis-client.ts`:

```typescript
import Redis from 'ioredis';

export class RedisClient {
  private client: Redis;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('[Redis] Error:', error);
      this.isConnected = false;
    });
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`[Redis] GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`[Redis] SET error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`[Redis] DEL error for key ${key}:`, error);
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`[Redis] JSON parse error for key ${key}:`, error);
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error) {
      console.error(`[Redis] JSON stringify error for key ${key}:`, error);
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
    this.isConnected = false;
  }
}
```

### List Cache Service

`src/services/cache/list-cache.service.ts`:

```typescript
import { RedisClient } from './redis-client';
import { ContactListMembership, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CACHE_TTL = 3600; // 1 hour
const CACHE_KEYS = {
  listState: 'list:state',
  contactMembership: (contactId: number) => `contact:${contactId}:membership`,
  listContacts: (listId: string) => `list:${listId}:contacts`,
};

export class ListCacheService {
  private redis: RedisClient;

  constructor() {
    this.redis = new RedisClient();
  }

  /**
   * Cache current list state
   */
  async cacheListState(state: any): Promise<void> {
    await this.redis.setJSON(CACHE_KEYS.listState, state, CACHE_TTL);
  }

  /**
   * Get cached list state
   */
  async getListState(): Promise<any | null> {
    return await this.redis.getJSON(CACHE_KEYS.listState);
  }

  /**
   * Cache contact membership
   */
  async cacheContactMembership(contactId: number, membership: Partial<ContactListMembership>): Promise<void> {
    await this.redis.setJSON(CACHE_KEYS.contactMembership(contactId), membership, CACHE_TTL);
  }

  /**
   * Get cached contact membership
   */
  async getContactMembership(contactId: number): Promise<Partial<ContactListMembership> | null> {
    return await this.redis.getJSON(CACHE_KEYS.contactMembership(contactId));
  }

  /**
   * Update contact membership (cache + database)
   */
  async updateContactMembership(
    contactId: number,
    updates: Partial<Pick<ContactListMembership, 'inCampaignList1' | 'inCampaignList2' | 'inCampaignList3' | 'inSuppressionList'>>
  ): Promise<void> {
    // Update database
    await prisma.contactListMembership.upsert({
      where: { contactId },
      update: {
        ...updates,
        lastUpdated: new Date(),
      },
      create: {
        contactId,
        email: '', // Will be updated by sync
        ...updates,
      },
    });

    // Invalidate cache
    await this.invalidateContact(contactId);
  }

  /**
   * Invalidate all caches
   */
  async invalidateAll(): Promise<void> {
    await this.redis.del(CACHE_KEYS.listState);
  }

  /**
   * Invalidate contact cache
   */
  async invalidateContact(contactId: number): Promise<void> {
    await this.redis.del(CACHE_KEYS.contactMembership(contactId));
  }

  /**
   * Warm cache from database
   */
  async warmCache(): Promise<void> {
    console.log('[ListCache] Warming cache...');

    // This would typically load frequently accessed data
    // Implementation depends on specific needs

    console.log('[ListCache] Cache warmed');
  }
}
```

---

## Scheduler Jobs

### Post-Campaign Maintenance Job

`src/schedulers/jobs/post-campaign-maintenance.job.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PostCampaignMaintenanceService } from '../../services/list-management/post-campaign-maintenance.service';

const prisma = new PrismaClient();

export async function executePostCampaignMaintenanceJobs(): Promise<void> {
  console.log('[PostCampaignMaintenanceJob] Checking for campaigns needing maintenance...');

  const maintenanceService = new PostCampaignMaintenanceService();

  // Find campaigns sent 24 hours ago that haven't had maintenance
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const campaignsNeedingMaintenance = await prisma.campaignSchedule.findMany({
    where: {
      sendTime: {
        lte: twentyFourHoursAgo,
      },
      status: 'sent',
      listMaintenanceLogs: {
        none: {
          maintenanceType: 'post_campaign',
        },
      },
    },
  });

  console.log(`[PostCampaignMaintenanceJob] Found ${campaignsNeedingMaintenance.length} campaigns`);

  for (const campaign of campaignsNeedingMaintenance) {
    try {
      console.log(`[PostCampaignMaintenanceJob] Processing campaign ${campaign.id}...`);

      const report = await maintenanceService.execute(campaign);

      console.log(`[PostCampaignMaintenanceJob] Campaign ${campaign.id} complete:`, {
        status: report.status,
        suppressed: report.contactsSuppressed,
        rebalanced: report.contactsRebalanced,
      });
    } catch (error) {
      console.error(`[PostCampaignMaintenanceJob] Error processing campaign ${campaign.id}:`, error);
    }
  }

  console.log('[PostCampaignMaintenanceJob] Complete');
}
```

### Weekly Health Check Job

`src/schedulers/jobs/weekly-health-check.job.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { ListManagementOrchestrator } from '../../agents/list-management-orchestrator';
import { ListOperationsService } from '../../services/list-management/list-operations.service';
import { SlackMCPClient } from '../../services/slack/slack-mcp-client';

const prisma = new PrismaClient();

export async function executeWeeklyHealthCheck(): Promise<void> {
  console.log('[WeeklyHealthCheckJob] Starting weekly health check...');

  const startTime = Date.now();
  const orchestrator = new ListManagementOrchestrator();
  const listOps = new ListOperationsService();
  const slackClient = new SlackMCPClient();

  try {
    // Get current list state
    const currentState = await listOps.getCurrentListState();

    // Run AI analysis
    const analysis = await orchestrator.analyzeWeeklyHealth(currentState);

    // Calculate balance metrics
    const balanceDeviation = listOps.calculateBalanceDeviation(
      currentState.campaignList1,
      currentState.campaignList2,
      currentState.campaignList3
    );
    const isBalanced = listOps.isBalanced(
      currentState.campaignList1,
      currentState.campaignList2,
      currentState.campaignList3
    );

    // Determine overall urgency
    const urgency = analysis.listHealthAssessments.some((a) => a.status === 'critical')
      ? 'critical'
      : analysis.listHealthAssessments.some((a) => a.status === 'warning')
      ? 'high'
      : 'low';

    // Save health check
    const healthCheck = await prisma.listHealthCheck.create({
      data: {
        masterListSize: currentState.masterList,
        campaignList1Size: currentState.campaignList1,
        campaignList2Size: currentState.campaignList2,
        campaignList3Size: currentState.campaignList3,
        suppressionListSize: currentState.suppressionList,
        balanceDeviation,
        isBalanced,
        averageBounceRate: 0, // Calculate from recent campaigns
        averageDeliveryRate: 0, // Calculate from recent campaigns
        healthAssessments: analysis.listHealthAssessments as any,
        weeklyReport: analysis.weeklyReport as any,
        actionItems: analysis.weeklyReport.recommendations as any,
        urgency,
        executionTimeMs: Date.now() - startTime,
        status: 'success',
      },
    });

    // Send Slack notification
    await sendWeeklyReport(slackClient, healthCheck.id, analysis, currentState, isBalanced);

    await prisma.listHealthCheck.update({
      where: { id: healthCheck.id },
      data: { slackNotificationSent: true },
    });

    console.log(`[WeeklyHealthCheckJob] Complete in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('[WeeklyHealthCheckJob] Error:', error);

    await prisma.listHealthCheck.create({
      data: {
        masterListSize: 0,
        campaignList1Size: 0,
        campaignList2Size: 0,
        campaignList3Size: 0,
        suppressionListSize: 0,
        balanceDeviation: 0,
        isBalanced: false,
        averageBounceRate: 0,
        averageDeliveryRate: 0,
        healthAssessments: {},
        weeklyReport: {},
        actionItems: {},
        urgency: 'critical',
        executionTimeMs: Date.now() - startTime,
        status: 'failed',
        errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
      },
    });
  }
}

async function sendWeeklyReport(
  slackClient: SlackMCPClient,
  checkId: number,
  analysis: any,
  currentState: any,
  isBalanced: boolean
): Promise<void> {
  const statusEmoji = isBalanced ? '✅' : '⚠️';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} Weekly List Health Check`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${analysis.weeklyReport.executiveSummary}*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Campaign List 1:*\n${currentState.campaignList1.toLocaleString()} contacts`,
        },
        {
          type: 'mrkdwn',
          text: `*Campaign List 2:*\n${currentState.campaignList2.toLocaleString()} contacts`,
        },
        {
          type: 'mrkdwn',
          text: `*Campaign List 3:*\n${currentState.campaignList3.toLocaleString()} contacts`,
        },
        {
          type: 'mrkdwn',
          text: `*Suppression List:*\n${currentState.suppressionList.toLocaleString()} contacts`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recommendations:*\n${analysis.weeklyReport.recommendations.map((r: string) => `• ${r}`).join('\n')}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Health Check ID: ${checkId} | <${process.env.APP_URL}/admin/list-health/${checkId}|View Full Report>`,
        },
      ],
    },
  ];

  await slackClient.sendMessage('#_traction', { blocks });
}
```

### List Management Scheduler

`src/schedulers/list-management.scheduler.ts`:

```typescript
import cron from 'node-cron';
import { executePostCampaignMaintenanceJobs } from './jobs/post-campaign-maintenance.job';
import { executeWeeklyHealthCheck } from './jobs/weekly-health-check.job';

export class ListManagementScheduler {
  private jobs: cron.ScheduledTask[] = [];

  start(): void {
    console.log('[ListManagementScheduler] Starting schedulers...');

    // Post-campaign maintenance: Check every hour
    const maintenanceJob = cron.schedule('0 * * * *', async () => {
      try {
        await executePostCampaignMaintenanceJobs();
      } catch (error) {
        console.error('[ListManagementScheduler] Maintenance job error:', error);
      }
    });

    // Weekly health check: Every Monday at 10:00 AM UTC
    const healthCheckJob = cron.schedule('0 10 * * 1', async () => {
      try {
        await executeWeeklyHealthCheck();
      } catch (error) {
        console.error('[ListManagementScheduler] Health check job error:', error);
      }
    });

    this.jobs.push(maintenanceJob, healthCheckJob);

    console.log('[ListManagementScheduler] All schedulers started');
  }

  stop(): void {
    console.log('[ListManagementScheduler] Stopping schedulers...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }
}
```

---

## Testing Requirements

### Unit Tests

Create `tests/unit/agents/list-health-agent.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ListHealthAgent, ListHealthInput } from '../../../src/agents/list-health-agent';
import { GeminiClient } from '../../../src/agents/gemini-client';

describe('ListHealthAgent', () => {
  let agent: ListHealthAgent;
  let mockGeminiClient: jest.Mocked<GeminiClient>;

  beforeEach(() => {
    mockGeminiClient = {
      generateJSON: jest.fn(),
    } as any;

    agent = new ListHealthAgent(mockGeminiClient);
  });

  describe('analyze()', () => {
    it('should return healthy status for good metrics', async () => {
      const input: ListHealthInput = {
        name: 'Campaign List 1',
        subscriberCount: 1200,
        targetSize: 1200,
        bounceRate: 1.5,
        hardBounces: 10,
        softBounces: 8,
        deliveryRate: 98.5,
        lastCampaignDate: new Date(),
        bounceRateTrend: 'stable',
        sizeTrend: 'stable',
        suppressionRate: 0.8,
      };

      mockGeminiClient.generateJSON.mockResolvedValue({
        status: 'healthy',
        concerns: [],
        riskFactors: [],
        urgency: 'low',
        confidence: 0.95,
      });

      const result = await agent.analyze(input);

      expect(result.status).toBe('healthy');
      expect(result.urgency).toBe('low');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should return warning status for elevated bounce rate', async () => {
      const input: ListHealthInput = {
        name: 'Campaign List 2',
        subscriberCount: 1150,
        targetSize: 1200,
        bounceRate: 6.2,
        hardBounces: 50,
        softBounces: 21,
        deliveryRate: 93.8,
        lastCampaignDate: new Date(),
        bounceRateTrend: 'degrading',
        sizeTrend: 'shrinking',
        suppressionRate: 4.2,
      };

      mockGeminiClient.generateJSON.mockResolvedValue({
        status: 'warning',
        concerns: ['Hard bounce rate (4.3%) exceeds healthy threshold'],
        riskFactors: ['Sender reputation at risk'],
        urgency: 'medium',
        confidence: 0.88,
      });

      const result = await agent.analyze(input);

      expect(result.status).toBe('warning');
      expect(result.concerns.length).toBeGreaterThan(0);
      expect(result.urgency).toBe('medium');
    });

    it('should throw error if response is missing required fields', async () => {
      const input: ListHealthInput = {
        name: 'Test List',
        subscriberCount: 1000,
        targetSize: 1000,
        bounceRate: 2.0,
        hardBounces: 15,
        softBounces: 5,
        deliveryRate: 98.0,
        lastCampaignDate: new Date(),
        bounceRateTrend: 'stable',
        sizeTrend: 'stable',
        suppressionRate: 1.5,
      };

      mockGeminiClient.generateJSON.mockResolvedValue({
        status: 'healthy',
        // Missing required fields
      });

      await expect(agent.analyze(input)).rejects.toThrow('Missing required field');
    });
  });
});
```

### Integration Tests

Create `tests/integration/services/post-campaign-maintenance.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { PostCampaignMaintenanceService } from '../../../src/services/list-management/post-campaign-maintenance.service';

const prisma = new PrismaClient();

describe('PostCampaignMaintenanceService Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();
  });

  it('should complete full maintenance workflow', async () => {
    // Create test campaign schedule
    const campaign = await prisma.campaignSchedule.create({
      data: {
        name: 'Test Campaign',
        sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        status: 'sent',
        mailjetCampaignId: '12345',
        listId: 'test-list',
        roundNumber: 1,
      },
    });

    const service = new PostCampaignMaintenanceService();

    const report = await service.execute(campaign);

    expect(report.status).toBe('success');
    expect(report.maintenanceLogId).toBeDefined();

    // Verify maintenance log was created
    const log = await prisma.listMaintenanceLog.findUnique({
      where: { id: report.maintenanceLogId },
    });

    expect(log).toBeDefined();
    expect(log!.status).toBe('success');
    expect(log!.maintenanceType).toBe('post_campaign');

    // Cleanup
    await prisma.listMaintenanceLog.delete({ where: { id: log!.id } });
    await prisma.campaignSchedule.delete({ where: { id: campaign.id } });
  }, 60000); // 60 second timeout for AI calls
});
```

### E2E Tests

Create `tests/e2e/list-management-workflow.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/app';

describe('List Management E2E', () => {
  it('should trigger and complete post-campaign maintenance', async () => {
    // Trigger maintenance job
    const response = await request(app)
      .post('/api/list-management/trigger-maintenance')
      .send({
        campaignId: 'test-campaign-123',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.maintenanceLogId).toBeDefined();

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check maintenance log
    const logResponse = await request(app)
      .get(`/api/list-management/logs/${response.body.maintenanceLogId}`)
      .expect(200);

    expect(logResponse.body.status).toBe('success');
    expect(logResponse.body.contactsSuppressed).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('should generate weekly health report', async () => {
    const response = await request(app)
      .post('/api/list-management/trigger-health-check')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.healthCheckId).toBeDefined();

    // Check health check results
    const healthResponse = await request(app)
      .get(`/api/list-management/health-checks/${response.body.healthCheckId}`)
      .expect(200);

    expect(healthResponse.body.isBalanced).toBeDefined();
    expect(healthResponse.body.urgency).toMatch(/low|medium|high|critical/);
  }, 30000);
});
```

---

## Deployment

### Environment Variables

Add to `.env`:

```bash
# List Management Configuration
MAILJET_MASTER_LIST_ID=5776
MAILJET_CAMPAIGN_LIST_1_ID=10503497
MAILJET_CAMPAIGN_LIST_2_ID=10503498
MAILJET_CAMPAIGN_LIST_3_ID=10503499
MAILJET_SUPPRESSION_LIST_ID=10503500

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# List Management Settings
LIST_BALANCE_THRESHOLD=5  # ±5%
LIST_MAINTENANCE_DELAY_HOURS=24
WEEKLY_HEALTH_CHECK_DAY=1  # Monday
WEEKLY_HEALTH_CHECK_HOUR=10  # 10 AM UTC

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600  # 1 hour
```

### Heroku Deployment

Update `Procfile`:

```
web: npm run start
worker: npm run worker
```

Add `package.json` scripts:

```json
{
  "scripts": {
    "start": "node dist/server.js",
    "worker": "node dist/worker.js",
    "build": "tsc",
    "dev": "ts-node-dev src/server.ts",
    "dev:worker": "ts-node-dev src/worker.ts",
    "migrate": "prisma migrate deploy",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e"
  }
}
```

Create `src/worker.ts`:

```typescript
import { ListManagementScheduler } from './schedulers/list-management.scheduler';

console.log('[Worker] Starting list management worker...');

const scheduler = new ListManagementScheduler();
scheduler.start();

process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});
```

### Deployment Steps

```bash
# 1. Create Heroku app (if not exists)
heroku create campaign-manager

# 2. Add Heroku Redis
heroku addons:create heroku-redis:mini

# 3. Add Heroku Postgres (if not exists)
heroku addons:create heroku-postgresql:mini

# 4. Set environment variables
heroku config:set GEMINI_API_KEY=your_key_here
heroku config:set MAILJET_MASTER_LIST_ID=5776
# ... set all other env vars

# 5. Scale worker dyno
heroku ps:scale worker=1

# 6. Deploy
git push heroku main

# 7. Run migrations
heroku run npm run migrate

# 8. Verify logs
heroku logs --tail --dyno worker
```

---

## Configuration

### TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Jest Configuration

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

---

## Next Steps

1. ✅ Complete database schema and migrations
2. ✅ Implement AI agents and orchestrator
3. ✅ Build workflow services
4. ✅ Add caching layer
5. ✅ Create scheduler jobs
6. 🔲 Implement API endpoints
7. 🔲 Write comprehensive tests
8. 🔲 Deploy to staging
9. 🔲 Validate with test campaigns
10. 🔲 Production deployment

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Approved
