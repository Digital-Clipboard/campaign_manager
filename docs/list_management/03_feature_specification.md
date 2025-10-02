# List Management Feature Specification

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Complete
- **Purpose**: Complete feature specification for AI-driven list management system

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [List Hierarchy & Management](#list-hierarchy--management)
3. [AI Agent Specifications](#ai-agent-specifications)
4. [Workflow Specifications](#workflow-specifications)
5. [Slack Notification Formats](#slack-notification-formats)
6. [Configuration & Settings](#configuration--settings)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## Feature Overview

### Core Features

**F1: Post-Campaign List Maintenance**
- Automated execution 24 hours after campaign completion
- AI analyzes bounce data and recommends suppressions
- Executes suppression and rebalancing with full audit trail
- Sends detailed Slack report with AI assessments

**F2: Weekly List Health Check**
- Runs every Monday at 10:00 AM UTC
- Syncs all lists from Mailjet and updates Redis cache
- AI analyzes health of all 3 campaign lists
- Generates executive-level weekly report
- Alerts on critical issues

**F3: Pre-Campaign List Validation**
- Integrated into existing Stage 2 pre-flight checks
- Validates list size, suppression status, cache freshness
- AI assesses list health and flags concerns
- Included in pre-flight notification

**F4: Redis Caching Layer**
- 1-hour TTL for list metadata
- Cache-aside pattern with automatic invalidation
- Hourly background sync to keep cache warm
- Reduces Mailjet API calls by 80%+

**F5: Complete Audit Trail**
- Every AI decision logged with rationale and confidence
- Before/after states captured for all modifications
- Contact-level suppression history
- Weekly health check snapshots

---

## List Hierarchy & Management

### Master User List

**List Details:**
```
Name: "users"
Mailjet ID: 5776
Purpose: Source of truth for all registered platform users
Size: ~3,500+ (growing with new registrations)
Management: Never delete, only add
```

**Characteristics:**
- ✅ Contains all registered users
- ✅ Excludes unsubscribed users (managed by Mailjet)
- ✅ Grows continuously with new registrations
- ✅ Used to backfill campaign lists after cleanup
- ❌ Never modified directly by list management system

**Access Pattern:**
```typescript
// Read-only access for backfilling
const masterList = await mailjet.getList(5776);
const nextContacts = await mailjet.getListContacts(5776, 100, {
  offset: lastProcessedContactId,
  sort: 'ContactID ASC' // FIFO order
});
```

---

### Campaign Lists (The Three Lists)

**List 1: campaign_list_1**
```
Name: "campaign_list_1"
Mailjet ID: TBD (created during implementation)
Purpose: Tuesday campaign sends
Target Size: Math.ceil(totalActive / 3)
Send Schedule: Tuesday 9:00 AM UTC
```

**List 2: campaign_list_2**
```
Name: "campaign_list_2"
Mailjet ID: TBD
Purpose: Thursday campaign sends
Target Size: Math.ceil(totalActive / 3)
Send Schedule: Thursday 9:00 AM UTC
```

**List 3: campaign_list_3**
```
Name: "campaign_list_3"
Mailjet ID: TBD
Purpose: Next Tuesday campaign sends
Target Size: Math.ceil(totalActive / 3)
Send Schedule: Following Tuesday 9:00 AM UTC
```

**Management Rules:**
- ✅ Automatically rebalanced after each campaign
- ✅ Maintained within ±5% of target size
- ✅ FIFO ordering preserved during rebalancing
- ✅ Contacts removed when added to suppression list
- ✅ Backfilled from master list as needed

**Example Distribution:**
```
Total Active Users: 3,119 (after suppression)
Target per List: Math.ceil(3119 / 3) = 1,040

Actual Distribution:
- campaign_list_1: 1,000 (96% of target - acceptable)
- campaign_list_2: 1,040 (100% of target - perfect)
- campaign_list_3: 1,079 (104% of target - acceptable)

Standard Deviation: 32.6 (target: < 50) ✅
```

---

### Suppression List

**List Details:**
```
Name: "suppressed_contacts"
Mailjet ID: 10503500
Purpose: Permanently exclude invalid/problematic contacts
Size: Growing (one-way additions)
Management: Add only, never remove (without manual review)
```

**Inclusion Criteria:**
```typescript
const SUPPRESSION_CRITERIA = {
  hardBounces: {
    user_unknown: 'Suppress immediately',
    domain_error: 'Suppress immediately',
    mailbox_inactive: 'Suppress immediately',
    mailbox_full: 'Suppress immediately',
  },

  softBounces: {
    threshold: '3+ bounces across 3 campaigns',
    action: 'Suppress after 3rd occurrence',
  },

  other: {
    spam_complaints: 'Suppress immediately',
    unsubscribes: 'Managed by Mailjet (automatic)',
  },
};
```

**Exclusion Criteria (Never Suppress):**
```typescript
const NEVER_SUPPRESS = {
  singleSoftBounce: true, // One-time soft bounces are temporary
  greylisting: true, // Normal ISP anti-spam behavior
  lowEngagement: true, // Don't suppress based on opens/clicks
  inactivity: true, // Don't suppress inactive users
};
```

**Access Pattern:**
```typescript
// Check if contact is suppressed
const suppressedList = await mailjet.getListContacts(10503500, 10000);
const suppressedIds = new Set(suppressedList.map(c => c.ID));
const isSuppressed = suppressedIds.has(contactId);

// Add to suppression list
await mailjet.addContactsToList(10503500, [
  { Email: 'bounced@example.com', ContactID: 12345 }
]);
```

---

## AI Agent Specifications

### Agent 1: List Health Agent

**Purpose:** Analyze list health and identify issues

**Input:**
```typescript
interface ListHealthInput {
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
```

**Prompt Template:**
```
Analyze the health of this email campaign list:

LIST DETAILS:
- List Name: {name}
- Total Contacts: {subscriberCount}
- Target Size: {targetSize}
- Variance: {variance} ({variancePercent}%)

RECENT CAMPAIGN PERFORMANCE:
- Last Campaign: {lastCampaignDate}
- Bounce Rate: {bounceRate}%
- Hard Bounces: {hardBounces}
- Soft Bounces: {softBounces}
- Delivery Rate: {deliveryRate}%

HISTORICAL TRENDS:
- Bounce Rate Trend: {bounceRateTrend} (last 3 campaigns)
- List Size Trend: {sizeTrend}
- Suppression Rate: {suppressionRate}%

INDUSTRY BENCHMARKS:
- Excellent: < 2% bounce rate, > 98% delivery
- Good: 2-5% bounce rate, 95-98% delivery
- Concerning: 5-10% bounce rate, 90-95% delivery
- Poor: > 10% bounce rate, < 90% delivery

Provide:
1. Overall health status (healthy/warning/critical)
2. Key concerns and risk factors
3. Comparison to industry benchmarks
4. Sender reputation impact assessment
5. Urgency level for maintenance (low/medium/high)

Format as JSON:
{
  "concerns": ["concern1", "concern2"],
  "riskFactors": ["risk1", "risk2"],
  "reputationImpact": "description",
  "urgency": "low|medium|high"
}
```

**Output:**
```typescript
interface HealthAssessment {
  status: 'healthy' | 'warning' | 'critical';
  concerns: string[];
  riskFactors: string[];
  reputationImpact: string;
  urgency: 'low' | 'medium' | 'high';
  aiRationale: string;
  confidence: number; // 0-1
}
```

**Example Output:**
```json
{
  "status": "warning",
  "concerns": [
    "High hard bounce rate (24.5%) exceeds healthy threshold (2%)",
    "List undersized by 58 contacts (-4.9% vs target)"
  ],
  "riskFactors": [
    "Sender reputation at risk due to sustained high bounce rate",
    "List degradation trend over last 3 campaigns (+2.3% bounce rate)"
  ],
  "reputationImpact": "Current bounce rate (24.5%) significantly damages sender reputation. ISPs may start filtering future emails. Immediate cleanup recommended.",
  "urgency": "high",
  "aiRationale": "The bounce rate of 24.5% is more than 10x the healthy threshold...",
  "confidence": 0.92
}
```

---

### Agent 2: Rebalancing Agent

**Purpose:** Determine optimal redistribution of contacts across lists

**Input:**
```typescript
interface RebalancingInput {
  lists: CampaignList[];
  suppressedContacts: number[];
  totalActive: number;
  targetPerList: number;
}

interface CampaignList {
  name: string;
  mailjetListId: number;
  subscriberCount: number;
}
```

**Prompt Template:**
```
Create an optimal rebalancing plan for three campaign lists:

CURRENT STATE:
- campaign_list_1: {list1Count} contacts
- campaign_list_2: {list2Count} contacts
- campaign_list_3: {list3Count} contacts
- Total Active: {totalActive} (after suppressing {suppressedCount})

TARGET STATE:
- Each list: {targetPerList} contacts (±5% acceptable = ±{tolerance})
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

Format as JSON with specific movement instructions.
```

**Output:**
```typescript
interface RebalancingPlan {
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

interface ContactMovement {
  action: 'keep' | 'add' | 'move';
  targetList: 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3';
  contactCount: number;
  source: 'master_list' | 'campaign_list_1' | 'campaign_list_2' | 'campaign_list_3';
  rationale: string;
}
```

**Example Output:**
```json
{
  "targetDistribution": {
    "list1": 1000,
    "list2": 1040,
    "list3": 1040
  },
  "movements": [
    {
      "action": "keep",
      "targetList": "campaign_list_1",
      "contactCount": 1000,
      "source": "campaign_list_1",
      "rationale": "Already within tolerance (96% of target), no changes needed"
    },
    {
      "action": "add",
      "targetList": "campaign_list_2",
      "contactCount": 98,
      "source": "master_list",
      "rationale": "Backfill from next sequential users in master list to reach target"
    },
    {
      "action": "move",
      "targetList": "campaign_list_2",
      "contactCount": 137,
      "source": "campaign_list_3",
      "rationale": "Move newest users from list_3 to balance both lists"
    }
  ],
  "rationale": "Minimize disruption by keeping list_1 unchanged...",
  "expectedImpact": "Improved balance with std dev of 18.9 (from 98)",
  "alternativesConsidered": [
    "Equal split from scratch - rejected: would disrupt all lists unnecessarily",
    "Add only to list_2 - rejected: would leave lists unbalanced"
  ],
  "confidence": 0.90
}
```

---

### Agent 3: Optimization Agent

**Purpose:** Identify contacts to suppress based on bounce behavior

**Input:**
```typescript
interface OptimizationInput {
  bounceData: BounceEvent[];
  listHistory: ListHistory;
}

interface BounceEvent {
  contactId: number;
  email: string;
  bounceType: 'hard' | 'soft';
  reason: string; // 'user_unknown', 'domain_error', etc.
  isHardBounce: boolean;
  timestamp: Date;
}

interface ListHistory {
  repeatedSoftBouncers: number;
  firstTimeSoftBouncers: number;
  daysSinceLastClean: number;
}
```

**Prompt Template:**
```
Analyze bounce data and recommend contacts for suppression:

BOUNCE DATA:
Total Bounces: {totalBounces}

Hard Bounces: {hardBounceCount}
- Invalid emails (user_unknown): {userUnknownCount}
- Domain not found (domain_error): {domainErrorCount}
- Mailbox full/inactive: {mailboxFullCount}

Soft Bounces: {softBounceCount}
- Temporary failures: {temporaryCount}
- Greylisting: {greylistCount}

HISTORICAL CONTEXT:
- Contacts with 3+ soft bounces: {repeatedSoftBouncers}
- First-time soft bouncers: {firstTimeSoftBouncers}
- Days since last cleanup: {daysSinceLastClean}

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

Include contact IDs in each category.
```

**Output:**
```typescript
interface SuppressionRecommendation {
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

interface SuppressionContact {
  contactId: number;
  email: string;
  bounceType: string;
  reason: string;
}
```

**Example Output:**
```json
{
  "suppressImmediately": [
    { "contactId": 12345, "email": "invalid@test.com", "bounceType": "user_unknown", "reason": "Invalid email address" },
    // ... 244 more
  ],
  "monitorClosely": [
    { "contactId": 67890, "email": "fullbox@test.com", "bounceType": "mailbox_full", "reason": "3rd soft bounce" },
    // ... 17 more
  ],
  "keepInList": [
    { "contactId": 11111, "email": "temp@test.com", "bounceType": "temporary", "reason": "First soft bounce" },
    // ... 12 more
  ],
  "rationale": "All 245 hard bounces meet industry standards for immediate suppression. These contacts will never receive emails successfully. Suppression improves sender reputation and delivery rates.",
  "expectedImprovement": {
    "currentBounceRate": 25.8,
    "projectedBounceRate": 1.3,
    "currentDeliveryRate": 74.2,
    "projectedDeliveryRate": 98.7
  },
  "riskAssessment": "Low risk: All suppression decisions follow industry standards. No false positives expected for hard bounces.",
  "confidence": 0.95
}
```

---

### Agent 4: Reporting Agent

**Purpose:** Generate executive-level reports

**Input (Weekly Report):**
```typescript
interface WeeklyReportInput {
  listsData: ListMetrics[];
  recentActivity: {
    campaignsSent: number;
    contactsSuppressed: number;
    rebalancingEvents: number;
    issuesDetected: number;
    newContacts: number;
    suppressionRate: number;
  };
}
```

**Prompt Template (Weekly Report):**
```
Generate an executive-level weekly list health report:

LIST STATUS:
{foreach list}
{list.name}:
  - Size: {list.subscriberCount} (target: {list.targetSize})
  - Bounce Rate: {list.recentBounceRate}%
  - Last Campaign: {list.lastCampaignDate}
  - Health: {list.healthStatus}
{endforeach}

RECENT ACTIVITY (Last 7 Days):
- Campaigns sent: {campaignsSent}
- Contacts suppressed: {contactsSuppressed}
- Lists rebalanced: {rebalancingEvents}
- Issues detected: {issuesDetected}
- New contacts added: +{newContacts}
- Suppression rate: {suppressionRate}%

TRENDS:
- Bounce rate trend: {bounceRateTrend}
- List growth: +{newContacts} contacts
- Suppression rate: {suppressionRate}%

Provide:
1. Executive summary (2-3 sentences - high level overview)
2. Key highlights (3-5 positive developments)
3. Action items (prioritized issues requiring attention)
4. Week-over-week comparison (key metrics)
5. Recommendations for next week

Keep language professional, concise, and actionable.
Focus on business impact, not technical details.
```

**Output:**
```typescript
interface WeeklyReport {
  summary: string;
  highlights: string[];
  actionItems: ActionItem[];
  weekOverWeek: WeekOverWeekComparison;
  recommendations: string[];
  generatedAt: Date;
  confidence: number;
}

interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  item: string;
  details?: string;
}

interface WeekOverWeekComparison {
  bounceRate: { current: number; previous: number; change: number };
  activeContacts: { current: number; previous: number; change: number };
  listBalance: { current: number; previous: number; improvement: boolean };
  campaignsSent: number;
}
```

---

## Workflow Specifications

### Workflow 1: Post-Campaign Maintenance

**Trigger:** 24 hours after Stage 5 wrap-up completes (T+24h)

**Trigger Mechanism:**
```typescript
// In lifecycle Stage 5 wrap-up service
async function generatePostLaunchWrapup(schedule: CampaignSchedule) {
  // ... existing wrap-up logic

  // Schedule list maintenance for T+24 hours
  await scheduleJob(
    'list-maintenance',
    addHours(new Date(), 24),
    async () => {
      await listManagementOrchestrator.executePostCampaignMaintenance(schedule);
    }
  );
}
```

**Execution Steps:**

**Step 1: Fetch Bounce Data**
```typescript
const bounceData = await mailjet.getCampaignBounces(schedule.mailjetCampaignId);
// Returns: BounceEvent[] with contact IDs, emails, bounce types, reasons
```

**Step 2: AI Analysis (Optimization Agent)**
```typescript
const suppressionPlan = await optimizationAgent.identifyContactsToSuppress(
  bounceData,
  listHistory
);
// Returns: SuppressionRecommendation with contacts categorized and AI rationale
```

**Step 3: Execute Suppression**
```typescript
const results = await suppressContacts(suppressionPlan.suppressImmediately, {
  reason: 'hard_bounce',
  campaignId: schedule.mailjetCampaignId,
  aiAssessment: suppressionPlan.rationale,
});
// Adds contacts to suppression list and records in database
```

**Step 4: Remove from Campaign Lists**
```typescript
await Promise.all([
  removeContactsFromList('campaign_list_1', contactIds),
  removeContactsFromList('campaign_list_2', contactIds),
  removeContactsFromList('campaign_list_3', contactIds),
]);
```

**Step 5: AI Rebalancing Plan**
```typescript
const rebalancingPlan = await rebalancingAgent.generateRebalancingPlan(
  campaignLists,
  suppressedContactIds
);
// Returns: RebalancingPlan with target distribution and specific movements
```

**Step 6: Execute Rebalancing**
```typescript
const rebalancingResults = await executeRebalancing(rebalancingPlan);
// Moves contacts between lists or backfills from master list
```

**Step 7: Update Redis Cache**
```typescript
await updateListMetadataCache(campaignLists);
// Invalidates old cache and stores new metadata with 1-hour TTL
```

**Step 8: Log to Database**
```typescript
await database.listMaintenanceLog.create({
  data: {
    campaignScheduleId: schedule.id,
    bounceAnalysis: bounceData,
    suppressionPlan,
    suppressionResults,
    rebalancingPlan,
    rebalancingResults,
    aiAssessments: {
      optimization: suppressionPlan.rationale,
      rebalancing: rebalancingPlan.rationale,
    },
    beforeState: { /* list sizes before */ },
    afterState: { /* list sizes after */ },
  },
});
```

**Step 9: Send Slack Report**
```typescript
await slackClient.postMessage({
  channel: '#_traction',
  blocks: formatMaintenanceReport({
    campaign: schedule,
    suppression: suppressionResults,
    rebalancing: rebalancingResults,
    aiAssessments,
  }),
});
```

**Success Criteria:**
- ✅ All hard bounces suppressed
- ✅ Lists rebalanced within ±5% of target
- ✅ Complete audit trail logged
- ✅ Slack notification sent
- ✅ Redis cache updated

**Failure Handling:**
- Partial suppression accepted (log failures)
- Rebalancing rollback on critical failure
- Slack alert sent even if workflow fails
- Manual review queue for failed operations

---

### Workflow 2: Weekly Health Check

**Trigger:** Every Monday at 10:00 AM UTC

**Cron Expression:** `0 10 * * 1`

**Execution Steps:**

**Step 1: Sync All Lists**
```typescript
const [masterList, campaignLists, suppressionList] = await Promise.all([
  mailjet.getList(5776),
  Promise.all([
    mailjet.getList('campaign_list_1'),
    mailjet.getList('campaign_list_2'),
    mailjet.getList('campaign_list_3'),
  ]),
  mailjet.getList(10503500),
]);
```

**Step 2: Update Redis Cache**
```typescript
await Promise.all([
  redis.cacheListMetadata(5776, masterListMetadata),
  redis.cacheListMetadata('campaign_list_1', list1Metadata),
  redis.cacheListMetadata('campaign_list_2', list2Metadata),
  redis.cacheListMetadata('campaign_list_3', list3Metadata),
  redis.cacheListMetadata(10503500, suppressionMetadata),
]);
```

**Step 3: Fetch Recent Campaigns**
```typescript
const recentCampaigns = await database.campaignSchedule.findMany({
  where: { scheduledDate: { gte: subDays(new Date(), 7) } },
  include: { metrics: true },
});
```

**Step 4: Calculate List Metrics**
```typescript
const listMetrics = campaignLists.map(list => ({
  name: list.Name,
  subscriberCount: list.SubscriberCount,
  targetSize: Math.ceil(masterList.SubscriberCount / 3),
  recentBounceRate: calculateAverageBounceRate(list, recentCampaigns),
  // ... other metrics
}));
```

**Step 5: AI Health Analysis (Parallel)**
```typescript
const healthAssessments = await Promise.all(
  listMetrics.map(metrics => listHealthAgent.analyze(metrics))
);
// 3 agents run in parallel, total time ≈ 5-10 seconds
```

**Step 6: Generate Weekly Report**
```typescript
const weeklyReport = await reportingAgent.generateWeeklyReport(
  listMetrics,
  recentActivity
);
```

**Step 7: Check Critical Issues**
```typescript
const criticalIssues = healthAssessments.filter(a => a.urgency === 'high');
if (criticalIssues.length > 0) {
  await slackClient.postMessage({
    channel: '#_traction',
    text: '🚨 CRITICAL: List health issues detected',
    blocks: formatCriticalAlert(criticalIssues),
  });
}
```

**Step 8: Send Weekly Report**
```typescript
await slackClient.postMessage({
  channel: '#_traction',
  blocks: formatWeeklyHealthReport(weeklyReport, healthAssessments),
});
```

**Step 9: Log to Database**
```typescript
await database.listHealthCheck.create({
  data: {
    executedAt: new Date(),
    masterListSize: masterList.SubscriberCount,
    campaignListSizes: campaignLists.map(l => l.SubscriberCount),
    suppressionListSize: suppressionList.SubscriberCount,
    healthAssessments,
    weeklyReport,
    criticalIssues: criticalIssues.length,
  },
});
```

**Success Criteria:**
- ✅ All 5 lists synced from Mailjet
- ✅ Redis cache updated (all keys)
- ✅ 3 health assessments generated
- ✅ Weekly report sent to Slack
- ✅ Database snapshot created

---

### Workflow 3: Pre-Campaign Validation

**Trigger:** During Stage 2 pre-flight checks (T-3.25h)

**Integration Point:**
```typescript
// In lifecycle pre-flight service
async function runPreFlightChecks(schedule: CampaignSchedule) {
  const checks = {
    listVerification: await verifyList(schedule.listId, schedule.recipientCount),
    listHealthValidation: await validateListForCampaign(schedule), // NEW
    campaignSetup: await verifyCampaignSetup(schedule.mailjetDraftId),
    technicalValidation: await runTechnicalValidation(schedule.mailjetDraftId),
  };

  const overallStatus = determineOverallStatus(checks);

  // Include list health in pre-flight notification
  await sendPreFlightNotification(schedule, checks);
}
```

**Validation Steps:**

**Check 1: List Size Match**
```typescript
const list = await mailjet.getList(schedule.listId);
const discrepancy = Math.abs(list.SubscriberCount - schedule.recipientCount);

if (discrepancy > 10) {
  validation.issues.push({
    severity: 'warning',
    message: `List size mismatch: expected ${schedule.recipientCount}, found ${list.SubscriberCount}`,
  });
}
```

**Check 2: No Suppressed Contacts**
```typescript
const listContacts = await mailjet.getListContacts(schedule.listId, 100);
const suppressedList = await mailjet.getListContacts(10503500, 10000);
const suppressedIds = new Set(suppressedList.map(c => c.ID));

const suppressedInList = listContacts.filter(c => suppressedIds.has(c.ID));

if (suppressedInList.length > 0) {
  validation.issues.push({
    severity: 'critical',
    message: `Found ${suppressedInList.length} suppressed contacts in campaign list`,
    action: 'Remove these contacts before launch',
  });
}
```

**Check 3: Cache Freshness**
```typescript
const cacheData = await redis.getListMetadata(schedule.listId);
if (cacheData) {
  const hoursSinceSync = (Date.now() - new Date(cacheData.lastSynced).getTime()) / 3600000;

  if (hoursSinceSync > 24) {
    validation.issues.push({
      severity: 'warning',
      message: `List cache stale (${hoursSinceSync.toFixed(1)} hours old)`,
      action: 'Consider refreshing list cache',
    });
  }
}
```

**Check 4: AI Health Assessment**
```typescript
const recentMetrics = await getRecentListMetrics(schedule.listId);
const healthAssessment = await listHealthAgent.analyze(recentMetrics);

validation.healthStatus = healthAssessment.status;
validation.aiAssessment = healthAssessment.aiRationale;

if (healthAssessment.urgency === 'high') {
  validation.issues.push({
    severity: 'warning',
    message: 'AI flagged list health concerns',
    details: healthAssessment.concerns,
    action: healthAssessment.aiRationale,
  });
}
```

**Output Format:**
```typescript
interface ListValidation {
  listExists: boolean;
  sizeMatch: boolean;
  discrepancy: number;
  issues: ValidationIssue[];
  healthStatus: 'healthy' | 'warning' | 'critical';
  aiAssessment: string;
}
```

---

## Slack Notification Formats

### Post-Campaign Maintenance Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 LIST MAINTENANCE COMPLETE: Round 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Campaign: Client Letters 2.0 - Round 2
Completed: October 1, 2025, 10:45 AM UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️  CLEANUP RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contacts Suppressed: 245
  ├─ Invalid emails: 156
  ├─ Domain errors: 67
  └─ Inactive mailboxes: 22

Removed from campaign lists: ✅ Complete
Added to suppression list: ✅ Complete

🤖 AI ASSESSMENT:
"All 245 hard bounces meet industry standards for immediate
suppression. These contacts will never receive emails successfully.
Suppression improves sender reputation and delivery rates."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️  REBALANCING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before:
  campaign_list_1: 1,000
  campaign_list_2: 942 (after suppression)
  campaign_list_3: 1,177

After:
  campaign_list_1: 1,000 (no change)
  campaign_list_2: 1,040 (+98 from master)
  campaign_list_3: 1,040 (-137 moved to list_2)

Balance: Excellent (std dev: 18.9)

🤖 AI ASSESSMENT:
"Optimal rebalancing achieved with minimal disruption. List 1
unchanged, list 2 backfilled from master list, list 3 trimmed
to balance. All lists now within ±4% of target size."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Projected Improvements:
  • Bounce rate: 25.8% → 1.3% (↓ 24.5%)
  • Delivery rate: 74.2% → 98.7% (↑ 24.5%)
  • Sender reputation: ⬆️ Significant improvement

⏰ NEXT CAMPAIGN: Round 3 - Oct 2, 9:00 AM UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Slack Block Kit JSON:**
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔧 LIST MAINTENANCE COMPLETE: Round 2"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Campaign:*\nClient Letters 2.0 - Round 2" },
        { "type": "mrkdwn", "text": "*Completed:*\nOctober 1, 2025, 10:45 AM UTC" }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*🗑️  CLEANUP RESULTS*\n\n*Contacts Suppressed:* 245\n  • Invalid emails: 156\n  • Domain errors: 67\n  • Inactive mailboxes: 22\n\nRemoved from campaign lists: ✅ Complete\nAdded to suppression list: ✅ Complete"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "🤖 *AI ASSESSMENT:* All 245 hard bounces meet industry standards for immediate suppression..."
        }
      ]
    }
    // ... more blocks
  ]
}
```

---

### Weekly Health Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 WEEKLY LIST HEALTH REPORT
Week of September 29 - October 5, 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
Lists are in moderate health with high bounce rates requiring
immediate attention. Recent campaign (Round 2) revealed 258 invalid
contacts now suppressed. Rebalancing completed successfully.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HIGHLIGHTS
• Successfully suppressed 245 hard bounces from Round 2
• Rebalanced campaign_list_2 and campaign_list_3
• Master list grew by +47 new registrations
• Delivery rate improved from 74.2% to projected 98.7%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ACTION ITEMS
1. 🔴 HIGH: Monitor 18 contacts with repeated soft bounces
2. 🟡 MEDIUM: campaign_list_3 ready for Round 3 (Oct 2)
3. 🟢 LOW: Consider re-validation service for entire master list

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 WEEK-OVER-WEEK
• Bounce rate: 25.8% → 1.3% (↓ 24.5% - major improvement)
• Active contacts: 3,529 → 3,284 (↓ 245 suppressed)
• List balance: Improved (std dev: 98 → 18.9)
• Campaigns sent: 1 (Round 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 RECOMMENDATIONS FOR NEXT WEEK
1. Send Round 3 campaign Thursday with cleaned lists
2. Schedule full master list re-validation (3rd party service)
3. Implement automated soft bounce threshold alerts
4. Continue monitoring weekly health metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Critical Issue Alert

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: List Health Issues Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1 CRITICAL ISSUE FOUND

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CAMPAIGN_LIST_2: CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Urgency: HIGH
Status: Critical

KEY CONCERNS:
• High hard bounce rate (24.5%) exceeds healthy threshold (2%)
• List degradation trend over last 3 campaigns (+2.3%)

REPUTATION IMPACT:
Current bounce rate significantly damages sender reputation.
ISPs may start filtering future emails.

🤖 AI RECOMMENDATION:
Execute immediate cleanup within 24 hours before next campaign.
Suppress all hard bounces and rebalance lists.

⏰ ACTION REQUIRED: Before next campaign (Oct 2, 9:00 AM UTC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Configuration & Settings

### Environment Variables

```bash
# List Management Feature Flags
LIST_MANAGEMENT_ENABLED=true
WEEKLY_HEALTH_CHECK_ENABLED=true
POST_CAMPAIGN_MAINTENANCE_ENABLED=true
PRE_CAMPAIGN_VALIDATION_ENABLED=true

