# Campaign Lifecycle Deployment Guide

## Prerequisites

### Required Services
- **PostgreSQL 15+** - Database for campaign data and metrics
- **Redis 6+** - Queue backend for Bull
- **Google Gemini API** - AI analysis (Gemini 2.0 Flash)
- **MailJet Agent** - Email service integration
- **Slack Manager** - Slack notification service

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/campaign_manager?schema=public

# Redis
REDIS_URL=redis://:password@host:6379

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# MailJet Agent MCP Server
MAILJET_AGENT_URL=https://mailjet-agent-prod.herokuapp.com
MAILJET_AGENT_API_KEY=your_mailjet_api_key

# Slack Manager MCP Server
SLACK_MANAGER_URL=https://slack-manager-prod.herokuapp.com
SLACK_MANAGER_API_KEY=your_slack_api_key
SLACK_LIFECYCLE_CHANNEL=lifecycle-campaigns

# Application
NODE_ENV=production
PORT=3000
APP_URL=https://your-app.herokuapp.com

# Logging
LOG_LEVEL=info
```

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Local Database

```bash
# Start PostgreSQL (if using Docker)
docker run -d \
  --name campaign-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=campaign_manager_dev \
  -p 5432:5432 \
  postgres:15

# Run migrations
npx prisma migrate dev
```

### 3. Setup Local Redis

```bash
# Start Redis (if using Docker)
docker run -d \
  --name campaign-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 4. Create Slack Channel

Create a Slack channel named `#lifecycle-campaigns` (or your custom name) where notifications will be sent.

### 5. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 6. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Web server
npm run dev

# Terminal 2: Worker process
npm run worker:dev
```

The worker watches for lifecycle queue jobs and processes them in the background.

## Testing

### Run Unit Tests

```bash
npm test
```

### Run Integration Tests

```bash
# Make sure services are running
npm run test:integration
```

### Manual Testing

Create a test campaign:

```bash
curl -X POST http://localhost:3000/api/lifecycle/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Test Campaign",
    "listIdPrefix": "test",
    "subject": "Test Email",
    "senderName": "Test Team",
    "senderEmail": "test@example.com",
    "totalRecipients": 300,
    "mailjetListIds": [123456, 123457, 123458],
    "mailjetDraftId": 999999
  }'
```

Check campaign status:

```bash
curl http://localhost:3000/api/lifecycle/campaigns/Test%20Campaign
```

## Heroku Deployment

### 1. Create Heroku App

```bash
heroku create your-campaign-manager
```

### 2. Add Required Add-ons

```bash
# PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Redis
heroku addons:create heroku-redis:premium-0
```

### 3. Configure Environment Variables

```bash
# Google Gemini
heroku config:set GEMINI_API_KEY=your_api_key

# MailJet Agent
heroku config:set MAILJET_AGENT_URL=https://mailjet-agent-prod.herokuapp.com
heroku config:set MAILJET_AGENT_API_KEY=your_api_key

# Slack Manager
heroku config:set SLACK_MANAGER_URL=https://slack-manager-prod.herokuapp.com
heroku config:set SLACK_MANAGER_API_KEY=your_api_key
heroku config:set SLACK_LIFECYCLE_CHANNEL=lifecycle-campaigns

# Application
heroku config:set NODE_ENV=production
heroku config:set APP_URL=https://your-campaign-manager.herokuapp.com
```

### 4. Create Procfile

Create a `Procfile` in your project root:

```
web: npm start
worker: node dist/workers/lifecycle-worker.js
```

### 5. Update package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "worker": "node dist/workers/lifecycle-worker.js",
    "worker:dev": "ts-node-dev --respawn --transpile-only src/workers/lifecycle-worker.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "migrate": "npx prisma migrate deploy",
    "postinstall": "prisma generate"
  }
}
```

### 6. Deploy to Heroku

```bash
# Add Heroku remote
heroku git:remote -a your-campaign-manager

# Push code
git push heroku main

# Run migrations
heroku run npm run migrate

# Scale dynos
heroku ps:scale web=1 worker=1
```

### 7. Verify Deployment

```bash
# Check logs
heroku logs --tail

# Check dyno status
heroku ps

# Check queue status
heroku run node -e "
  const Bull = require('bull');
  const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
  queue.getJobCounts().then(console.log);
"
```

## Monitoring

### Queue Dashboard

Install Bull Board for queue monitoring:

```bash
npm install @bull-board/express @bull-board/api
```

Add to your Express app (`src/api/server.ts`):

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { lifecycleQueue } from '@/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(lifecycleQueue)],
  serverAdapter: serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `https://your-app.herokuapp.com/admin/queues`

### Logging

Configure log aggregation:

```bash
# Papertrail
heroku addons:create papertrail:choklad

# View logs
heroku addons:open papertrail
```

### Error Tracking

Set up Sentry:

```bash
npm install @sentry/node

# Configure in your app
heroku config:set SENTRY_DSN=your_sentry_dsn
```

### Health Checks

Add health check endpoints:

```typescript
// src/api/routes/health.ts
router.get('/health/worker', (req, res) => {
  const { getWorkerHealth } = require('@/workers/lifecycle-worker');
  res.json(getWorkerHealth());
});
```

