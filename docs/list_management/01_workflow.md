# List Management Workflows & Diagrams

## Document Information

- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Complete
- **Purpose**: Visual workflows and sequence diagrams for AI-driven list management

---

## Table of Contents

1. [Complete System Flow](#complete-system-flow)
2. [Workflow 1: Post-Campaign Maintenance](#workflow-1-post-campaign-maintenance)
3. [Workflow 2: Weekly Health Check](#workflow-2-weekly-health-check)
4. [Workflow 3: Pre-Campaign Validation](#workflow-3-pre-campaign-validation)
5. [AI Agent Orchestration](#ai-agent-orchestration)
6. [State Machine](#state-machine)
7. [Error Handling Flows](#error-handling-flows)

---

## Complete System Flow

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     CAMPAIGN LIFECYCLE                        │
│  (Existing 5-stage system)                                    │
└───────────────────────┬──────────────────────────────────────┘
                        │
                Stage 5: Wrap-Up (T+30min)
                        │
                        ↓
        ┌───────────────────────────────┐
        │  Schedule Stage 6 (T+24h)     │
        └───────────────┬───────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────────┐
│              STAGE 6: LIST MAINTENANCE (T+24h)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. Fetch bounce data from Mailjet                     │  │
│  │  2. AI analyzes → suppression plan                     │  │
│  │  3. Execute suppression                                │  │
│  │  4. Remove from campaign lists                         │  │
│  │  5. AI generates → rebalancing plan                    │  │
│  │  6. Execute rebalancing                                │  │
│  │  7. Update Redis cache                                 │  │
│  │  8. Log to database                                    │  │
│  │  9. Send Slack report                                  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                        │
                        ↓
              Campaign Lists Updated
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
  campaign_list_1  campaign_list_2  campaign_list_3
    (Balanced)       (Balanced)       (Balanced)
        │               │               │
        └───────────────┴───────────────┘
                        │
                        ▼
            Ready for next campaign
```

### Weekly Health Check (Parallel)

```
Every Monday 10 AM UTC
        │
        ↓
┌──────────────────────────────────────────┐
│   WEEKLY LIST HEALTH CHECK               │
│  ┌────────────────────────────────────┐  │
│  │  1. Sync all lists from Mailjet    │  │
│  │  2. Update Redis cache             │  │
│  │  3. Calculate list metrics         │  │
│  │  4. AI analyzes each list          │  │
│  │  5. Generate weekly report         │  │
│  │  6. Check for critical issues      │  │
│  │  7. Send Slack notification        │  │
│  │  8. Log to database                │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## Workflow 1: Post-Campaign Maintenance

### Sequence Diagram

```
Scheduler  MaintenanceService  MailJet  OptimizationAgent  Rebalancing Agent  Database  Slack  Redis
   │              │               │            │                   │             │       │      │
   │ T+24h        │               │            │                   │             │       │      │
   ├─────────────>│               │            │                   │             │       │      │
   │  trigger     │               │            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 1: Fetch bounce data  │                   │             │       │      │
   │              ├──────────────>│            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │<──────────────┤            │                   │             │       │      │
   │              │  BounceData[] │            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 2: AI analyzes bounces│                   │             │       │      │
   │              ├───────────────────────────>│                   │             │       │      │
   │              │  analyze(bounceData)       │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │<───────────────────────────┤                   │             │       │      │
   │              │  SuppressionPlan           │                   │             │       │      │
   │              │  + AI rationale            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 3: Execute suppression│                   │             │       │      │
   │              ├──────────────>│            │                   │             │       │      │
   │              │  suppress()   │            │                   │             │       │      │
   │              │<──────────────┤            │                   │             │       │      │
   │              │  Results      │            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 4: Remove from lists  │                   │             │       │      │
   │              ├──────────────>│            │                   │             │       │      │
   │              │  removeContacts()          │                   │             │       │      │
   │              │<──────────────┤            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 5: AI generates rebalancing plan          │             │       │      │
   │              ├────────────────────────────────────────────────>│             │       │      │
   │              │  generateRebalancingPlan()                     │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │<────────────────────────────────────────────────┤             │       │      │
   │              │  RebalancingPlan + AI rationale                │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 6: Execute rebalancing│                   │             │       │      │
   │              ├──────────────>│            │                   │             │       │      │
   │              │  moveContacts()│           │                   │             │       │      │
   │              │<──────────────┤            │                   │             │       │      │
   │              │  Results      │            │                   │             │       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 7: Update Redis cache │                   │             │       │      │
   │              ├──────────────────────────────────────────────────────────────────────────>│
   │              │  set(metadata)             │                   │             │       │      │
   │              │<──────────────────────────────────────────────────────────────────────────┤
   │              │               │            │                   │             │       │      │
   │              │ Step 8: Log to database    │                   │             │       │      │
   │              ├─────────────────────────────────────────────────────────────>│       │      │
   │              │  create(MaintenanceLog)    │                   │             │       │      │
   │              │<─────────────────────────────────────────────────────────────┤       │      │
   │              │               │            │                   │             │       │      │
   │              │ Step 9: Send Slack report  │                   │             │       │      │
   │              ├──────────────────────────────────────────────────────────────────────>│      │
   │              │  postMessage()             │                   │             │       │      │
   │              │<──────────────────────────────────────────────────────────────────────┤      │
   │<─────────────┤               │            │                   │             │       │      │
   │  complete    │               │            │                   │             │       │      │
```

### Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│           START: Post-Campaign Maintenance (T+24h)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Get CampaignSchedule      │
            │  from trigger              │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 1: Fetch Bounce Data │
            │  mailjet.getCampaignBounces│
            │  (mailjetCampaignId)       │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Bounce data collected│
            │  - Total bounces           │
            │  - Hard bounces            │
            │  - Soft bounces            │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 2: AI Analysis (OptimizationAgent)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Input:                                              │  │
│  │  • bounceData (BounceEvent[])                        │  │
│  │  • listHistory (past performance)                    │  │
│  │                                                      │  │
│  │  AI Prompt:                                          │  │
│  │  "Analyze bounce data and recommend contacts for     │  │
│  │   suppression based on industry best practices..."   │  │
│  │                                                      │  │
│  │  Output:                                             │  │
│  │  • suppressImmediately (hard bounces)                │  │
│  │  • monitorClosely (repeated soft bounces)            │  │
│  │  • keepInList (temporary issues)                     │  │
│  │  • rationale (AI explanation)                        │  │
│  │  • expectedImprovement (delivery rate ↑)             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: AI suppression plan  │
            │  generated                 │
            │  - To suppress: N contacts │
            │  - To monitor: M contacts  │
            │  - AI rationale            │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 3: Execute Suppression│
            │  suppressContacts()        │
            │  - Add to suppression list │
            │  - Store AI rationale      │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Contacts suppressed  │
            │  - Success: N              │
            │  - Failed: M               │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 4: Remove from Lists │
            │  Promise.all([             │
            │    removeFrom(list_1),     │
            │    removeFrom(list_2),     │
            │    removeFrom(list_3)      │
            │  ])                        │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 5: AI Rebalancing Plan (RebalancingAgent)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Input:                                              │  │
│  │  • campaignLists (current sizes)                     │  │
│  │  • suppressedContacts (removed)                      │  │
│  │                                                      │  │
│  │  AI Prompt:                                          │  │
│  │  "Create optimal rebalancing plan for 3 lists.       │  │
│  │   Minimize contact movement, preserve FIFO..."       │  │
│  │                                                      │  │
│  │  Output:                                             │  │
│  │  • targetDistribution (per list)                     │  │
│  │  • movements (which contacts to move)                │  │
│  │  • rationale (AI explanation)                        │  │
│  │  • expectedImpact (balance improvement)              │  │
│  │  • alternativesConsidered                            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Rebalancing plan     │
            │  generated                 │
            │  - Target distribution     │
            │  - Movements: N contacts   │
            │  - AI rationale            │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 6: Execute Rebalancing│
            │  executeRebalancing()      │
            │  - Move contacts between   │
            │    lists as planned        │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Rebalancing complete │
            │  - Lists updated: 3        │
            │  - Contacts moved: N       │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 7: Update Redis Cache│
            │  updateListMetadataCache() │
            │  - Invalidate old cache    │
            │  - Store new metadata      │
            │  - TTL: 1 hour             │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 8: Log to Database   │
            │  create(MaintenanceLog)    │
            │  - Bounce analysis         │
            │  - Suppression results     │
            │  - Rebalancing results     │
            │  - AI assessments          │
            │  - Before/after states     │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 9: Generate & Send Slack Report (ReportingAgent)     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Report Contents:                                    │  │
│  │  • Campaign details                                  │  │
│  │  • Cleanup results (N suppressed)                    │  │
│  │  • AI assessment (optimization)                      │  │
│  │  • Rebalancing results (before/after)                │  │
│  │  • AI assessment (rebalancing)                       │  │
│  │  • Impact (projected improvements)                   │  │
│  │  • Next campaign timing                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Send to #_traction channel│
            │  slackClient.postMessage() │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Post-campaign        │
            │  maintenance completed     │
            │  - Duration: T ms          │
            │  - Maintenance log ID: N   │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  END: Lists cleaned        │
            │  and rebalanced            │
            └────────────────────────────┘
```

---

## Workflow 2: Weekly Health Check

### Sequence Diagram

```
Scheduler  HealthCheckService  MailJet  Redis  ListHealthAgent  ReportingAgent  Database  Slack
   │              │               │       │           │                │            │       │
   │ Monday       │               │       │           │                │            │       │
   │ 10 AM UTC    │               │       │           │                │            │       │
   ├─────────────>│               │       │           │                │            │       │
   │  trigger     │               │       │           │                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 1: Sync all lists             │                │            │       │
   │              ├──────────────>│       │           │                │            │       │
   │              │  getMasterList│       │           │                │            │       │
   │              │<──────────────┤       │           │                │            │       │
   │              │               │       │           │                │            │       │
   │              ├──────────────>│       │           │                │            │       │
   │              │  getCampaignLists     │           │                │            │       │
   │              │<──────────────┤       │           │                │            │       │
   │              │               │       │           │                │            │       │
   │              ├──────────────>│       │           │                │            │       │
   │              │  getSuppressionList   │           │                │            │       │
   │              │<──────────────┤       │           │                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 2: Update Redis cache        │                │            │       │
   │              ├────────────────────────>│         │                │            │       │
   │              │  set(lists, TTL=3600)  │         │                │            │       │
   │              │<────────────────────────┤         │                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 3: Fetch recent campaigns    │                │            │       │
   │              ├─────────────────────────────────────────────────────────────>│       │
   │              │  findMany(last 7 days) │         │                │            │       │
   │              │<─────────────────────────────────────────────────────────────┤       │
   │              │               │       │           │                │            │       │
   │              │ Step 4: Calculate metrics         │                │            │       │
   │              │  (bounce rates, health status)    │                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 5: AI analyzes each list     │                │            │       │
   │              ├───────────────────────────────────>│                │            │       │
   │              │  analyze(list1Metrics)            │                │            │       │
   │              │<───────────────────────────────────┤                │            │       │
   │              │  HealthAssessment                 │                │            │       │
   │              │               │       │           │                │            │       │
   │              ├───────────────────────────────────>│                │            │       │
   │              │  analyze(list2Metrics)            │                │            │       │
   │              │<───────────────────────────────────┤                │            │       │
   │              │               │       │           │                │            │       │
   │              ├───────────────────────────────────>│                │            │       │
   │              │  analyze(list3Metrics)            │                │            │       │
   │              │<───────────────────────────────────┤                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 6: Generate weekly report    │                │            │       │
   │              ├────────────────────────────────────────────────────>│            │       │
   │              │  generateWeeklyReport()           │                │            │       │
   │              │<────────────────────────────────────────────────────┤            │       │
   │              │  WeeklyReport                     │                │            │       │
   │              │               │       │           │                │            │       │
   │              │ Step 7: Check for critical issues │                │            │       │
   │              │  if (urgency === 'high')          │                │            │       │
   │              ├────────────────────────────────────────────────────────────────────────>│
   │              │  postMessage(CRITICAL ALERT)      │                │            │       │
   │              │<────────────────────────────────────────────────────────────────────────┤
   │              │               │       │           │                │            │       │
   │              │ Step 8: Send weekly report        │                │            │       │
   │              ├────────────────────────────────────────────────────────────────────────>│
   │              │  postMessage(weekly report)       │                │            │       │
   │              │<────────────────────────────────────────────────────────────────────────┤
   │              │               │       │           │                │            │       │
   │              │ Step 9: Log to database           │                │            │       │
   │              ├─────────────────────────────────────────────────────────────>│       │
   │              │  create(ListHealthCheck)          │                │            │       │
   │              │<─────────────────────────────────────────────────────────────┤       │
   │<─────────────┤               │       │           │                │            │       │
   │  complete    │               │       │           │                │            │       │
```

### Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│        START: Weekly List Health Check (Monday 10 AM UTC)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Starting weekly      │
            │  list health check         │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 1: Sync All Lists    │
            │  Promise.all([             │
            │    getMasterList(5776),    │
            │    getCampaignList(1),     │
            │    getCampaignList(2),     │
            │    getCampaignList(3),     │
            │    getSuppressionList()    │
            │  ])                        │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 2: Update Redis Cache│
            │  For each list:            │
            │  redis.set(               │
            │    key,                    │
            │    JSON.stringify(list),   │
            │    'EX', 3600              │
            │  )                         │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 3: Fetch Recent      │
            │  Campaign Performance      │
            │  database.findMany({       │
            │    where: {                │
            │      scheduledDate >= now-7│
            │    },                      │
            │    include: { metrics }    │
            │  })                        │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 4: Calculate List Metrics                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  For each campaign list:                             │  │
│  │  • subscriberCount (current size)                    │  │
│  │  • recentBounceRate (avg last 7 days)                │  │
│  │  • targetSize (masterList / 3)                       │  │
│  │  • variance (actual vs target)                       │  │
│  │  • healthStatus (preliminary assessment)             │  │
│  │  • lastCampaignDate                                  │  │
│  │  • deliveryRate (avg last 7 days)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 5: AI Health Analysis (ListHealthAgent)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  For each list (run in parallel):                   │  │
│  │                                                      │  │
│  │  Input:                                              │  │
│  │  • list metrics (from Step 4)                        │  │
│  │                                                      │  │
│  │  AI Prompt:                                          │  │
│  │  "Analyze the health of this email campaign list... │  │
│  │   Provide health status, concerns, risk factors..."  │  │
│  │                                                      │  │
│  │  Output (per list):                                  │  │
│  │  • status (healthy/warning/critical)                 │  │
│  │  • concerns (key issues)                             │  │
│  │  • riskFactors (potential problems)                  │  │
│  │  • reputationImpact (sender reputation)              │  │
│  │  • urgency (low/medium/high)                         │  │
│  │  • aiRationale (explanation)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Step 6: Generate Weekly Report (ReportingAgent)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Input:                                              │  │
│  │  • listMetrics (all 3 lists)                         │  │
│  │  • recentActivity (last 7 days)                      │  │
│  │    - campaigns sent                                  │  │
│  │    - contacts suppressed                             │  │
│  │    - rebalancing events                              │  │
│  │    - issues detected                                 │  │
│  │    - new contacts added                              │  │
│  │                                                      │  │
│  │  AI Prompt:                                          │  │
│  │  "Generate executive-level weekly report...          │  │
│  │   Include summary, highlights, action items..."      │  │
│  │                                                      │  │
│  │  Output:                                             │  │
│  │  • summary (2-3 sentences)                           │  │
│  │  • highlights (positive developments)                │  │
│  │  • actionItems (prioritized issues)                  │  │
│  │  • weekOverWeek (comparison)                         │  │
│  │  • recommendations (next week actions)               │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 7: Check for Critical│
            │  Issues                    │
            │  filter(urgency === 'high')│
            └────────────┬───────────────┘
                         │
                    Yes  │  No
            ┌────────────┼────────────┐
            ▼            │            ▼
   ┌──────────────────┐ │  ┌──────────────────┐
   │ Send CRITICAL    │ │  │ Skip critical    │
   │ alert to Slack   │ │  │ alert            │
   │ 🚨 Urgent notice │ │  └──────────────────┘
   └──────────┬───────┘ │
              └─────────┼────────────┘
                        │
                        ▼
            ┌────────────────────────────┐
            │  Step 8: Send Weekly Report│
            │  to Slack                  │
            │  postMessage(#_traction)   │
            │  - Executive summary       │
            │  - Health assessments      │
            │  - Action items            │
            │  - Recommendations         │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Step 9: Log to Database   │
            │  create(ListHealthCheck)   │
            │  - Executed at             │
            │  - Master list size        │
            │  - Campaign list sizes     │
            │  - Suppression list size   │
            │  - Health assessments      │
            │  - Weekly report           │
            │  - Critical issues count   │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Log: Weekly health check  │
            │  completed                 │
            │  - Critical issues: N      │
            │  - Total issues: M         │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  END: Reports sent         │
            │  Next check: next Monday   │
            └────────────────────────────┘
```

---

## Workflow 3: Pre-Campaign Validation

### Sequence Diagram (Integration with Existing Pre-Flight)

```
PreFlightService  ListValidator  MailJet  Redis  ListHealthAgent  Database  Slack
       │                │           │       │           │            │       │
       │ Stage 2        │           │       │           │            │       │
       │ (T-3.25h)      │           │       │           │            │       │
       │                │           │       │           │            │       │
       │ Existing pre-flight checks │       │           │            │       │
       │ (list, campaign, technical)│       │           │            │       │
       │                │           │       │           │            │       │
       │ NEW: List health validation│       │           │            │       │
       ├───────────────>│           │       │           │            │       │
       │ validateListForCampaign()  │       │           │            │       │
       │                │           │       │           │            │       │
       │                │ Check 1: Verify list size    │            │       │
       │                ├──────────>│       │           │            │       │
       │                │ getList() │       │           │            │       │
       │                │<──────────┤       │           │            │       │
       │                │           │       │           │            │       │
       │                │ Check 2: Verify no suppressed contacts    │       │
       │                ├──────────>│       │           │            │       │
       │                │ getListContacts() │           │            │       │
       │                │<──────────┤       │           │            │       │
       │                │           │       │           │            │       │
       │                ├──────────>│       │           │            │       │
       │                │ getSuppressionList()         │            │       │
       │                │<──────────┤       │           │            │       │
       │                │           │       │           │            │       │
       │                │ Check 3: Verify cache freshness          │       │
       │                ├────────────────────>│         │            │       │
       │                │ get(metadata)      │         │            │       │
       │                │<────────────────────┤         │            │       │
       │                │           │       │           │            │       │
       │                │ Check 4: AI assessment       │            │       │
       │                ├───────────────────────────────>│            │       │
       │                │ analyze(recentMetrics)        │            │       │
       │                │<───────────────────────────────┤            │       │
       │                │ HealthAssessment             │            │       │
       │                │           │       │           │            │       │
       │<───────────────┤           │       │           │            │       │
       │ ListValidation │           │       │           │            │       │
       │ + issues[]     │           │       │           │            │       │
       │ + healthStatus │           │       │           │            │       │
       │ + aiAssessment │           │       │           │            │       │
       │                │           │       │           │            │       │
       │ Include in pre-flight report      │           │            │       │
       ├───────────────────────────────────────────────────────────────────>│
       │ postMessage(pre-flight results)   │           │            │       │
       │<───────────────────────────────────────────────────────────────────┤
```

### Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│    START: Pre-Campaign List Validation (Part of Pre-Flight)     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Get CampaignSchedule      │
            │  - listId                  │
            │  - recipientCount          │
            │  - scheduledDate           │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Initialize validation     │
            │  issues = []               │
            │  listExists = false        │
            │  sizeMatch = false         │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Check 1: Verify List Exists and Correct Size              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  list = mailjet.getList(schedule.listId)             │  │
│  │  expectedSize = schedule.recipientCount              │  │
│  │  actualSize = list.subscriberCount                   │  │
│  │  discrepancy = |actualSize - expectedSize|           │  │
│  │                                                      │  │
│  │  if (discrepancy > 10):                              │  │
│  │    issues.push({                                     │  │
│  │      severity: 'warning',                            │  │
│  │      message: 'List size mismatch'                   │  │
│  │    })                                                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Check 2: Verify No Suppressed Contacts in List            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  listContacts = mailjet.getListContacts(             │  │
│  │    schedule.listId, 100                              │  │
│  │  )                                                   │  │
│  │  suppressedList = mailjet.getListContacts(           │  │
│  │    10503500, 10000                                   │  │
│  │  )                                                   │  │
│  │  suppressedIds = Set(suppressedList.map(c => c.ID))  │  │
│  │  suppressedInList = listContacts.filter(c =>         │  │
│  │    suppressedIds.has(c.ID)                           │  │
│  │  )                                                   │  │
│  │                                                      │  │
│  │  if (suppressedInList.length > 0):                   │  │
│  │    issues.push({                                     │  │
│  │      severity: 'critical',                           │  │
│  │      message: 'Found N suppressed contacts',         │  │
│  │      action: 'Remove before launch'                  │  │
│  │    })                                                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Check 3: Verify List Freshness (Cache)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  cacheData = redis.get(`list:metadata:${listId}`)    │  │
│  │  if (cacheData):                                     │  │
│  │    metadata = JSON.parse(cacheData)                  │  │
│  │    hoursSinceSync = (now - metadata.lastSynced) / 3600│ │
│  │                                                      │  │
│  │    if (hoursSinceSync > 24):                         │  │
│  │      issues.push({                                   │  │
│  │        severity: 'warning',                          │  │
│  │        message: 'List cache stale (N hours old)',    │  │
│  │        action: 'Consider refreshing'                 │  │
│  │      })                                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Check 4: AI Assessment of List Quality                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  recentMetrics = getRecentListMetrics(listId)        │  │
│  │                                                      │  │
│  │  healthAgent = new ListHealthAgent()                 │  │
│  │  healthAssessment = healthAgent.analyze(             │  │
│  │    recentMetrics                                     │  │
│  │  )                                                   │  │
│  │                                                      │  │
│  │  validation.healthStatus = healthAssessment.status   │  │
│  │  validation.aiAssessment = healthAssessment.rationale│  │
│  │                                                      │  │
│  │  if (healthAssessment.urgency === 'high'):           │  │
│  │    issues.push({                                     │  │
│  │      severity: 'warning',                            │  │
│  │      message: 'AI flagged list health concerns',     │  │
│  │      details: healthAssessment.concerns,             │  │
│  │      action: healthAssessment.aiRationale            │  │
│  │    })                                                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Return ListValidation     │
            │  - listExists: boolean     │
            │  - sizeMatch: boolean      │
            │  - discrepancy: number     │
            │  - issues: Issue[]         │
            │  - healthStatus: string    │
            │  - aiAssessment: string    │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Include in Pre-Flight     │
            │  Notification              │
            │  (existing Stage 2 report) │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  END: Validation complete  │
            │  Issues flagged if any     │
            └────────────────────────────┘
```

---

## AI Agent Orchestration

### Parallel Agent Execution

```
┌─────────────────────────────────────────────────────────────┐
│               ListManagementOrchestrator                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Initialize GeminiClient   │
            │  (shared across agents)    │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Prepare input data for    │
            │  agents:                   │
            │  • Campaign metrics        │
            │  • List metadata           │
            │  • Historical context      │
            └────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Execute Agents in Parallel (Promise.all)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │  const [health, rebalance, optimization, report] =   │  │
│  │    await Promise.all([                               │  │
│  │                                                      │  │
│  │      listHealthAgent.analyze(metrics),               │  │
│  │      ↓                                               │  │
│  │      • Gemini API call 1 (concurrent)                │  │
│  │      • Temperature: 0.7                              │  │
│  │      • Returns: HealthAssessment                     │  │
│  │                                                      │  │
│  │      rebalancingAgent.generatePlan(lists),           │  │
│  │      ↓                                               │  │
│  │      • Gemini API call 2 (concurrent)                │  │
│  │      • Temperature: 0.5 (deterministic)              │  │
│  │      • Returns: RebalancingPlan                      │  │
│  │                                                      │  │
│  │      optimizationAgent.identifySuppressions(bounces),│  │
│  │      ↓                                               │  │
│  │      • Gemini API call 3 (concurrent)                │  │
│  │      • Temperature: 0.3 (very deterministic)         │  │
│  │      • Returns: SuppressionRecommendation            │  │
│  │                                                      │  │
│  │      reportingAgent.generateReport(data)             │  │
│  │      ↓                                               │  │
│  │      • Gemini API call 4 (concurrent)                │  │
│  │      • Temperature: 0.6                              │  │
│  │      • Returns: WeeklyReport                         │  │
│  │                                                      │  │
│  │    ])                                                │  │
│  │                                                      │  │
│  │  All 4 agents execute concurrently                   │  │
│  │  Total time ≈ slowest agent (~5-10 seconds)          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Aggregate Results         │
            │  {                         │
            │    health,                 │
            │    rebalance,              │
            │    optimization,           │
            │    report                  │
            │  }                         │
            └────────────────────────────┘
```

### Agent Communication Flow

```
 Orchestrator
      │
      ├──────────────┬──────────────┬──────────────┬──────────────┐
      │              │              │              │              │
      ▼              ▼              ▼              ▼              │
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  Health  │  │Rebalance │  │ Optimize │  │  Report  │          │
│  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │          │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
     │             │             │             │                 │
     │             │             │             │                 │
     └─────────────┴─────────────┴─────────────┘                 │
                   │                                             │
                   ▼                                             │
         ┌──────────────────────┐                               │
         │   GeminiClient       │                               │
         │   (Shared Instance)  │                               │
         └──────────┬───────────┘                               │
                    │                                            │
                    ▼                                            │
         ┌──────────────────────┐                               │
         │ Gemini 2.0 Flash API │                               │
         │ 4 concurrent requests│                               │
         └──────────┬───────────┘                               │
                    │                                            │
                    │ Responses                                  │
                    ▼                                            │
         ┌──────────────────────┐                               │
         │  Agent Results       │                               │
         │  • HealthAssessment  │                               │
         │  • RebalancingPlan   │                               │
         │  • Suppression Recs  │                               │
         │  • WeeklyReport      │                               │
         └──────────┬───────────┘                               │
                    │                                            │
                    └────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Combined Results      │
                    │  Ready for execution   │
                    └────────────────────────┘
```

---

## State Machine

### List Health States

```
┌─────────────────────────────────────────────────────────────┐
│                    LIST HEALTH STATES                        │
└─────────────────────────────────────────────────────────────┘

     HEALTHY
    (bounce < 2%)
         │
         │ Campaign sent
         ↓
    ┌──────────┐
    │ Checking │ ← Post-campaign (T+24h)
    └──────────┘
         │
         │ Bounce data analyzed
         ↓
    Decision Point
         │
    ┌────┼────┐
    │    │    │
    ▼    ▼    ▼
┌────────┐ ┌────────────┐ ┌────────────┐
│HEALTHY │ │NEEDS       │ │NEEDS       │
│        │ │REBALANCING │ │CLEANUP     │
│<2%     │ │            │ │>10%        │
│bounce  │ │List        │ │bounce      │
└───┬────┘ │imbalanced  │ │            │
    │      │±5-15%      │ │            │
    │      └─────┬──────┘ └──────┬─────┘
    │            │               │
    │            │ Rebalance     │ Suppress
    │            ▼               ▼
    │      ┌──────────┐    ┌──────────┐
    │      │REBALANCING│   │CLEANING  │
    │      └─────┬────┘    └─────┬────┘
    │            │               │
    │            │ Complete      │ Complete
    │            ▼               ▼
    └────────────┴───────────────┴────────┐
                 │                        │
                 ▼                        │
         ┌────────────────┐              │
         │  MAINTENANCE   │              │
         │  COMPLETE      │              │
         └────────┬───────┘              │
                  │                      │
                  │ Update cache         │
                  ▼                      │
         ┌────────────────┐              │
         │   MONITORED    │              │
         │ (Weekly checks)│              │
         └────────┬───────┘              │
                  │                      │
                  │ Next campaign        │
                  └──────────────────────┘
```

### Campaign List Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│              CAMPAIGN LIST LIFECYCLE STATES                  │
└─────────────────────────────────────────────────────────────┘

    CREATED
   (New list)
       │
       │ Populate from master
       ▼
   POPULATED
  (1,000 contacts)
       │
       │ Pre-campaign validation
       ▼
    VALIDATED
  (Ready to send)
       │
       │ Campaign sent
       ▼
   IN_USE
  (Campaign active)
       │
       │ Campaign complete
       ▼
   ANALYZING
  (T+24h bounce check)
       │
       │ Bounces identified
       ▼
  NEEDS_CLEANUP
  (Hard bounces found)
       │
       │ Suppression executed
       ▼
   CLEANED
  (942 contacts remain)
       │
       │ Check balance
       ▼
  NEEDS_REBALANCING
  (Below target -5.8%)
       │
       │ Rebalancing executed
       ▼
   REBALANCED
  (1,040 contacts)
       │
       │ Cache updated
       ▼
    READY
  (For next campaign)
       │
       └──────────┘
       (Cycle repeats)
```

---

## Error Handling Flows

### Suppression Failure Recovery

```
┌─────────────────────────────────────────────────────────────┐
│              SUPPRESSION FAILURE HANDLING                    │
└─────────────────────────────────────────────────────────────┘

    Execute Suppression
    suppressContacts(245)
            │
            ▼
       ┌─────────┐
       │ Try API │
       │ Call    │
       └────┬────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
   SUCCESS     FAILURE
   (200)       (500/timeout)
      │           │
      │           ▼
      │     ┌──────────────┐
      │     │ Retry Attempt│
      │     │ (Exponential │
      │     │  Backoff)    │
      │     └──────┬───────┘
      │            │
      │      Attempt 1,2,3
      │            │
      │      ┌─────┴─────┐
      │      │           │
      │      ▼           ▼
      │   SUCCESS     FAILURE
      │   (partial)   (all failed)
      │      │           │
      │      ▼           ▼
      │  ┌─────────┐  ┌─────────┐
      │  │ Accept  │  │ Queue   │
      │  │ Partial │  │ for     │
      │  │ Success │  │ Manual  │
      │  │         │  │ Review  │
      │  │ Log:    │  │         │
      │  │ - Success: 200│   │ Alert   │
      │  │ - Failed: 45  │   │ Team    │
      │  └────┬────┘  └────┬────┘
      │       │            │
      └───────┴────────────┴────────┐
              │                     │
              ▼                     │
      Continue workflow             │
      (with partial results)        │
                                    │
      Log to database:              │
      - Success count               │
      - Failure count               │
      - Error details               │
      - Retry attempts              │
                                    │
      Slack notification:           │
      "⚠️  Partial suppression      │
       200/245 contacts suppressed" │
                                    │
      Manual review queue:          │
      - 45 contacts pending          │
      - Error: API timeout          │
```

### Rebalancing Rollback

```
┌─────────────────────────────────────────────────────────────┐
│              REBALANCING ROLLBACK FLOW                       │
└─────────────────────────────────────────────────────────────┘

    Execute Rebalancing
    moveContacts(plan)
            │
            ▼
    ┌───────────────┐
    │ Capture       │
    │ Before State  │
    │ - list_1: 1000│
    │ - list_2: 942 │
    │ - list_3: 1177│
    └───────┬───────┘
            │
            ▼
       ┌─────────┐
       │ Apply   │
       │ Changes │
       └────┬────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
   SUCCESS     FAILURE
   (complete)  (mid-operation)
      │           │
      │           ▼
      │     ┌──────────────┐
      │     │ Detect Failure│
      │     │ - API error   │
      │     │ - Validation  │
      │     │   failed      │
      │     └──────┬───────┘
      │            │
      │            ▼
      │     ┌──────────────┐
      │     │ ROLLBACK     │
      │     │              │
      │     │ 1. Restore   │
      │     │    Before    │
      │     │    State     │
      │     │              │
      │     │ 2. Verify    │
      │     │    Rollback  │
      │     │    Success   │
      │     └──────┬───────┘
      │            │
      │      ┌─────┴─────┐
      │      │           │
      │      ▼           ▼
      │  ROLLBACK    ROLLBACK
      │  SUCCESS     FAILED
      │      │           │
      │      ▼           ▼
      │  ┌────────┐  ┌────────┐
      │  │ Alert  │  │ CRITICAL│
      │  │ Team   │  │ ALERT  │
      │  │        │  │        │
      │  │ Manual │  │ Manual │
      │  │ Review │  │ Fix    │
      │  │ Needed │  │ Required│
      │  └────────┘  └────────┘
      │
      ▼
   Capture After State
   - list_1: 1000
   - list_2: 1040
   - list_3: 1040
      │
      ▼
   Log to database
   - Before state
   - After state
   - Changes summary
   - AI rationale
```

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept and vision
- [Campaign Lifecycle Workflows](../lifecycle/01_workflow.md) - Existing workflow patterns
- Mermaid Diagrams - For interactive sequence diagrams
- Slack Block Kit - For notification formatting

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Complete