# Scheduling
WEEKLY_HEALTH_CHECK_CRON="0 10 * * 1"  # Monday 10 AM UTC
POST_CAMPAIGN_DELAY_HOURS=24

# Redis Cache
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600  # 1 hour
CACHE_WARM_INTERVAL=3600000  # 1 hour in ms

# AI Configuration
GEMINI_API_KEY=your_key_here
GEMINI_LIST_HEALTH_TEMPERATURE=0.7
GEMINI_REBALANCING_TEMPERATURE=0.5
GEMINI_OPTIMIZATION_TEMPERATURE=0.3
GEMINI_REPORTING_TEMPERATURE=0.6

# List Management Rules
SUPPRESSION_SOFT_BOUNCE_THRESHOLD=3  # Suppress after 3 soft bounces
REBALANCING_TOLERANCE=0.05  # ±5% of target size
MAX_CONTACTS_TO_MOVE=200  # Per rebalancing operation

# Mailjet List IDs
MASTER_LIST_ID=5776
SUPPRESSION_LIST_ID=10503500
# Campaign list IDs created during implementation
```

### Configuration File

```typescript
// config/list-management.config.ts

export const LIST_MANAGEMENT_CONFIG = {
  workflows: {
    postCampaignMaintenance: {
      enabled: process.env.POST_CAMPAIGN_MAINTENANCE_ENABLED === 'true',
      delayHours: parseInt(process.env.POST_CAMPAIGN_DELAY_HOURS || '24'),
      retryAttempts: 3,
      retryDelay: 300000, // 5 minutes
    },

    weeklyHealthCheck: {
      enabled: process.env.WEEKLY_HEALTH_CHECK_ENABLED === 'true',
      cron: process.env.WEEKLY_HEALTH_CHECK_CRON || '0 10 * * 1',
      timezone: 'UTC',
    },

    preCampaignValidation: {
      enabled: process.env.PRE_CAMPAIGN_VALIDATION_ENABLED === 'true',
      failOnCritical: false, // Don't block campaign, just warn
      warnOnSuppressed: true,
    },
  },

  suppression: {
    hardBounces: 'immediate',
    softBounceThreshold: parseInt(process.env.SUPPRESSION_SOFT_BOUNCE_THRESHOLD || '3'),
    spamComplaints: 'immediate',
    neverSuppressGreylisting: true,
  },

  rebalancing: {
    tolerance: parseFloat(process.env.REBALANCING_TOLERANCE || '0.05'),
    maxContactsToMove: parseInt(process.env.MAX_CONTACTS_TO_MOVE || '200'),
    preserveFIFO: true,
    preferMasterBackfill: true,
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600'),
    warmInterval: parseInt(process.env.CACHE_WARM_INTERVAL || '3600000'),
    invalidateOnModification: true,
  },

  mailjet: {
    masterListId: parseInt(process.env.MASTER_LIST_ID || '5776'),
    suppressionListId: parseInt(process.env.SUPPRESSION_LIST_ID || '10503500'),
    rateLimitPerSecond: 50,
    batchSize: 50,
  },

  ai: {
    model: 'gemini-2.0-flash-exp',
    timeout: 30000,
    temperatures: {
      listHealth: parseFloat(process.env.GEMINI_LIST_HEALTH_TEMPERATURE || '0.7'),
      rebalancing: parseFloat(process.env.GEMINI_REBALANCING_TEMPERATURE || '0.5'),
      optimization: parseFloat(process.env.GEMINI_OPTIMIZATION_TEMPERATURE || '0.3'),
      reporting: parseFloat(process.env.GEMINI_REPORTING_TEMPERATURE || '0.6'),
    },
  },
};
```

---

## Error Handling & Recovery

### Error Types & Strategies

```typescript
interface ErrorHandlingStrategy {
  mailjetApiFailure: {
    retry: 3;
    backoff: 'exponential'; // 1s, 2s, 4s
    fallback: 'use_cached_data';
    alert: true;
    severity: 'high';
  };

