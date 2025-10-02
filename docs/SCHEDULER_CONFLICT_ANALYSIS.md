# Campaign Scheduler Conflict Analysis

**Date**: October 2, 2025
**Status**: 🚨 CRITICAL CONFLICT IDENTIFIED

## Executive Summary

There are **TWO SEPARATE AND CONFLICTING** campaign scheduling systems running simultaneously:

1. **Simple Scheduler** (index.ts) - Basic cron-based notification scheduler
2. **Lifecycle System** (comprehensive) - Full campaign lifecycle management with API control

**Recommendation**: **REMOVE Simple Scheduler immediately** - it creates conflicts and is redundant.

---

## System Comparison

### System 1: Simple Scheduler (PROBLEMATIC)

**Location**: `src/index.ts:49-82` + `src/services/scheduling/campaign-scheduler.service.ts`

**Database Table**: `campaign_schedules` (used by server-minimal.ts MCP tools only)

**How It Works**:
- Hardcoded configuration in `index.ts`
- Runs automatically on every server startup
- Uses `node-cron` to schedule 5 notifications
- **NO database tracking of actual campaigns**
- **NO API control**
- **NO launch automation**
- Only sends Slack notifications at fixed times

**Scheduled Times** (hardcoded):
1. Monday 3:00 AM UTC - Preparation notification
2. Tuesday 6:00 AM UTC - Pre-launch checks
3. Tuesday 8:45 AM UTC - Launch countdown
4. Tuesday 9:00 AM UTC - Launch notification
5. Tuesday 9:15 AM UTC - Post-launch status

**Issues**:
- Runs on EVERY server restart/deployment
- Creates duplicate notification schedules
- Cannot be cancelled or modified via API
- No database record of actual campaigns
- Conflicts with lifecycle system
- **This is what scheduled notifications this morning at 05:50 AM**

### System 2: Lifecycle System (COMPREHENSIVE) ✅

**Location**: Multiple services in `src/services/lifecycle/`

**Database Table**: `lifecycle_campaign_schedules`

**How It Works**:
- API-driven campaign creation via `/api/lifecycle/campaigns`
- Creates database records for each campaign schedule
- Bull Queue job scheduling (5 stages + optional Stage 6)
- Full lifecycle: Pre-Launch → Pre-Flight → Launch Warning → Launch → Wrap-Up
- Tracks metrics, notifications, and status
- Can be controlled, cancelled, and rescheduled via API
- AI-powered verification and analysis

**Lifecycle Stages**:
1. **Pre-Launch** (T-48h): Initial notification
2. **Pre-Flight** (T-1h): Verification checks
3. **Launch Warning** (T-15m): Final countdown
4. **Launch** (T+0): Execute campaign send
5. **Wrap-Up** (T+2h): Collect metrics and analyze
6. **List Maintenance** (T+24h): Optional cleanup

**Features**:
- Complete API control
- Database-backed schedules
- Job queue management
- Metrics collection
- AI analysis
- Manual trigger capability
- Cancellation and rescheduling

---

## The Conflict

### What Happened This Morning (Oct 2, 2025 @ 05:50 AM UTC)

**Simple Scheduler ran on server restart and created notification jobs:**

```
2025-10-02T05:50:04.886175+00:00 app[web.1]:
[info]: Scheduling campaign notifications {
  "campaignName":"Client Letter Automation",
  "rounds":3
}
```

**These are JUST NOTIFICATIONS** - no actual campaign:
- ✅ Slack messages will be sent at scheduled times
- ❌ No database record in `lifecycle_campaign_schedules`
- ❌ No actual campaign launch automation
- ❌ No metrics collection
- ❌ No verification checks
- ❌ Cannot be cancelled via API

### Why This Is Problematic

1. **Confusion**: Notifications suggest campaign is scheduled, but no campaign exists in lifecycle system
2. **No Control**: Cannot cancel or modify these scheduled notifications
3. **Duplicate Scheduling**: Every deployment creates new notification jobs
4. **No Launch Automation**: Notifications fire, but no campaign actually launches
5. **Misleading**: Appears to be working, but it's only sending Slack messages

---

## Database Schema Comparison

### `campaign_schedules` (Simple Scheduler)

```prisma
model CampaignSchedule {
  id             String   @id @default(uuid())
  weekNumber     Int
  year           Int
  campaignId     String?  // Optional relation to Campaign
  dayOfWeek      String
  scheduledDate  DateTime
  time           String
  activityType   String   // launch, milestone, review
  name           String
  roundNumber    Int?
  // ... metadata fields
}
```

**Usage**: Only used by MCP tools in `server-minimal.ts` for:
- `scheduleActivity`
- `getWeekSchedule`
- `updateActivityStatus`
- `generateWeeklySummary`

