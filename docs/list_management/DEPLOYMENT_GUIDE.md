# List Management - Deployment Guide

## Overview

This guide walks through deploying the List Management feature to staging and production environments.

---

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure these are configured (already set for lifecycle feature):

```bash
# Required for List Management
REDIS_URL=redis://localhost:6379              # Redis for caching
GEMINI_API_KEY=your_gemini_api_key           # Google Gemini 2.0 Flash
MAILJET_AGENT_URL=https://...                 # MailJet MCP Agent
MAILJET_AGENT_API_KEY=your_key

# Database
DATABASE_URL=postgresql://...                 # PostgreSQL connection

# Optional - Slack notifications
SLACK_MANAGER_URL=https://...
SLACK_MANAGER_API_KEY=your_key
```

### 2. Dependencies

All dependencies are already in `package.json`. No new packages needed! ✅

---

## Deployment Steps

### Step 1: Database Migration

**Local/Staging:**

```bash
# Navigate to project
cd /path/to/campaign_manager

# Generate Prisma client
npm run db:generate

# Create migration (interactive - requires user input)
npx prisma migrate dev --name add_list_management_models

# This will:
# - Create migration SQL file
# - Apply to local database
# - Regenerate Prisma client
```

**Production (Heroku):**

```bash
# Deploy migrations
npm run db:deploy

# Or via Heroku
heroku run npm run db:deploy --app campaign-manager-production
```

### Step 2: Verify Migration

Check that all tables were created:

```sql
-- Run in PostgreSQL
\dt contact_lists
\dt contacts
\dt list_memberships
\dt suppression_history
\dt list_health_snapshots
\dt list_maintenance_logs

-- Check enums
\dT ListType
\dT ContactStatus
\dT MaintenanceAction
```

Expected tables:
- ✅ `contact_lists`
- ✅ `contacts`
- ✅ `list_memberships`
- ✅ `suppression_history`
- ✅ `list_health_snapshots`
- ✅ `list_maintenance_logs`

### Step 3: Build & Deploy

**Build Application:**

```bash
npm run build
# Compiles TypeScript to dist/
# Resolves path aliases with tsc-alias
```

**Deploy to Heroku:**

```bash
# Staging
git push heroku-staging staging:main

# Production (after staging validation)
git push heroku main
```

### Step 4: Verify Worker Dyno

The lifecycle worker automatically processes list maintenance jobs:

```bash
# Check worker is running
heroku ps --app campaign-manager-production

# Should show:
# web.1: up
# worker.1: up  (processes lifecycle-queue including list-maintenance)

# View worker logs
heroku logs --dyno worker --app campaign-manager-production --tail
```

### Step 5: Initialize Lists

Create the core lists via API or database:

```bash
# Option 1: Via API
curl -X POST https://campaign-manager.herokuapp.com/api/lists \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Master User List",
    "type": "MASTER",
    "mailjetListId": "5776"
  }'

# Create campaign lists
curl -X POST https://campaign-manager.herokuapp.com/api/lists \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campaign Round 1 - Tuesday",
    "type": "CAMPAIGN_ROUND_1",
    "mailjetListId": "123456"
  }'

# Repeat for ROUND_2 and ROUND_3
```

```sql
-- Option 2: Via SQL
INSERT INTO contact_lists (id, name, type, mailjet_list_id, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Master User List', 'MASTER', 5776, true, NOW(), NOW()),
  (gen_random_uuid(), 'Campaign Round 1 - Tuesday', 'CAMPAIGN_ROUND_1', 123456, true, NOW(), NOW()),
  (gen_random_uuid(), 'Campaign Round 2 - Thursday', 'CAMPAIGN_ROUND_2', 123457, true, NOW(), NOW()),
  (gen_random_uuid(), 'Campaign Round 3 - Next Tuesday', 'CAMPAIGN_ROUND_3', 123458, true, NOW(), NOW()),
  (gen_random_uuid(), 'Suppression List', 'SUPPRESSION', 10503500, true, NOW(), NOW());
```

### Step 6: Test Stage 6 Integration

**Manual Test:**