Configure Heroku health checks:

```bash
heroku config:set HEALTHCHECK_PATH=/api/health
```

## Scaling

### Horizontal Scaling

Scale web dynos for API traffic:

```bash
heroku ps:scale web=2
```

Scale worker dynos for job processing:

```bash
heroku ps:scale worker=3
```

### Queue Concurrency

Adjust concurrency per worker in `lifecycle-queue.ts`:

```typescript
lifecycleQueue.process('preflight', 5, async (job) => {
  // Process with 5 concurrent jobs
});
```

### Redis Scaling

Upgrade Redis if queue grows large:

```bash
heroku addons:upgrade heroku-redis:premium-1
```

## Backup & Recovery

### Database Backups

```bash
# Manual backup
heroku pg:backups:capture

# Schedule automatic backups
heroku pg:backups:schedule DATABASE_URL --at '02:00 America/Los_Angeles'

# Download backup
heroku pg:backups:download
```

### Queue Recovery

If jobs fail, they're retained in Redis:

```bash
# Check failed jobs
heroku run node -e "
  const Bull = require('bull');
  const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
  queue.getFailed().then(jobs => console.log(jobs.length));
"

# Retry failed jobs
heroku run node -e "
  const Bull = require('bull');
  const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
  queue.getFailed().then(jobs =>
    Promise.all(jobs.map(job => job.retry()))
  );
"
```

## Troubleshooting

### Jobs Not Processing

1. **Check worker is running:**
   ```bash
   heroku ps
   ```

2. **Check Redis connection:**
   ```bash
   heroku config:get REDIS_URL
   heroku redis:info
   ```

3. **Check worker logs:**
   ```bash
   heroku logs --dyno=worker --tail
   ```

### Notifications Not Sending

1. **Check Slack channel exists:**
   - Verify `#lifecycle-campaigns` channel is created
   - Bot has permission to post

2. **Check Slack Manager credentials:**
   ```bash
   heroku config:get SLACK_MANAGER_API_KEY
   ```

3. **Check notification logs:**
   ```sql
   SELECT * FROM lifecycle_notification_logs
   WHERE status = 'FAILURE'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### AI Analysis Failing

1. **Check Gemini API key:**
   ```bash
   heroku config:get GEMINI_API_KEY
   ```

2. **Check rate limits:**
   - Gemini 2.0 Flash: 1,500 requests/day free tier
   - Upgrade if hitting limits

3. **Check logs for AI errors:**
   ```bash
   heroku logs --tail | grep "AI generation failed"
   ```

### Campaign Not Launching

1. **Check Pre-Flight status:**
   ```bash
   curl https://your-app.herokuapp.com/api/lifecycle/campaigns/SCHEDULE_ID/preflight
   ```

2. **Check MailJet configuration:**
   - Verify draft ID exists
   - Check list IDs are valid
   - Ensure API credentials work

3. **Manual launch override:**
   ```bash
   curl -X POST https://your-app.herokuapp.com/api/lifecycle/campaigns/SCHEDULE_ID/launch \
     -H "Content-Type: application/json" \
     -d '{"skipPreFlight": true}'
   ```

## Security

### API Authentication

Add authentication middleware:

```typescript
import { authenticateRequest } from '@/middleware/auth';

router.use('/api/lifecycle', authenticateRequest);
```

### Environment Variables

Never commit `.env` files. Use:

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### Rate Limiting

Add rate limiting to API:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/lifecycle', limiter);
```

## Performance Optimization

### Database Indexes

Already included in migration, but verify:

```sql
-- Check indexes
SELECT * FROM pg_indexes
WHERE tablename LIKE 'lifecycle_%';
```

### Query Optimization

Use Prisma query optimization:

```typescript
// Include only needed fields
const schedule = await prisma.lifecycleCampaignSchedule.findUnique({
  where: { id },
  select: {
    id: true,
    campaignName: true,
    status: true,
    // Only fields you need
  }
});
```

### Redis Memory

Monitor Redis memory usage:

```bash
heroku redis:info

# If memory grows too large, clear old completed jobs
heroku run node -e "
  const Bull = require('bull');
  const queue = new Bull('lifecycle-notifications', process.env.REDIS_URL);
  queue.clean(86400000); // Remove jobs older than 24h
"
```

## Maintenance

### Regular Tasks

**Weekly:**
- Review failed jobs in queue
- Check notification success rates
- Review AI analysis quality

**Monthly:**
- Database backup verification
- Redis memory cleanup
- Review and optimize slow queries

**Quarterly:**
- Update dependencies
- Review security patches
- Audit API usage and costs

### Database Maintenance

```bash
# Vacuum database
heroku pg:psql -c "VACUUM ANALYZE;"

# Check table sizes
heroku pg:psql -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## Support

For issues or questions:

1. Check logs: `heroku logs --tail`
2. Review documentation: `docs/lifecycle/`
3. Check GitHub issues
4. Contact platform team

## Next Steps After Deployment

1. **Create Test Campaign** - Verify end-to-end flow
2. **Monitor First Week** - Watch for errors, adjust as needed
3. **Tune AI Prompts** - Refine based on actual outputs
4. **Optimize Performance** - Based on real usage patterns
5. **Train Team** - Document processes, train users
