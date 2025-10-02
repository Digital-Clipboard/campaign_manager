# Campaign Lifecycle - Staging Deployment Checklist

**Status:** Ready to Deploy
**Branch:** staging
**Commit:** cb349ac - feat: Complete Campaign Lifecycle Implementation

---

## Pre-Deployment Checklist

### ✅ Code Ready
- [x] All lifecycle features implemented (Phases 1-5)
- [x] Unit tests written
- [x] Integration tests prepared
- [x] Documentation complete
- [x] Code committed to staging branch
- [x] package.json updated with worker script
- [x] Procfile configured (web + worker + release)

### Prerequisites
- [ ] Heroku CLI installed (`brew install heroku/brew/heroku`)
- [ ] Heroku account access
- [ ] Google Gemini API key
- [ ] MailJet Agent credentials
- [ ] Slack Manager credentials
- [ ] Slack #lifecycle-campaigns channel created

---

## Deployment Steps

### Step 1: Install Heroku CLI (if needed)

```bash
# On macOS
brew tap heroku/brew && brew install heroku

# Verify installation
heroku --version

# Login
heroku login
```

### Step 2: Create Heroku Staging App

```bash
cd "/Users/brianjames/Library/Mobile Documents/com~apple~CloudDocs/Drive/digital_clipboard/00_traction/campaign_manager"

# Create staging app
heroku create campaign-manager-staging

# Or if name is taken, use:
heroku create your-unique-name-staging
```

### Step 3: Add PostgreSQL Database

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:standard-0 --app campaign-manager-staging

# Wait for provisioning (takes ~2 minutes)
heroku pg:wait --app campaign-manager-staging

# Verify database
heroku pg:info --app campaign-manager-staging
```

### Step 4: Add Redis for Queue

```bash
# Add Heroku Redis
heroku addons:create heroku-redis:premium-0 --app campaign-manager-staging

# Wait for provisioning
heroku redis:wait --app campaign-manager-staging

# Verify Redis
heroku redis:info --app campaign-manager-staging
```

### Step 5: Configure Environment Variables

```bash
# Google Gemini API
heroku config:set GEMINI_API_KEY="your_gemini_api_key_here" --app campaign-manager-staging

# MailJet Agent MCP Server
heroku config:set MAILJET_AGENT_URL="https://mailjet-agent-prod.herokuapp.com" --app campaign-manager-staging
heroku config:set MAILJET_AGENT_API_KEY="your_mailjet_api_key" --app campaign-manager-staging

# Slack Manager MCP Server
heroku config:set SLACK_MANAGER_URL="https://slack-manager-prod.herokuapp.com" --app campaign-manager-staging
heroku config:set SLACK_MANAGER_API_KEY="your_slack_api_key" --app campaign-manager-staging
heroku config:set SLACK_LIFECYCLE_CHANNEL="lifecycle-campaigns" --app campaign-manager-staging

# Application Config
heroku config:set NODE_ENV="production" --app campaign-manager-staging
heroku config:set APP_URL="https://campaign-manager-staging.herokuapp.com" --app campaign-manager-staging
heroku config:set LOG_LEVEL="info" --app campaign-manager-staging

# Verify all config
heroku config --app campaign-manager-staging
```

### Step 6: Add Heroku Git Remote

```bash
# Add staging remote
heroku git:remote -a campaign-manager-staging -r heroku-staging

# Verify remotes
git remote -v
```

### Step 7: Deploy to Staging

```bash
# Push staging branch to Heroku
git push heroku-staging staging:main

# Monitor deployment
heroku logs --tail --app campaign-manager-staging
```

**Expected Output:**
- Build starts
- Dependencies installed
- TypeScript compiled
- Prisma generates client
- Migration runs (release phase)
- Web dyno starts
- Ready to serve traffic

### Step 8: Run Database Migrations

```bash
# Migrations should run automatically via release phase in Procfile
# But verify they completed:
heroku run "npx prisma migrate status" --app campaign-manager-staging

# If needed, run manually:
heroku run "npm run db:deploy" --app campaign-manager-staging
```

### Step 9: Start Worker Dyno

```bash
# Scale worker dyno
heroku ps:scale worker=1 --app campaign-manager-staging