```bash
# 1. Create a lifecycle campaign
curl -X POST https://campaign-manager.herokuapp.com/api/lifecycle/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Test List Management",
    "listIdPrefix": "test",
    "subject": "Test Campaign",
    "senderName": "Test",
    "senderEmail": "test@example.com",
    "totalRecipients": 100,
    "mailjetListIds": [123456, 123457, 123458],
    "mailjetDraftId": 999999,
    "startDate": "2025-10-03T09:15:00Z"
  }'

# 2. Check that Stage 6 job is scheduled
curl https://campaign-manager.herokuapp.com/api/lifecycle/campaigns/1/jobs

# Should show:
# {
#   "prelaunch": "...",
#   "preflight": "...",
#   "launchWarning": "...",
#   "launch": "...",
#   "wrapup": "...",
#   "listMaintenance": "list-maintenance-1"  ✅
# }

# 3. Monitor job execution (T+24h or trigger manually)
heroku logs --dyno worker --grep "list-maintenance" --tail
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check Redis connection
curl https://campaign-manager.herokuapp.com/api/health
# Should return: { redis: "connected" }

# Check list API
curl https://campaign-manager.herokuapp.com/api/lists
# Should return: { success: true, lists: [...] }

# Check suppression API
curl https://campaign-manager.herokuapp.com/api/suppression/stats
# Should return: { success: true, stats: {...} }
```

### 2. Cache Verification

```bash
# Connect to Redis
heroku redis:cli --app campaign-manager-production

# Check for cached data (after syncing a list)
redis> KEYS list:metadata:*
redis> KEYS suppression:contact:*
redis> TTL list:metadata:some-uuid  # Should show ~3600 (1 hour)
```

### 3. Queue Verification

```bash
# Check Bull Queue dashboard (if installed)
# Or check logs
heroku logs --dyno worker --grep "LifecycleQueue" --tail

# Should see:
# [LifecycleQueue] Processing list-maintenance job
# [ListMaintenanceOrchestrator] Starting post-campaign maintenance
# [OptimizationAgent] Generating suppression plan
# [ListMaintenanceOrchestrator] Maintenance completed
```

### 4. Database Verification

```sql
-- Check maintenance logs
SELECT
  id,
  campaign_schedule_id,
  maintenance_type,
  contacts_suppressed,
  ai_recommendation,
  ai_confidence,
  status,
  executed_at
FROM list_maintenance_logs
ORDER BY executed_at DESC
LIMIT 5;

-- Check suppressions
SELECT
  COUNT(*) as total_suppressions,
  suppressed_by,
  reason
FROM suppression_history
WHERE is_active = true
GROUP BY suppressed_by, reason;
```

---

## Rollback Plan

If issues occur, rollback the deployment:

### Option 1: Code Rollback (Preserves Data)

```bash
# Revert to previous release
heroku releases --app campaign-manager-production
heroku rollback v123 --app campaign-manager-production

# Stage 6 jobs will fail gracefully (logged but not blocking)
```

### Option 2: Disable Stage 6 (Keep Code)

```typescript
// In lifecycle-scheduler.ts, comment out:
/*
const listMaintenanceJob = await lifecycleQueue.add(
  'list-maintenance',
  { ... },
  { ... }
);
*/

// Redeploy
```

### Option 3: Database Rollback (Last Resort)

```bash
# Create backup first!
heroku pg:backups:capture --app campaign-manager-production

# Revert migration
npx prisma migrate resolve --rolled-back 20251002XXXXXX_add_list_management_models

# Drop tables manually if needed
```

---

## Monitoring

### Key Metrics to Track

**Stage 6 Execution:**
```bash
# Success rate
heroku logs --dyno worker --grep "list-maintenance" | grep "completed"

# Failures
heroku logs --dyno worker --grep "list-maintenance" | grep "failed"

# AI confidence scores
heroku logs --dyno worker --grep "aiConfidence"
```

**Suppressions:**
```sql
-- Daily suppression count
SELECT
  DATE(suppressed_at) as date,
  COUNT(*) as suppressions,
  suppressed_by
FROM suppression_history
WHERE suppressed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(suppressed_at), suppressed_by
ORDER BY date DESC;
```

**List Health:**
```sql
-- Recent health snapshots
SELECT
  l.name,
  h.health_score,
  h.health_grade,
  h.bounce_rate,
  h.checked_at
FROM list_health_snapshots h
JOIN contact_lists l ON l.id = h.list_id
ORDER BY h.checked_at DESC
LIMIT 10;
```

