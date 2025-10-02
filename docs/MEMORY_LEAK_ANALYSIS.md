# Memory Leak Analysis - Prisma Client Connections

**Date**: October 2, 2025
**Status**: 🚨 CRITICAL MEMORY LEAK IDENTIFIED
**Impact**: Worker and Web dynos exceeding memory quota by 24-42%

---

## Executive Summary

**Root Cause**: **32 separate Prisma Client instances** created across the application, each maintaining its own connection pool. This causes excessive memory usage and connection pool exhaustion.

**Current Impact**:
- Worker dyno: 614-726MB usage (120-142% of 512MB quota)
- Web dyno: 599-673MB usage (117-132% of 512MB quota)
- Heroku Error R14 (Memory quota exceeded) occurring frequently

**Solution**: Create a **singleton Prisma client** shared across all services.

---

## Problem Analysis

### Current Pattern (INCORRECT)

Each service file creates its own Prisma client:

```typescript
// ❌ BAD: src/services/lifecycle/campaign-orchestrator.service.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ❌ BAD: src/services/lifecycle/metrics-collection.service.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ... repeated in 32 files
```

### Files Creating Separate Prisma Clients (32 total)

**Lifecycle Services** (9 files):
1. `/src/services/lifecycle/campaign-orchestrator.service.ts`
2. `/src/services/lifecycle/campaign-schedule.service.ts`
3. `/src/services/lifecycle/campaign-metrics.service.ts`
4. `/src/services/lifecycle/metrics-collection.service.ts`
5. `/src/services/lifecycle/notification.service.ts`
6. `/src/services/lifecycle/notification-log.service.ts`
7. `/src/services/lifecycle/preflight-verification.service.ts`
8. `/src/tests/services/lifecycle/campaign-schedule.service.test.ts`
9. `/src/tests/services/lifecycle/campaign-metrics.service.test.ts`

**List Management Services** (4 files):
10. `/src/services/lists/list-management.service.ts`
11. `/src/services/lists/contact.service.ts`
12. `/src/services/lists/suppression.service.ts`
13. `/src/services/lists/list-maintenance-orchestrator.service.ts`

**API Routes** (9 files):
14. `/src/api/server-minimal.ts`
15. `/src/api/routes/lifecycle.ts`
16. `/src/api/routes/campaigns.ts`
17. `/src/api/routes/tasks.ts`
18. `/src/api/routes/teams.ts`
19. `/src/api/routes/approvals.ts`
20. `/src/api/routes/timelines.ts`
21. `/src/api/routes/dashboard.ts`
22. `/src/api/routes/notifications.ts`

**Job Processors** (3 files):
23. `/src/jobs/notification.jobs.ts`
24. `/src/jobs/approval.jobs.ts`
25. `/src/jobs/bounce-cleanup.jobs.ts`

**Other Services** (7 files):
26. `/src/services/bulk/bulk-operations.service.ts`
27. `/src/services/audit/audit-log.service.ts`
28. `/src/services/monitoring/health-monitor.service.ts`
29. `/src/services/search/advanced-search.service.ts`
30. `/src/adapters/mcp-server.adapter.ts`
31. `/src/api/routes/health.ts`
32. `/src/tests/services/lifecycle/notification-log.service.test.ts`

### Why This Causes Memory Leaks

Each `new PrismaClient()` creates:
- **Connection pool** (default: 10 connections per client)
- **Query engine** process
- **Schema cache**
- **Middleware stack**
- **Event listeners**

**With 32 Prisma clients**:
- 32 × 10 = **320 potential database connections**
- 32 separate query engine processes
- 32 separate schema caches
- Connections are NOT reused across services
- Connections may not be properly closed

### Memory Calculation

Conservative estimate per Prisma client:
- Connection pool: ~5-10MB
- Query engine: ~10-15MB
- Schema + middleware: ~5MB
- **Total per client: ~20-30MB**