# Verify dynos are running
heroku ps --app campaign-manager-staging
```

**Expected Output:**
```
=== web (Standard-1X): npm start
web.1: up 2025/10/01 22:00:00 -0700 (~ 1m ago)

=== worker (Standard-1X): npm run worker
worker.1: up 2025/10/01 22:01:00 -0700 (~ 30s ago)
```

### Step 10: Verify Deployment

```bash
# Check application health
curl https://campaign-manager-staging.herokuapp.com/api/health

# Check logs for any errors
heroku logs --tail --app campaign-manager-staging

# Check worker is processing
heroku logs --tail --dyno worker --app campaign-manager-staging
```

---

## Post-Deployment Verification

### Test 1: API Availability

```bash
# Health check
curl https://campaign-manager-staging.herokuapp.com/api/health

# Expected: {"status":"healthy","timestamp":"..."}
```

### Test 2: Database Connection

```bash
# Connect to database
heroku pg:psql --app campaign-manager-staging

# Run query
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'lifecycle_%';

# Expected: 3 tables
# lifecycle_campaign_schedules
# lifecycle_campaign_metrics
# lifecycle_notification_logs

\q
```

### Test 3: Redis Connection

```bash
# Check Redis stats
heroku redis:cli --app campaign-manager-staging

# In Redis CLI:
INFO stats
QUIT
```

### Test 4: Create Test Campaign

```bash
curl -X POST https://campaign-manager-staging.herokuapp.com/api/lifecycle/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Staging Test Campaign",
    "listIdPrefix": "staging_test",
    "subject": "Test Email - Please Ignore",
    "senderName": "Test Team",
    "senderEmail": "test@yourdomain.com",
    "totalRecipients": 300,
    "mailjetListIds": [12345, 12346, 12347],
    "mailjetDraftId": 99999
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Campaign 'Staging Test Campaign' created with 3 rounds",
  "schedules": [
    {"id": 1, "roundNumber": 1, "scheduledDate": "..."},
    {"id": 2, "roundNumber": 2, "scheduledDate": "..."},
    {"id": 3, "roundNumber": 3, "scheduledDate": "..."}
  ],
  "scheduledJobs": [...]
}
```

### Test 5: Check Campaign Status

```bash
curl https://campaign-manager-staging.herokuapp.com/api/lifecycle/campaigns/Staging%20Test%20Campaign
```

**Expected Response:**
```json
{
  "campaignName": "Staging Test Campaign",
  "rounds": [
    {
      "roundNumber": 1,
      "scheduledDate": "...",
      "status": "SCHEDULED",
      "recipientCount": 100,
      "notificationStatus": {...}
    },
    ...
  ]
}
```

### Test 6: Verify Slack Notification

Check the #lifecycle-campaigns channel in Slack. You should see:
- ✅ Pre-Launch notification for all 3 rounds
- Rich Block Kit formatting
- Campaign details displayed correctly

### Test 7: Check Queue Jobs

```bash
# Install Bull Board for queue monitoring (optional but recommended)
# Or check via Heroku run:

heroku run node --app campaign-manager-staging
> const Bull = require('bull');
> const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
> queue.getJobCounts().then(console.log);
> .exit
```

**Expected Output:**
```json
{
  "waiting": 15,  // 3 rounds × 5 stages = 15 jobs
  "active": 0,
  "completed": 0,
  "failed": 0,
  "delayed": 15
}
```

---

## Monitoring Setup

### Add Logging (Recommended)

```bash
# Add Papertrail for log aggregation
heroku addons:create papertrail:choklad --app campaign-manager-staging

# View logs
heroku addons:open papertrail --app campaign-manager-staging
```

### Add Error Tracking (Optional)

```bash
# If using Sentry
heroku config:set SENTRY_DSN="your_sentry_dsn" --app campaign-manager-staging
```

### Set Up Bull Board (Optional)

Add to your `src/api/server.ts`:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { lifecycleQueue } from '@/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(lifecycleQueue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `https://campaign-manager-staging.herokuapp.com/admin/queues`