### Alerts to Configure

**Critical:**
- Stage 6 job failures (> 10% failure rate)
- AI confidence < 0.3 (unreliable recommendations)
- Suppression spike (> 50% increase day-over-day)

**Warning:**
- Cache miss rate > 20%
- List maintenance duration > 5 minutes
- Rebalancing required but not executed

**Info:**
- Daily suppression summary
- Weekly list health report

---

## Troubleshooting

### Issue: Stage 6 Jobs Not Running

**Symptoms:**
- No `list-maintenance` jobs in queue
- T+24h passes but maintenance doesn't execute

**Debug:**
```bash
# Check if job was scheduled
curl /api/lifecycle/campaigns/{id}/jobs

# Check worker logs
heroku logs --dyno worker --grep "list-maintenance"

# Verify Redis connection
heroku redis:cli --app campaign-manager
redis> PING  # Should return PONG
```

**Solutions:**
1. Restart worker dyno: `heroku restart worker`
2. Check Redis quota: `heroku redis:info`
3. Manually trigger: `POST /api/lifecycle/campaigns/{id}/maintenance`

### Issue: AI Recommendations Incorrect

**Symptoms:**
- Too many contacts suppressed
- Confidence scores very low (<0.3)
- Suppressions reversed frequently

**Debug:**
```bash
# Check AI response
heroku logs --dyno worker --grep "OptimizationAgent"

# Review maintenance log
SELECT ai_recommendation, ai_confidence, suppression_plan
FROM list_maintenance_logs
WHERE id = {log_id};
```

**Solutions:**
1. Verify Gemini API key valid
2. Check bounce data accuracy from MailJet
3. Review AI prompts in `optimization-agent.ts`
4. Adjust confidence thresholds if needed

### Issue: Cache Not Working

**Symptoms:**
- Slow list health queries
- High MailJet API usage
- Redis keys not found

**Debug:**
```bash
# Check Redis
heroku redis:cli
redis> KEYS list:*
redis> GET list:metadata:{uuid}
redis> TTL list:metadata:{uuid}
```

**Solutions:**
1. Verify `REDIS_URL` environment variable
2. Check Redis connection in logs
3. Manually invalidate cache: `redis> DEL list:metadata:{uuid}`
4. Restart app to reconnect

### Issue: Migration Fails

**Symptoms:**
- Migration errors
- Tables not created
- Enum conflicts

**Debug:**
```bash
# Check migration status
npx prisma migrate status

# View migration SQL
cat prisma/migrations/*/migration.sql
```

**Solutions:**
1. Check for existing enum conflicts
2. Run in transaction: `npx prisma migrate deploy`
3. Manual SQL fix if needed
4. Backup and reset: `npx prisma migrate reset` (dev only!)

---

## Testing Checklist

After deployment, verify:

- [ ] All 6 list management tables exist
- [ ] Enums created (ListType, ContactStatus, MaintenanceAction)
- [ ] Master list and 3 campaign lists created
- [ ] Suppression list created
- [ ] Stage 6 job scheduled with lifecycle campaigns
- [ ] Redis cache working (check keys)
- [ ] API endpoints responding
- [ ] Worker processing list-maintenance jobs
- [ ] AI agents returning valid recommendations
- [ ] Maintenance logs being created
- [ ] Suppressions executing correctly

---

## Success Criteria

Deployment is successful when:

✅ Database migration completed without errors
✅ All API endpoints return 200/201 status
✅ Stage 6 jobs scheduled automatically
✅ Worker processes list-maintenance jobs
✅ AI confidence scores > 0.7 average
✅ Suppressions logged with rationale
✅ Cache hit rate > 70%
✅ No critical errors in logs for 24h

---

## Support

**Documentation:**
- [Feature README](./LIST_MANAGEMENT_README.md)
- [Brainstorm](./00_brainstorm.md)
- [Lifecycle Docs](../lifecycle/IMPLEMENTATION_SUMMARY.md)

**Logs:**
```bash
# All list management activity
heroku logs --app campaign-manager --grep "List" --tail

# AI decisions
heroku logs --app campaign-manager --grep "Agent" --tail

# Stage 6 execution
heroku logs --app campaign-manager --grep "list-maintenance" --tail
```

---

**Last Updated**: 2025-10-02
**Version**: 1.0