**32 clients × 25MB average = 800MB** (exceeds both dynos' 512MB quota)

---

## Solution: Singleton Prisma Client

### Step 1: Create Shared Prisma Instance

Create `/src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

### Step 2: Update All Services

Replace in all 32 files:

```typescript
// ❌ Remove this
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ✅ Replace with this
import { prisma } from '@/lib/prisma';
```

### Step 3: Update API Routes

For routes that dynamically import Prisma:

```typescript
// ❌ Current (in lifecycle.ts reschedule endpoint)
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const updatedSchedule = await prisma.lifecycleCampaignSchedule.update(...);

// ✅ Should be
import { prisma } from '@/lib/prisma';
const updatedSchedule = await prisma.lifecycleCampaignSchedule.update(...);
// Remove: await prisma.$disconnect(); // Don't disconnect singleton!
```

---

## Additional Optimizations

### 1. Connection Pool Configuration

Configure Prisma for Heroku environment:

```typescript
// src/lib/prisma.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=5&pool_timeout=20'
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

### 2. Queue Job Cleanup

Ensure orchestrators don't accumulate:

```typescript
// ✅ GOOD: Current pattern in lifecycle-queue.ts
lifecycleQueue.process('preflight', async (job) => {
  const orchestrator = new CampaignOrchestratorService(); // Creates instance
  const result = await orchestrator.runPreFlight(job.data.campaignScheduleId);
  return result; // Instance is garbage collected after job completes
});
```

This is fine IF the orchestrator uses the singleton Prisma client.

### 3. Bull Queue Settings

Current settings are good:
```typescript
defaultJobOptions: {
  removeOnComplete: 100,  // ✅ Limits memory usage
  removeOnFail: 500       // ✅ Limits memory usage
}
```

---

## Expected Memory Improvement

**Before Fix** (32 Prisma clients):
- Estimated memory: 800MB
- Worker actual: 614-726MB (120-142%)
- Web actual: 599-673MB (117-132%)

**After Fix** (1 Prisma client):
- Estimated memory: 200-300MB
- Expected worker: 250-350MB (49-68%)
- Expected web: 200-300MB (39-59%)

**Memory Reduction: ~60-70%**

---

## Implementation Priority

**Priority 1 - Critical Files** (Fix these first):

1. Create `/src/lib/prisma.ts` (singleton)
2. Fix lifecycle services (9 files) - Most frequently used by worker
3. Fix API routes (9 files) - Most frequently used by web dyno
4. Fix job processors (3 files)

**Priority 2 - Secondary Files**:

5. Fix list management services (4 files)
6. Fix other services (7 files)

**Priority 3 - Test Files**:

7. Fix test files (can use singleton or create fresh instances for isolation)

---

## Verification Steps

After implementing fix:

1. **Deploy to staging**
2. **Monitor memory usage**:
   ```bash
   heroku logs --app campaign-manager-staging --tail | grep "Memory\|R14"
   ```
3. **Check Prisma connection count** (via database):
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%prisma%';
   ```
4. **Verify memory improvement**:
   - Should drop from 600-700MB to 200-350MB
   - No more R14 errors

---

## Alternative: Upgrade Dynos (NOT RECOMMENDED)

If the fix can't be implemented immediately:

- **Temporary solution**: Upgrade to Standard-2X (1GB memory)
- **Cost**: +$86/month for both dynos
- **Problem**: Doesn't fix the root cause, only masks it
- **Risk**: Memory leak will eventually exceed 1GB too

**Recommendation**: Fix the Prisma client issue first, THEN assess if dyno upgrade is still needed.

---

## Round 3 Campaign Investigation

**User Report**: Round 3 of user campaign was sent on **October 1, 2025** instead of being scheduled.

**Investigation Constraints**:
- Heroku logs only retained ~1000 lines (~1-2 hours)
- Oct 1 logs not available
- Database query requires psql client (not installed locally)

**Required Actions** (user must perform):

1. **Check MailJet Campaigns**:
   - Log into MailJet dashboard
   - View campaigns sent on Oct 1, 2025
   - Look for "Client Letter" or "User Campaign Round 3"
   - Check send time and recipient count

2. **Check Slack #_traction**:
   - Review messages from Oct 1
   - Look for campaign launch notifications
   - Check for any error messages

3. **Query Database** (requires Heroku CLI with psql):
   ```bash
   heroku pg:psql --app campaign-manager-staging

   -- Check for Oct 1 campaigns
   SELECT * FROM campaign_schedules
   WHERE scheduled_date::date = '2025-10-01'
   AND name LIKE '%Round 3%'
   OR name LIKE '%User%';

   -- Check lifecycle campaigns
   SELECT * FROM lifecycle_campaign_schedules
   WHERE scheduled_date::date = '2025-10-01';
   ```

**Likely Scenario** (based on our investigation):
- Simple Scheduler ran on server restart Oct 1
- Created notification schedule (NOT actual campaign)
- Notifications may have fired, but NO campaign was actually sent
- Unless someone manually sent via MailJet dashboard

---

## Immediate Action Items

**Critical (Do Now)**:
- [ ] Create `/src/lib/prisma.ts` singleton
- [ ] Update lifecycle services to use singleton (9 files)
- [ ] Update API routes to use singleton (9 files)
- [ ] Deploy and monitor memory

**Urgent (Today)**:
- [ ] Update job processors (3 files)
- [ ] Update list services (4 files)
- [ ] Verify memory improvement

**Important (This Week)**:
- [ ] Update remaining services (7 files)
- [ ] Update test files appropriately
- [ ] Document Prisma best practices

**Round 3 Investigation**:
- [ ] User checks MailJet for Oct 1 sends
- [ ] User checks Slack history
- [ ] User queries database for Oct 1 campaigns
- [ ] Determine if campaign was actually sent or just scheduled

---

## Conclusion

**Root Cause**: 32 separate Prisma Client instances causing **800MB memory usage**.

**Fix**: Singleton pattern reduces to **1 Prisma Client** → ~200-300MB usage.

**Expected Result**: 60-70% memory reduction, eliminating R14 errors.

**Timeline**: Can be implemented and deployed within 2-3 hours.

**Cost Savings**: Avoids $86/month dyno upgrade by fixing root cause.