---

## Troubleshooting

### Issue: Build Fails

**Check:**
```bash
heroku logs --tail --app campaign-manager-staging
```

**Common Causes:**
- Missing dependencies in package.json
- TypeScript compilation errors
- Prisma schema issues

**Fix:**
```bash
# Test build locally
npm run build

# If successful, push again
git push heroku-staging staging:main
```

### Issue: Migrations Fail

**Check:**
```bash
heroku logs --app campaign-manager-staging | grep -i "migration"
```

**Fix:**
```bash
# Run migrations manually
heroku run "npx prisma migrate deploy" --app campaign-manager-staging

# Reset if needed (WARNING: destroys data)
heroku run "npx prisma migrate reset --force" --app campaign-manager-staging
```

### Issue: Worker Not Starting

**Check:**
```bash
heroku ps --app campaign-manager-staging
heroku logs --dyno worker --app campaign-manager-staging
```

**Fix:**
```bash
# Restart worker
heroku ps:restart worker --app campaign-manager-staging

# Scale down and up
heroku ps:scale worker=0 --app campaign-manager-staging
heroku ps:scale worker=1 --app campaign-manager-staging
```

### Issue: Jobs Not Scheduling

**Check:**
```bash
# Verify Redis connection
heroku redis:info --app campaign-manager-staging

# Check queue
heroku run node --app campaign-manager-staging
> const Bull = require('bull');
> const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
> queue.getJobs(['waiting', 'delayed']).then(jobs => console.log(jobs.length));
```

**Fix:**
- Verify REDIS_URL is set correctly
- Check worker logs for errors
- Restart worker dyno

### Issue: Slack Notifications Not Sending

**Check:**
```bash
# Verify Slack config
heroku config:get SLACK_MANAGER_API_KEY --app campaign-manager-staging
heroku config:get SLACK_LIFECYCLE_CHANNEL --app campaign-manager-staging

# Check notification logs
heroku pg:psql --app campaign-manager-staging
> SELECT * FROM lifecycle_notification_logs WHERE status = 'FAILURE';
```

**Fix:**
- Verify Slack channel exists
- Check Slack Manager MCP server is accessible
- Verify API key is correct
- Check bot has permission to post in channel

---

## Rollback Plan

If deployment fails and needs rollback:

```bash
# Rollback to previous release
heroku rollback --app campaign-manager-staging

# Or rollback to specific version
heroku releases --app campaign-manager-staging
heroku rollback v123 --app campaign-manager-staging

# Scale down worker during rollback
heroku ps:scale worker=0 --app campaign-manager-staging
```

---

## Success Criteria

Deployment is successful when:

- [x] Web dyno is up and responding
- [x] Worker dyno is running and processing jobs
- [x] Database migrations completed
- [x] Redis is connected
- [x] Test campaign created successfully
- [x] Jobs scheduled in queue (15 jobs for 3 rounds)
- [x] Pre-Launch Slack notifications sent
- [x] API endpoints responding
- [x] No errors in logs

---

## Next Steps After Successful Deployment

1. **Monitor First 24 Hours**
   - Watch logs for errors
   - Check queue job processing
   - Verify notifications are sending

2. **Test Full Lifecycle**
   - Create campaign with near-future launch time
   - Verify all 5 stages execute correctly
   - Check AI analysis quality
   - Review Slack notification formatting

3. **Performance Tuning**
   - Monitor dyno metrics
   - Adjust queue concurrency if needed
   - Optimize database queries if slow

4. **Documentation Updates**
   - Document any issues encountered
   - Update deployment guide with learnings
   - Create operational runbook

5. **Production Deployment Planning**
   - Review staging performance
   - Plan production rollout
   - Prepare production configuration

---

## Support

- **Documentation:** `docs/lifecycle/`
- **Deployment Guide:** `docs/lifecycle/DEPLOYMENT_GUIDE.md`
- **Troubleshooting:** See above section

---

**Deployment Date:** October 1, 2025
**Deployed By:** [Your Name]
**Status:** ⏳ Ready to Deploy

---

*After completing deployment, update the status above and add notes on any issues or learnings.*