**NOT used by Simple Scheduler** - scheduler is pure cron-based with hardcoded config.

### `lifecycle_campaign_schedules` (Lifecycle System) ✅

```prisma
model LifecycleCampaignSchedule {
  id                 Int      @id @default(autoincrement())
  campaignName       String
  roundNumber        Int      // 1, 2, or 3
  scheduledDate      DateTime
  scheduledTime      String

  // List details
  listName          String
  listId            BigInt   // MailJet list ID
  recipientCount    Int
  recipientRange    String

  // Campaign details
  mailjetDraftId    BigInt?
  mailjetCampaignId BigInt?
  subject           String
  senderName        String
  senderEmail       String

  // Tracking
  notificationStatus Json
  status            CampaignStatus @default(SCHEDULED)

  // Relations
  metrics           LifecycleCampaignMetrics[]
  notifications     LifecycleNotificationLog[]
}
```

**Usage**: Complete lifecycle management
- Campaign creation and tracking
- Job scheduling
- Metrics collection
- Notification logging
- Status management

---

## Recommendation: Remove Simple Scheduler

### Why Remove It?

1. **Redundant**: Lifecycle system provides ALL functionality plus more
2. **Conflicting**: Creates confusion about actual campaign status
3. **Limited**: Only sends notifications, no actual campaign management
4. **Uncontrollable**: Cannot be cancelled or modified
5. **Database Pollution**: Creates duplicate schedules on every restart

### What to Remove

**Files to modify**:
1. `src/index.ts` - Remove lines 49-88 (scheduler initialization)
2. `src/services/scheduling/campaign-scheduler.service.ts` - Can keep for reference, but unused

**What happens after removal**:
- ✅ No more automatic notification scheduling on startup
- ✅ No more conflicts with lifecycle system
- ✅ All campaign management goes through proper lifecycle API
- ✅ Database is single source of truth
- ✅ Full control via API

### Migration Path

**To use Lifecycle System properly**:

1. Create campaign via API:
```bash
curl -X POST https://campaign-manager-staging-087b1925d6ef.herokuapp.com/api/lifecycle/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Client Letter Automation",
    "listIdPrefix": "Client_Letter",
    "subject": "Your Client Letter",
    "senderName": "Your Company",
    "senderEmail": "noreply@company.com",
    "totalRecipients": 3000,
    "mailjetListIds": [12345, 12346, 12347]
  }'
```

2. Jobs are automatically scheduled:
   - Pre-Launch (T-48h)
   - Pre-Flight (T-1h)
   - Launch Warning (T-15m)
   - Launch (T+0)
   - Wrap-Up (T+2h)

3. Monitor via API:
```bash
# Get campaign status
curl https://campaign-manager-staging-087b1925d6ef.herokuapp.com/api/lifecycle/campaigns/Client%20Letter%20Automation

# Get job status
curl https://campaign-manager-staging-087b1925d6ef.herokuapp.com/api/lifecycle/campaigns/1/jobs
```

4. Manual control:
```bash
# Cancel if needed
curl -X DELETE https://campaign-manager-staging-087b1925d6ef.herokuapp.com/api/lifecycle/campaigns/1 \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing cancelled"}'

# Reschedule if needed
curl -X PUT https://campaign-manager-staging-087b1925d6ef.herokuapp.com/api/lifecycle/campaigns/1/reschedule \
  -H "Content-Type: application/json" \
  -d '{"scheduledDate": "2025-10-03", "scheduledTime": "09:00"}'
```

---

## What About `campaign_schedules` Table?

**Keep it** - it's used by the MCP weekly summary tools, which is a different use case:
- Weekly planning and activity scheduling
- Dashboard generation
- Weekly summary notifications

This is **separate from campaign execution** and doesn't conflict.

---

## Action Items

**Priority 1 - Immediate**:
- [ ] Remove Simple Scheduler from `index.ts`
- [ ] Deploy to staging
- [ ] Test that no automatic scheduling happens on restart

**Priority 2 - Documentation**:
- [ ] Update README to explain lifecycle API usage
- [ ] Create campaign creation guide
- [ ] Document migration from simple to lifecycle system

**Priority 3 - Cleanup**:
- [ ] Archive `campaign-scheduler.service.ts` (keep for reference)
- [ ] Update any documentation that references simple scheduler

---

## Conclusion

The **Simple Scheduler** is a legacy system that:
- Was created before the comprehensive Lifecycle System
- Only handles notifications, not actual campaigns
- Runs automatically on startup causing confusion
- Cannot be controlled via API
- Is completely redundant

**Remove it** and use the **Lifecycle System** exclusively for all campaign management.

The `campaign_schedules` table should remain for the MCP weekly planning tools, which serve a different purpose (weekly activity planning vs. campaign execution).