  aiAgentTimeout: {
    timeout: 30000; // 30 seconds
    fallback: 'rule_based_decision';
    alert: false; // Just log
    severity: 'medium';
  };

  rebalancingFailure: {
    retry: 2;
    rollback: true; // Revert changes
    alert: true;
    manualReview: true;
    severity: 'high';
  };

  suppressionFailure: {
    retry: 3;
    partialSuccess: 'acceptable'; // Continue with what succeeded
    alert: true;
    queueForRetry: true;
    severity: 'medium';
  };

  redisConnectionFailure: {
    retry: 3;
    fallback: 'direct_mailjet_api';
    alert: true;
    severity: 'medium';
  };

  databaseWriteFailure: {
    retry: 3;
    criticalIfFails: true; // Must succeed for audit trail
    alert: true;
    severity: 'critical';
  };
}
```

### Rollback Procedures

```typescript
// Rebalancing rollback
async function rollbackRebalancing(
  beforeState: ListState,
  attemptedChanges: ContactMovement[]
): Promise<RollbackResult> {
  logger.warn('Initiating rebalancing rollback', {
    beforeState,
    attemptedChanges,
  });

  try {
    // Restore each list to before state
    await Promise.all([
      restoreListToState('campaign_list_1', beforeState.list1),
      restoreListToState('campaign_list_2', beforeState.list2),
      restoreListToState('campaign_list_3', beforeState.list3),
    ]);

    // Verify rollback success
    const currentState = await getCurrentListState();
    const rollbackSuccessful = compareStates(currentState, beforeState);

    if (rollbackSuccessful) {
      logger.info('Rollback successful');
      return { success: true, state: currentState };
    } else {
      logger.error('Rollback failed - manual intervention required');
      await alertTeam('CRITICAL: Rollback failed', {
        beforeState,
        currentState,
        attemptedChanges,
      });
      return { success: false, requiresManualFix: true };
    }
  } catch (error) {
    logger.error('Rollback exception', { error });
    await alertTeam('CRITICAL: Rollback exception', { error });
    throw error;
  }
}
```

---

## Monitoring & Alerts

### Success Metrics

```typescript
interface ListManagementMetrics {
  // Operational
  maintenanceExecutionTime: number; // ms
  weeklyCheckExecutionTime: number; // ms
  cacheHitRate: number; // 0-1
  aiAgentSuccessRate: number; // 0-1

  // Quality
  bounceRateImprovement: number; // % reduction
  listBalanceScore: number; // std deviation
  automationSuccessRate: number; // 0-1
  falseSuppressionRate: number; // 0-1

  // AI Performance
  aiConfidenceAverage: number; // 0-1
  aiResponseTime: number; // ms
  aiTimeoutRate: number; // 0-1
}
```

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  critical: {
    bounceRate: 0.10, // 10%+
    aiTimeout: 3, // 3+ consecutive timeouts
    rebalancingFailure: 1, // Any failure
    suppressionFailure: 0.05, // 5%+ failure rate
    databaseWriteFailure: 1, // Any failure
  },

  warning: {
    bounceRate: 0.05, // 5-10%
    listImbalance: 0.10, // ±10% from target
    cacheHitRate: 0.70, // < 70%
    aiConfidence: 0.75, // < 75% average
  },

  info: {
    maintenanceComplete: true,
    weeklyCheckComplete: true,
    listRebalanced: true,
  },
};
```

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [02_architecture.md](./02_architecture.md) - Technical architecture
- [Campaign Lifecycle Feature Spec](../lifecycle/03_feature_specification.md) - Existing lifecycle features

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Complete
