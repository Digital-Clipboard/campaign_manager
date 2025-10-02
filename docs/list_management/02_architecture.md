# List Management System Architecture

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Complete
- **Purpose**: Technical architecture for AI-driven list management system

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Component Architecture](#component-architecture)
3. [AI Agent Layer](#ai-agent-layer)
4. [Data Layer](#data-layer)
5. [Integration Layer](#integration-layer)
6. [Caching Strategy](#caching-strategy)
7. [Technology Stack](#technology-stack)
8. [Security Architecture](#security-architecture)
9. [Scalability & Performance](#scalability--performance)

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  List Management System                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Workflow    │  │  AI Agent    │  │  Cache       │      │
│  │  Orchestrator│→ │  Layer       │→ │  Layer       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│          ↓                 ↓                 ↓              │
│  ┌────────────────────────────────────────────────┐        │
│  │         Data & Integration Layer                │        │
│  └────────────────────────────────────────────────┘        │
│          ↓                 ↓                 ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   MailJet    │  │    Slack     │  │   Gemini     │     │
│  │     API      │  │  MCP Server  │  │     AI       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
                ┌──────────────────────┐
                │   PostgreSQL         │
                │   (Prisma ORM)       │
                │   +                  │
                │   Redis Cache        │
                └──────────────────────┘
```

### Integration with Campaign Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│            Campaign Lifecycle System (Existing)              │
│  Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5            │
└────────────────────────┬────────────────────────────────────┘
                         │
                   Integration Points:
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   Stage 2          Stage 5          Stage 6
   Enhanced         Triggers         NEW
   Pre-Flight       Stage 6          Post-Campaign
   + List                            Maintenance
   Validation
        │                │                │
        └────────────────┴────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           List Management System (New)                       │
│  Workflow 1 → Workflow 2 → Workflow 3                        │
│  (Post-Cam)   (Weekly)     (Pre-Flight)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Workflow Orchestration Layer

**Purpose**: Coordinate list management workflows and agent execution

```typescript
// src/list-management/orchestrator/list-management.orchestrator.ts

import { GeminiClient } from '@/integrations/gemini-ai.client';
import { ListHealthAgent } from '../agents/list-health.agent';
import { RebalancingAgent } from '../agents/rebalancing.agent';
import { OptimizationAgent } from '../agents/optimization.agent';
import { ReportingAgent } from '../agents/reporting.agent';

export class ListManagementOrchestrator {
  private geminiClient: GeminiClient;
  private agents: {
    listHealth: ListHealthAgent;
    rebalancing: RebalancingAgent;
    optimization: OptimizationAgent;
    reporting: ReportingAgent;
  };

  constructor() {
    // Shared Gemini client for all agents
    this.geminiClient = new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'gemini-2.0-flash-exp',
    });

    // Initialize agents with shared client
    this.agents = {
      listHealth: new ListHealthAgent(this.geminiClient),
      rebalancing: new RebalancingAgent(this.geminiClient),
      optimization: new OptimizationAgent(this.geminiClient),
      reporting: new ReportingAgent(this.geminiClient),
    };
  }

  /**
   * Execute post-campaign maintenance workflow
   */
  async executePostCampaignMaintenance(
    campaignSchedule: CampaignSchedule
  ): Promise<MaintenanceReport> {
    // Implementation in workflow services
    const maintenanceService = new PostCampaignMaintenanceService(
      this.agents,
      this.geminiClient
    );

    return maintenanceService.execute(campaignSchedule);
  }

  /**
   * Execute weekly health check workflow
   */
  async executeWeeklyHealthCheck(): Promise<WeeklyHealthReport> {
    const healthCheckService = new WeeklyHealthCheckService(
      this.agents,
      this.geminiClient
    );

    return healthCheckService.execute();
  }

  /**
   * Validate list for campaign (pre-flight enhancement)
   */
  async validateListForCampaign(
    schedule: CampaignSchedule
  ): Promise<ListValidation> {
    const validationService = new ListValidationService(
      this.agents.listHealth
    );

    return validationService.validate(schedule);
  }
}
```

### 2. Workflow Services

```typescript
// src/list-management/services/post-campaign-maintenance.service.ts

export class PostCampaignMaintenanceService {
  constructor(
    private agents: AIAgents,
    private mailjet: MailJetClient,
    private redis: RedisClient,
    private database: PrismaClient,
    private slack: SlackMCPClient
  ) {}

  async execute(schedule: CampaignSchedule): Promise<MaintenanceReport> {
    const startTime = Date.now();

    logger.info('Starting post-campaign list maintenance', {
      campaignId: schedule.mailjetCampaignId,
      roundNumber: schedule.roundNumber,
    });

    // Step 1: Fetch bounce data
    const bounceData = await this.fetchBounceData(schedule);

    // Step 2: AI analysis (Optimization Agent)
    const suppressionPlan = await this.analyzeSuppressions(bounceData, schedule);

    // Step 3: Execute suppression
    const suppressionResults = await this.executeSuppression(suppressionPlan);

    // Step 4: Remove from campaign lists
    await this.removeFromCampaignLists(suppressionPlan.suppressImmediately);

    // Step 5: AI generates rebalancing plan
    const rebalancingPlan = await this.generateRebalancingPlan(
      suppressionPlan.suppressImmediately
    );

    // Step 6: Execute rebalancing
    const rebalancingResults = await this.executeRebalancing(rebalancingPlan);

    // Step 7: Update Redis cache
    await this.updateCache();

    // Step 8: Log to database
    const maintenanceLog = await this.logMaintenance({
      schedule,
      bounceData,
      suppressionPlan,
      suppressionResults,
      rebalancingPlan,
      rebalancingResults,
    });

    // Step 9: Send Slack report
    const report = await this.generateAndSendReport({
      schedule,
      suppression: suppressionResults,
      rebalancing: rebalancingResults,
      aiAssessments: {
        optimization: suppressionPlan.rationale,
        rebalancing: rebalancingPlan.rationale,
      },
    });

    logger.info('Post-campaign maintenance completed', {
      maintenanceLogId: maintenanceLog.id,
      duration: Date.now() - startTime,
    });

    return report;
  }

  private async fetchBounceData(
    schedule: CampaignSchedule
  ): Promise<BounceEvent[]> {
    const bounces = await this.mailjet.getCampaignBounces(
      schedule.mailjetCampaignId!
    );

    logger.info('Bounce data collected', {
      totalBounces: bounces.length,
      hardBounces: bounces.filter(b => b.isHardBounce).length,
    });

    return bounces;
  }

  private async analyzeSuppressions(
    bounceData: BounceEvent[],
    schedule: CampaignSchedule
  ): Promise<SuppressionRecommendation> {
    const listHistory = await this.getListHistory(schedule.listId);

    const suppressionPlan = await this.agents.optimization.identifyContactsToSuppress(
      bounceData,
      listHistory
    );

    logger.info('AI suppression plan generated', {
      toSuppress: suppressionPlan.suppressImmediately.length,
      toMonitor: suppressionPlan.monitorClosely.length,
      aiRationale: suppressionPlan.rationale,
    });

    return suppressionPlan;
  }

  // ... additional private methods
}
```

```typescript
// src/list-management/services/weekly-health-check.service.ts

export class WeeklyHealthCheckService {
  constructor(
    private agents: AIAgents,
    private mailjet: MailJetClient,
    private redis: RedisClient,
    private database: PrismaClient,
    private slack: SlackMCPClient
  ) {}

  async execute(): Promise<WeeklyHealthReport> {
    logger.info('Starting weekly list health check');

    // Step 1: Sync all lists from Mailjet
    const lists = await this.syncAllLists();

    // Step 2: Update Redis cache
    await this.updateRedisCache(lists);

    // Step 3: Fetch recent campaign performance
    const recentCampaigns = await this.getRecentCampaigns();

    // Step 4: Calculate list metrics
    const listMetrics = await this.calculateListMetrics(lists, recentCampaigns);

    // Step 5: AI health analysis (parallel)
    const healthAssessments = await this.analyzeListHealth(listMetrics);

    // Step 6: Generate weekly report (Reporting Agent)
    const weeklyReport = await this.generateWeeklyReport(
      listMetrics,
      healthAssessments
    );

    // Step 7: Check for critical issues
    const criticalIssues = this.filterCriticalIssues(healthAssessments);
    if (criticalIssues.length > 0) {
      await this.sendCriticalAlert(criticalIssues);
    }

    // Step 8: Send weekly report to Slack
    await this.sendWeeklyReport(weeklyReport, healthAssessments);

    // Step 9: Log to database
    await this.logHealthCheck(lists, healthAssessments, weeklyReport);

    logger.info('Weekly health check completed', {
      criticalIssues: criticalIssues.length,
      totalIssues: healthAssessments.filter(a => a.urgency !== 'low').length,
    });

    return weeklyReport;
  }

  private async syncAllLists(): Promise<ListsSyncResult> {
    const [masterList, campaignLists, suppressionList] = await Promise.all([
      this.mailjet.getList(5776),
      Promise.all([
        this.mailjet.getList('campaign_list_1'),
        this.mailjet.getList('campaign_list_2'),
        this.mailjet.getList('campaign_list_3'),
      ]),
      this.mailjet.getList(10503500),
    ]);

    return { masterList, campaignLists, suppressionList };
  }

  private async analyzeListHealth(
    listMetrics: ListMetrics[]
  ): Promise<HealthAssessment[]> {
    // Run health agent in parallel for all 3 lists
    return Promise.all(
      listMetrics.map(metrics =>
        this.agents.listHealth.analyze(metrics)
      )
    );
  }

  // ... additional private methods
}
```

---

## AI Agent Layer

### Agent Architecture

```typescript
// Base agent interface
interface AIAgent<TInput, TOutput> {
  analyze(input: TInput): Promise<TOutput>;
}

// Shared Gemini client configuration
interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}
```

### 1. List Health Agent

```typescript
// src/list-management/agents/list-health.agent.ts

export class ListHealthAgent implements AIAgent<ListMetrics, HealthAssessment> {
  constructor(private geminiClient: GeminiClient) {}

  async analyze(listData: ListMetrics): Promise<HealthAssessment> {
    const prompt = this.buildPrompt(listData);

    const response = await this.geminiClient.generateContent({
      prompt,
      temperature: 0.7,
      systemPrompt: SYSTEM_PROMPTS.LIST_HEALTH,
    });

    // Parse AI response into structured assessment
    const parsed = this.parseResponse(response);

    return {
      status: this.determineStatus(listData),
      concerns: parsed.concerns,
      riskFactors: parsed.riskFactors,
      reputationImpact: parsed.reputationImpact,
      urgency: parsed.urgency,
      aiRationale: response.text,
      confidence: response.confidence || 0.85,
    };
  }

  private buildPrompt(listData: ListMetrics): string {
    return `
      Analyze the health of this email campaign list:

      LIST DETAILS:
      - List Name: ${listData.name}
      - Total Contacts: ${listData.subscriberCount}
      - Target Size: ${listData.targetSize}
      - Variance: ${listData.subscriberCount - listData.targetSize} (${listData.variancePercent}%)

      RECENT CAMPAIGN PERFORMANCE:
      - Last Campaign: ${listData.lastCampaignDate}
      - Bounce Rate: ${listData.bounceRate}%
      - Hard Bounces: ${listData.hardBounces}
      - Soft Bounces: ${listData.softBounces}
      - Delivery Rate: ${listData.deliveryRate}%

      HISTORICAL TRENDS:
      - Bounce Rate Trend: ${listData.bounceRateTrend} (last 3 campaigns)
      - List Size Trend: ${listData.sizeTrend}
      - Suppression Rate: ${listData.suppressionRate}%

      Provide:
      1. Overall health status (healthy/warning/critical)
      2. Key concerns and risk factors
      3. Comparison to industry benchmarks (bounce < 2%, delivery > 98%)
      4. Sender reputation impact assessment
      5. Urgency level for maintenance (low/medium/high)

      Format as JSON:
      {
        "concerns": ["concern1", "concern2"],
        "riskFactors": ["risk1", "risk2"],
        "reputationImpact": "description",
        "urgency": "low|medium|high"
      }
    `;
  }

  private determineStatus(listData: ListMetrics): HealthStatus {
    if (listData.bounceRate > 10) return 'critical';
    if (listData.bounceRate > 5) return 'warning';
    return 'healthy';
  }

  private parseResponse(response: GeminiResponse): ParsedHealthAssessment {
    try {
      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON, using fallback');
    }

    // Fallback: extract key information from text
    return {
      concerns: this.extractConcerns(response.text),
      riskFactors: this.extractRiskFactors(response.text),
      reputationImpact: this.extractReputationImpact(response.text),
      urgency: this.extractUrgency(response.text),
    };
  }
}
```

### 2. Rebalancing Agent

```typescript
// src/list-management/agents/rebalancing.agent.ts

export class RebalancingAgent implements AIAgent<RebalancingInput, RebalancingPlan> {
  constructor(private geminiClient: GeminiClient) {}

  async generateRebalancingPlan(
    lists: CampaignList[],
    suppressedContacts: number[]
  ): Promise<RebalancingPlan> {
    const totalActive = lists.reduce((sum, list) =>
      sum + list.subscriberCount, 0
    ) - suppressedContacts.length;

    const targetPerList = Math.ceil(totalActive / 3);

    const prompt = this.buildPrompt(lists, totalActive, targetPerList, suppressedContacts);

    const response = await this.geminiClient.generateContent({
      prompt,
      temperature: 0.5, // More deterministic for redistribution
      systemPrompt: SYSTEM_PROMPTS.REBALANCING,
    });

    const parsed = this.parseResponse(response, targetPerList, totalActive);

    return {
      targetDistribution: parsed.targetDistribution,
      movements: parsed.movements,
      rationale: response.text,
      expectedImpact: parsed.expectedImpact,
      alternativesConsidered: parsed.alternatives,
      confidence: response.confidence || 0.90,
    };
  }

  private buildPrompt(
    lists: CampaignList[],
    totalActive: number,
    targetPerList: number,
    suppressedContacts: number[]
  ): string {
    return `
      Create an optimal rebalancing plan for three campaign lists:

      CURRENT STATE:
      - campaign_list_1: ${lists[0].subscriberCount} contacts
      - campaign_list_2: ${lists[1].subscriberCount} contacts
      - campaign_list_3: ${lists[2].subscriberCount} contacts
      - Total Active: ${totalActive} (after suppressing ${suppressedContacts.length})

      TARGET STATE:
      - Each list: ${targetPerList} contacts (±5% acceptable = ${Math.floor(targetPerList * 0.05)})
      - Maintain FIFO order where possible
      - Minimize contact movement between lists

      CONSTRAINTS:
      - Never move contacts already in suppression list
      - Preserve contact ID ordering for FIFO integrity
      - Balance lists within ±5% of target size
      - Prefer backfilling from master list over moving between campaign lists

      Provide:
      1. Recommended distribution (exact count per list)
      2. Specific movements (which contacts to move, from where to where)
      3. Rationale for each rebalancing decision
      4. Expected impact on campaign performance
      5. Alternative approaches considered and why rejected

      Format as JSON:
      {
        "targetDistribution": {
          "list1": number,
          "list2": number,
          "list3": number
        },
        "movements": [
          {
            "action": "keep|add|move",
            "targetList": "campaign_list_1|2|3",
            "contactCount": number,
            "source": "master_list|campaign_list_X",
            "rationale": "string"
          }
        ],
        "expectedImpact": "string",
        "alternatives": ["alternative1", "alternative2"]
      }
    `;
  }
}
```

### 3. Optimization Agent

```typescript
// src/list-management/agents/optimization.agent.ts

export class OptimizationAgent implements AIAgent<OptimizationInput, SuppressionRecommendation> {
  constructor(private geminiClient: GeminiClient) {}

  async identifyContactsToSuppress(
    bounceData: BounceEvent[],
    listHistory: ListHistory
  ): Promise<SuppressionRecommendation> {
    const prompt = this.buildPrompt(bounceData, listHistory);

    const response = await this.geminiClient.generateContent({
      prompt,
      temperature: 0.3, // Very deterministic for suppression decisions
      systemPrompt: SYSTEM_PROMPTS.OPTIMIZATION,
    });

    const parsed = this.parseResponse(response, bounceData);

    return {
      suppressImmediately: parsed.hardBounces,
      monitorClosely: parsed.repeatedSoftBouncers,
      keepInList: parsed.temporaryIssues,
      rationale: response.text,
      expectedImprovement: parsed.improvement,
      riskAssessment: parsed.risks,
      confidence: response.confidence || 0.95,
    };
  }

  private buildPrompt(bounceData: BounceEvent[], listHistory: ListHistory): string {
    const hardBounces = bounceData.filter(b => b.isHardBounce);
    const softBounces = bounceData.filter(b => !b.isHardBounce);

    return `
      Analyze bounce data and recommend contacts for suppression:

      BOUNCE DATA:
      Total Bounces: ${bounceData.length}

      Hard Bounces: ${hardBounces.length}
      - Invalid emails (user_unknown): ${this.countByReason(bounceData, 'user_unknown')}
      - Domain not found (domain_error): ${this.countByReason(bounceData, 'domain_error')}
      - Mailbox full/inactive: ${this.countByReason(bounceData, 'mailbox_full')}

      Soft Bounces: ${softBounces.length}
      - Temporary failures: ${this.countByReason(bounceData, 'temporary')}
      - Greylisting: ${this.countByReason(bounceData, 'greylisted')}

      HISTORICAL CONTEXT:
      - Contacts with 3+ soft bounces: ${listHistory.repeatedSoftBouncers}
      - First-time soft bouncers: ${listHistory.firstTimeSoftBouncers}
      - Days since last cleanup: ${listHistory.daysSinceLastClean}

      INDUSTRY BEST PRACTICES:
      - Hard bounces: Suppress immediately (within 24 hours)
      - Soft bounces (3+ times): Suppress after 3 strikes
      - Single soft bounces: Keep and monitor
      - Greylisting: Keep (normal ISP behavior)

      Provide:
      1. Contacts to suppress immediately (all hard bounces)
      2. Contacts to monitor closely (repeated soft bounces)
      3. Contacts to keep in list (temporary issues, greylisting)
      4. Detailed rationale for each category
      5. Expected improvement in delivery rate after suppression
      6. Risk assessment for each decision

      Format as JSON with contact IDs in each category.
    `;
  }

  private countByReason(bounces: BounceEvent[], reason: string): number {
    return bounces.filter(b => b.reason === reason).length;
  }
}
```

### 4. Reporting Agent

```typescript
// src/list-management/agents/reporting.agent.ts

export class ReportingAgent implements AIAgent<ReportingInput, WeeklyReport> {
  constructor(private geminiClient: GeminiClient) {}

  async generateWeeklyReport(
    listsData: ListMetrics[],
    recentActivity: RecentActivity
  ): Promise<WeeklyReport> {
    const prompt = this.buildWeeklyReportPrompt(listsData, recentActivity);

    const response = await this.geminiClient.generateContent({
      prompt,
      temperature: 0.6,
      systemPrompt: SYSTEM_PROMPTS.REPORTING,
    });

    const parsed = this.parseResponse(response);

    return {
      summary: parsed.summary,
      highlights: parsed.highlights,
      actionItems: parsed.actionItems,
      weekOverWeek: parsed.weekOverWeek,
      recommendations: parsed.recommendations,
      generatedAt: new Date(),
      confidence: response.confidence || 0.88,
    };
  }

  async generateMaintenanceReport(data: MaintenanceReportData): Promise<MaintenanceReport> {
    const prompt = this.buildMaintenanceReportPrompt(data);

    const response = await this.geminiClient.generateContent({
      prompt,
      temperature: 0.6,
      systemPrompt: SYSTEM_PROMPTS.REPORTING,
    });

    // Format for Slack Block Kit
    return this.formatMaintenanceReport(response, data);
  }

  private buildWeeklyReportPrompt(
    listsData: ListMetrics[],
    activity: RecentActivity
  ): string {
    return `
      Generate an executive-level weekly list health report:

      LIST STATUS:
      ${listsData.map(list => `
      ${list.name}:
        - Size: ${list.subscriberCount} (target: ${list.targetSize})
        - Bounce Rate: ${list.recentBounceRate}%
        - Last Campaign: ${list.lastCampaignDate}
        - Health: ${list.healthStatus}
      `).join('\n')}

      RECENT ACTIVITY (Last 7 Days):
      - Campaigns sent: ${activity.campaignsSent}
      - Contacts suppressed: ${activity.contactsSuppressed}
      - Lists rebalanced: ${activity.rebalancingEvents}
      - Issues detected: ${activity.issuesDetected}
      - New contacts added: +${activity.newContacts}
      - Suppression rate: ${activity.suppressionRate.toFixed(2)}%

      TRENDS:
      - Bounce rate trend: ${this.calculateTrend(listsData, 'bounceRate')}
      - List growth: +${activity.newContacts} contacts
      - Suppression rate: ${activity.suppressionRate}%

      Provide:
      1. Executive summary (2-3 sentences - high level overview)
      2. Key highlights (3-5 positive developments)
      3. Action items (prioritized issues requiring attention)
      4. Week-over-week comparison (key metrics)
      5. Recommendations for next week

      Keep language professional, concise, and actionable.
      Focus on business impact, not technical details.
    `;
  }
}
```

### System Prompts

```typescript
// src/list-management/agents/prompts.ts

export const SYSTEM_PROMPTS = {
  LIST_HEALTH: `
    You are an email deliverability expert specializing in list quality analysis.
    Focus on bounce rates, sender reputation, and list hygiene.

    Reference industry benchmarks:
    - Excellent: < 2% bounce rate, > 98% delivery
    - Good: 2-5% bounce rate, 95-98% delivery
    - Concerning: 5-10% bounce rate, 90-95% delivery
    - Poor: > 10% bounce rate, < 90% delivery

    Always provide specific, actionable insights.
  `,

  REBALANCING: `
    You are a data distribution optimization expert.
    Focus on minimizing disruption while achieving balance.

    Key principles:
    - Preserve FIFO (First-In-First-Out) ordering
    - Minimize contact movement between lists
    - Prefer backfilling from master list
    - Maintain ±5% tolerance for balance

    Explain your reasoning clearly and consider alternatives.
  `,

  OPTIMIZATION: `
    You are an email list optimization specialist.
    Follow industry best practices for bounce management.

    Rules:
    - Hard bounces: Always suppress immediately
    - Soft bounces (3+): Suppress after 3 strikes
    - Single soft bounces: Monitor, don't suppress
    - Greylisting: Normal ISP behavior, keep

    Be conservative - it's better to monitor than over-suppress.
  `,

  REPORTING: `
    You are a technical writer specializing in executive reports.
    Format analysis into clear, concise insights.

    Guidelines:
    - Use business language, not technical jargon
    - Focus on impact and actionable recommendations
    - Highlight both positives and concerns
    - Be specific with numbers and trends

    Keep summaries under 3 sentences.
    Prioritize action items by urgency.
  `,
};
```

---

## Data Layer

### Database Schema (Prisma)

```prisma
// prisma/schema.prisma

// List Maintenance Log - Records all post-campaign maintenance
model ListMaintenanceLog {
  id                  Int       @id @default(autoincrement())
  campaignScheduleId  Int?
  executedAt          DateTime  @default(now())
  eventType           String    // 'maintenance' | 'health_check' | 'rebalancing'

  // Bounce analysis
  bounceAnalysis      Json?     // BounceEvent[]

  // Suppression
  suppressionPlan     Json?     // SuppressionRecommendation
  suppressionResults  Json?     // { successCount, failedCount, errors }

  // Rebalancing
  rebalancingPlan     Json?     // RebalancingPlan
  rebalancingResults  Json?     // { listsUpdated, contactsMoved }

  // AI assessments
  aiAssessments       Json      // { agent: string, rationale: string, confidence: number }[]

  // Audit trail
  beforeState         Json      // List sizes and metadata before
  afterState          Json      // List sizes and metadata after

  // Relations
  campaignSchedule    CampaignSchedule? @relation(fields: [campaignScheduleId], references: [id])

  @@index([executedAt])
  @@index([campaignScheduleId])
  @@index([eventType])
}

// Weekly Health Check - Snapshots of list health
model ListHealthCheck {
  id                    Int       @id @default(autoincrement())
  executedAt            DateTime  @default(now())

  // List snapshots
  masterListSize        Int
  campaignListSizes     Int[]
  suppressionListSize   Int

  // Health assessments (from AI agents)
  healthAssessments     Json      // HealthAssessment[] (one per list)
  weeklyReport          Json      // WeeklyReport from Reporting Agent

  // Issues summary
  criticalIssues        Int       @default(0)
  warningIssues         Int       @default(0)

  @@index([executedAt])
}

// Contact Suppression History - Individual suppression audit trail
model ContactSuppressionHistory {
  id                Int       @id @default(autoincrement())
  contactId         BigInt    // Mailjet contact ID
  email             String
  suppressedAt      DateTime  @default(now())

  // Reason for suppression
  reason            String    // 'hard_bounce' | 'repeated_soft_bounce' | 'spam_complaint'
  campaignId        BigInt?   // Campaign that triggered suppression
  bounceType        String?   // e.g., 'user_unknown', 'domain_error'

  // AI decision tracking
  aiRationale       String?   // Why AI recommended suppression
  aiConfidence      Float?    // 0-1 confidence score
  aiAgent           String?   // 'optimization-agent'

  // Audit
  suppressedBy      String    // 'ai_agent' | 'manual' | 'automated_rule'

  @@index([contactId])
  @@index([suppressedAt])
  @@index([campaignId])
  @@index([reason])
}

// Extend existing CampaignSchedule model
model CampaignSchedule {
  // ... existing fields

  // New relation
  listMaintenanceLogs ListMaintenanceLog[]
}
```

### TypeScript Interfaces

```typescript
// src/list-management/types/index.ts

export interface ListMetrics {
  name: string;
  mailjetListId: number;
  subscriberCount: number;
  targetSize: number;
  variancePercent: number;

  // Performance
  bounceRate: number;
  hardBounces: number;
  softBounces: number;
  deliveryRate: number;

  // History
  lastCampaignDate: Date | null;
  bounceRateTrend: 'improving' | 'stable' | 'degrading';
  sizeTrend: 'growing' | 'stable' | 'shrinking';
  suppressionRate: number;

  // Status
  healthStatus: 'healthy' | 'needs_rebalancing' | 'needs_cleanup';
}

export interface HealthAssessment {
  status: 'healthy' | 'warning' | 'critical';
  concerns: string[];
  riskFactors: string[];
  reputationImpact: string;
  urgency: 'low' | 'medium' | 'high';
  aiRationale: string;
  confidence: number;
}

export interface RebalancingPlan {
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

export interface ContactMovement {
  action: 'keep' | 'add' | 'move';
  targetList: 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3';
  contactCount: number;
  source: 'master_list' | 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3';
  rationale: string;
}

export interface SuppressionRecommendation {
  suppressImmediately: SuppressionContact[];
  monitorClosely: SuppressionContact[];
  keepInList: SuppressionContact[];
  rationale: string;
  expectedImprovement: {
    currentBounceRate: number;
    projectedBounceRate: number;
    currentDeliveryRate: number;
    projectedDeliveryRate: number;
  };
  riskAssessment: string;
  confidence: number;
}

export interface SuppressionContact {
  contactId: number;
  email: string;
  bounceType: string;
  reason: string;
}

export interface WeeklyReport {
  summary: string;
  highlights: string[];
  actionItems: ActionItem[];
  weekOverWeek: WeekOverWeekComparison;
  recommendations: string[];
  generatedAt: Date;
  confidence: number;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  item: string;
  details?: string;
}
```

---

## Integration Layer

### Mailjet Client Extensions

```typescript
// src/integrations/mailjet.client.ts (extend existing)

export class MailJetClient {
  // ... existing methods

  /**
   * Get campaign bounces (for list maintenance)
   */
  async getCampaignBounces(campaignId: number): Promise<BounceEvent[]> {
    const response = await this.get(`/campaign/${campaignId}/messagestatistics`, {
      params: {
        ShowBounced: true,
        Limit: 10000,
      },
    });

    return response.Data.map(this.mapToBounceEvent);
  }

  /**
   * Remove multiple contacts from a list
   */
  async removeContactsFromList(
    listId: number,
    contactIds: number[]
  ): Promise<RemovalResult> {
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as string[],
    };

    // Batch removals (50 at a time to respect rate limits)
    const batches = chunk(contactIds, 50);

    for (const batch of batches) {
      try {
        await Promise.all(
          batch.map(contactId =>
            this.delete(`/listrecipient`, {
              params: {
                ContactID: contactId,
                ListID: listId,
              },
            })
          )
        );
        results.successCount += batch.length;
      } catch (error) {
        results.failedCount += batch.length;
        results.errors.push(error.message);
      }

      // Rate limiting: wait 1 second between batches
      await sleep(1000);
    }

    return results;
  }

  /**
   * Add contacts to list from master list
   */
  async backfillListFromMaster(
    targetListId: number,
    masterListId: number,
    count: number,
    skipContactIds: number[]
  ): Promise<BackfillResult> {
    // Get next N contacts from master list (FIFO order)
    const masterContacts = await this.getListContacts(masterListId, count * 2); // Get extra in case some are skipped

    // Filter out contacts already in campaign lists or suppressed
    const contactsToAdd = masterContacts
      .filter(c => !skipContactIds.includes(c.ID))
      .slice(0, count);

    // Add to target list
    const job = await this.addContactsToList(targetListId, contactsToAdd);

    return {
      jobId: job.ID,
      contactsAdded: contactsToAdd.length,
      contactIds: contactsToAdd.map(c => c.ID),
    };
  }

  private mapToBounceEvent(stat: any): BounceEvent {
    return {
      contactId: stat.ContactID,
      email: stat.ContactEmail,
      bounceType: stat.Bounce ? 'hard' : 'soft',
      reason: stat.BounceReason,
      isHardBounce: stat.Bounce,
      timestamp: new Date(stat.ArrivedAt),
    };
  }
}
```

### Redis Client for Caching

```typescript
// src/integrations/redis.client.ts

import { Redis } from 'ioredis';

export class RedisClient {
  private client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Cache list metadata
   */
  async cacheListMetadata(
    listId: number | string,
    metadata: ListMetadata
  ): Promise<void> {
    const key = `list:metadata:${listId}`;
    await this.client.set(
      key,
      JSON.stringify(metadata),
      'EX',
      3600 // 1 hour TTL
    );
  }

  /**
   * Get cached list metadata
   */
  async getListMetadata(
    listId: number | string
  ): Promise<ListMetadata | null> {
    const key = `list:metadata:${listId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Invalidate list cache (after modifications)
   */
  async invalidateListCache(listId: number | string): Promise<void> {
    const key = `list:metadata:${listId}`;
    await this.client.del(key);
  }

  /**
   * Cache list health summary
   */
  async cacheHealthSummary(summary: HealthSummary): Promise<void> {
    await this.client.set(
      'list:health:summary',
      JSON.stringify(summary),
      'EX',
      3600
    );
  }

  /**
   * Get all campaign list keys
   */
  async getAllListKeys(): Promise<string[]> {
    return this.client.keys('list:metadata:*');
  }

  /**
   * Batch get multiple list metadata
   */
  async batchGetListMetadata(
    listIds: (number | string)[]
  ): Promise<Map<string, ListMetadata>> {
    const keys = listIds.map(id => `list:metadata:${id}`);
    const values = await this.client.mget(...keys);

    const result = new Map<string, ListMetadata>();
    values.forEach((value, index) => {
      if (value) {
        result.set(String(listIds[index]), JSON.parse(value));
      }
    });

    return result;
  }
}

interface ListMetadata {
  listId: number | string;
  listName: string;
  subscriberCount: number;
  lastSynced: Date;
  recentBounceRate: number;
  averageEngagement: number;
  needsRebalancing: boolean;
  needsCleanup: boolean;
  lastCampaignId: number | null;
}

interface HealthSummary {
  masterListSize: number;
  campaignListSizes: number[];
  suppressionListSize: number;
  overallHealthStatus: 'healthy' | 'warning' | 'critical';
  lastChecked: Date;
}
```

---

## Caching Strategy

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CACHE LAYERS                            │
└─────────────────────────────────────────────────────────────┘

Application Layer
      │
      ▼
┌──────────────────────┐
│   Redis Cache        │  TTL: 1 hour
│   (L1 - Fast)        │
│                      │
│  • List metadata     │  Key: list:metadata:{id}
│  • Health summary    │  Key: list:health:summary
│  • Recent metrics    │  Key: list:metrics:{id}
└──────────┬───────────┘
           │ Cache Miss
           ▼
┌──────────────────────┐
│   Mailjet API        │  Rate Limited
│   (Source of Truth)  │
│                      │
│  • Real-time data    │
│  • Contact lists     │
│  • Campaign stats    │
└──────────────────────┘
```

### Caching Patterns

```typescript
// src/list-management/services/cache.service.ts

export class CacheService {
  constructor(
    private redis: RedisClient,
    private mailjet: MailJetClient
  ) {}

  /**
   * Get list with cache-aside pattern
   */
  async getListWithCache(listId: number): Promise<MailjetList> {
    // 1. Try cache first
    const cached = await this.redis.getListMetadata(listId);
    if (cached && this.isFresh(cached)) {
      logger.debug('Cache hit for list', { listId });
      return this.mapToMailjetList(cached);
    }

    // 2. Cache miss - fetch from Mailjet
    logger.debug('Cache miss for list', { listId });
    const list = await this.mailjet.getList(listId);

    // 3. Update cache
    await this.redis.cacheListMetadata(listId, {
      listId: list.ID,
      listName: list.Name,
      subscriberCount: list.SubscriberCount,
      lastSynced: new Date(),
      recentBounceRate: 0, // Will be updated by metrics service
      averageEngagement: 0,
      needsRebalancing: false,
      needsCleanup: false,
      lastCampaignId: null,
    });

    return list;
  }

  /**
   * Invalidate cache after list modification
   */
  async invalidateAfterModification(listIds: number[]): Promise<void> {
    await Promise.all(
      listIds.map(id => this.redis.invalidateListCache(id))
    );

    logger.info('Cache invalidated for lists', { listIds });
  }

  /**
   * Warm cache (background job - hourly)
   */
  async warmCache(): Promise<void> {
    const listIds = [5776, 'campaign_list_1', 'campaign_list_2', 'campaign_list_3', 10503500];

    await Promise.all(
      listIds.map(async id => {
        const list = await this.mailjet.getList(id);
        await this.redis.cacheListMetadata(id, this.mapToMetadata(list));
      })
    );

    logger.info('Cache warmed', { listsUpdated: listIds.length });
  }

  private isFresh(metadata: ListMetadata): boolean {
    const age = Date.now() - new Date(metadata.lastSynced).getTime();
    return age < 3600000; // 1 hour
  }
}
```

### Cache Invalidation Strategy

```typescript
// When to invalidate cache

const CACHE_INVALIDATION_TRIGGERS = {
  // Immediate invalidation
  listModification: {
    events: [
      'contacts_added',
      'contacts_removed',
      'list_rebalanced',
      'suppression_executed',
    ],
    action: 'invalidate_immediately',
  },

  // Scheduled refresh
  scheduledSync: {
    cron: '0 * * * *', // Every hour
    action: 'warm_cache',
  },

  // On-demand refresh
  campaignTrigger: {
    events: ['pre_flight_check', 'post_campaign_maintenance'],
    action: 'refresh_if_stale',
  },
};
```

---

## Technology Stack

### Dependencies

```json
{
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "axios": "^1.6.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "prisma": "^5.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0"
  }
}
```

### Environment Configuration

```bash
# .env

# Existing lifecycle environment variables
# ...

# Redis (new)
REDIS_URL=redis://localhost:6379

# List Management Configuration
LIST_MANAGEMENT_ENABLED=true
WEEKLY_HEALTH_CHECK_ENABLED=true
POST_CAMPAIGN_MAINTENANCE_ENABLED=true

# Cache Configuration
CACHE_TTL=3600
CACHE_WARM_INTERVAL=3600000

# AI Configuration (extends existing Gemini config)
GEMINI_LIST_HEALTH_TEMPERATURE=0.7
GEMINI_REBALANCING_TEMPERATURE=0.5
GEMINI_OPTIMIZATION_TEMPERATURE=0.3
GEMINI_REPORTING_TEMPERATURE=0.6
```

---

## Security Architecture

### API Security

```typescript
// Extends existing security from lifecycle system

interface ListManagementSecurity {
  authentication: {
    mailjet: 'Basic Auth (existing)';
    slack: 'Bearer Token (existing)';
    gemini: 'API Key (existing)';
    redis: 'Connection string with auth';
  };

  authorization: {
    listModification: 'System only (automated)';
    manualOverride: 'Admin role required';
    viewReports: 'Marketing team + Admin';
  };

  dataProtection: {
    contactData: 'Reference IDs only (no PII stored)';
    aiAssessments: 'Stored in database (encrypted at rest)';
    cacheData: 'Redis with auth, no sensitive PII';
  };
}
```

---

## Scalability & Performance

### Performance Optimization

```typescript
const PERFORMANCE_CONFIG = {
  aiAgents: {
    parallelExecution: true, // Run all 4 agents concurrently
    timeout: 30000, // 30 seconds per agent
    fallback: 'rule_based_decision', // If AI times out
  },

  caching: {
    strategy: 'cache_aside',
    ttl: 3600, // 1 hour
    warmupInterval: 3600000, // Hourly background refresh
    hitRateTarget: 0.80, // 80% cache hit rate
  },

  mailjetAPI: {
    rateLimit: 50, // requests per second
    batchSize: 50, // contacts per batch operation
    retryStrategy: 'exponential_backoff',
  },

  database: {
    connectionPool: 10,
    queryTimeout: 10000, // 10 seconds
    batchInserts: true,
  },
};
```

### Horizontal Scaling

```typescript
const SCALING_STRATEGY = {
  // List management runs on same Heroku dynos as lifecycle
  dynos: {
    web: 'Shares with lifecycle web dyno',
    worker: 'Shares with lifecycle worker dyno',
  },

  // Independent scaling triggers
  triggers: {
    weeklyHealthCheck: 'Single execution (Monday 10 AM)',
    postCampaignMaintenance: '3 concurrent (Tue/Thu/Tue)',
    preCampaignValidation: 'Integrated with pre-flight',
  },

  // Resource allocation
  resources: {
    memory: '512MB per workflow',
    cpu: 'Burst during AI agent execution',
    redis: 'Shared instance (mini plan sufficient)',
  },
};
```

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [Campaign Lifecycle Architecture](../lifecycle/02_architecture.md) - Existing system architecture
- [Gemini AI Documentation](https://ai.google.dev/docs) - AI API reference
- [Prisma Documentation](https://www.prisma.io/docs) - ORM reference
- [Redis Documentation](https://redis.io/docs) - Caching reference

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Complete
