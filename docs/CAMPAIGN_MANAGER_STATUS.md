# Campaign Manager - System Status & Capabilities
**Date**: October 2, 2025
**Version**: Production v23 / Staging v30
**Status**: ✅ OPERATIONAL (Memory leak resolved)

---

## 🎯 Executive Summary

### Current Status
- **Production**: ✅ Running (v23 - memory leak fix deployed)
- **Memory Usage**: 🟢 HEALTHY (~200-350MB, down from 600-700MB)
- **R14 Errors**: ✅ ELIMINATED
- **Active Campaigns**: 0 currently scheduled
- **API Availability**: ✅ All endpoints operational

### Recent Critical Fixes (Oct 2, 2025)
1. ✅ **Memory Leak Eliminated** - 60-70% reduction via Prisma singleton
2. ✅ **Framework Alignment** - Lifecycle routes converted to Fastify
3. ✅ **Scheduler Conflicts Resolved** - Removed duplicate systems
4. ✅ **List Management** - Comprehensive contact/suppression system added

---

## 📡 Available API Endpoints

### Base URL
- **Staging**: `https://campaign-manager-staging-087b1925d6ef.herokuapp.com`
- **Production**: `https://campaign-manager-prod-[hash].herokuapp.com`

### 🔄 Lifecycle Campaign API (`/api/lifecycle`)

#### 1. **Create Campaign** (3-Round System)
```http
POST /api/lifecycle/campaigns
Content-Type: application/json

{
  "campaignName": "Client Letter Automation",
  "listIdPrefix": "client-letter",
  "subject": "Important Update for {{first_name}}",
  "senderName": "Digital Clipboard",
  "senderEmail": "hello@digitalclipboard.com",
  "totalRecipients": 1500,
  "mailjetListIds": [12345, 12346, 12347],  // 3 list IDs for 3 rounds
  "mailjetTemplateId": 67890,
  "notificationChannel": "#_traction"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Campaign created with 3 scheduled rounds",
  "schedules": [
    {
      "id": 1,
      "roundNumber": 1,
      "scheduledDate": "2025-10-15T09:00:00Z",
      "status": "SCHEDULED"
    },
    {
      "id": 2,
      "roundNumber": 2,
      "scheduledDate": "2025-10-22T09:00:00Z",
      "status": "SCHEDULED"
    },
    {
      "id": 3,
      "roundNumber": 3,
      "scheduledDate": "2025-10-29T09:00:00Z",
      "status": "SCHEDULED"
    }
  ],
  "scheduledJobs": [...]
}
```

#### 2. **Get Campaign Status**
```http
GET /api/lifecycle/campaigns/:campaignName
```

**Example**:
```bash
curl "https://campaign-manager-staging.herokuapp.com/api/lifecycle/campaigns/Client%20Letter%20Automation"
```

**Response**:
```json
{
  "campaignName": "Client Letter Automation",
  "rounds": [
    {
      "roundNumber": 1,
      "scheduleId": 1,
      "scheduledDate": "2025-10-15",
      "scheduledTime": "09:00",
      "status": "SENT",
      "recipientCount": 500,
      "mailjetCampaignId": "12345678",
      "metrics": {
        "sent": 500,
        "delivered": 485,
        "bounced": 15,
        "opened": 320,
        "clicked": 45
      }
    },
    {
      "roundNumber": 2,
      "scheduleId": 2,
      "scheduledDate": "2025-10-22",
      "scheduledTime": "09:00",
      "status": "SCHEDULED",
      "recipientCount": 500
    },
    {
      "roundNumber": 3,
      "scheduleId": 3,
      "scheduledDate": "2025-10-29",
      "scheduledTime": "09:00",
      "status": "SCHEDULED",
      "recipientCount": 500
    }
  ]
}
```

#### 3. **Run Pre-Flight Verification**
```http
POST /api/lifecycle/campaigns/:scheduleId/preflight
```

Verifies:
- MailJet list exists and has contacts
- Template is active
- Sender email is validated
- No scheduling conflicts
- List size matches expected recipients

#### 4. **Manual Launch**
```http
POST /api/lifecycle/campaigns/:scheduleId/launch
Content-Type: application/json

{
  "skipPreFlight": false  // optional, defaults to false
}
```

#### 5. **Run Wrap-Up Analysis**
```http
POST /api/lifecycle/campaigns/:scheduleId/wrapup
```

Collects:
- Delivery metrics from MailJet
- AI-powered performance analysis
- Recommendations for future campaigns

#### 6. **Cancel Campaign**
```http
DELETE /api/lifecycle/campaigns/:scheduleId
Content-Type: application/json

{
  "reason": "Business requirements changed"
}
```

#### 7. **Get Scheduled Jobs**
```http
GET /api/lifecycle/campaigns/:scheduleId/jobs
```

Returns all Bull queue jobs for a campaign:
- Pre-Launch notification
- Pre-Flight verification
- Launch warning (T-5min)
- Campaign launch
- Wrap-up analysis (T+30min)

#### 8. **Reschedule Campaign**
```http
PUT /api/lifecycle/campaigns/:scheduleId/reschedule
Content-Type: application/json

{
  "scheduledDate": "2025-11-05",
  "scheduledTime": "14:00"
}
```

---

## 📊 Campaign Lifecycle Workflow

### Automated Notification Timeline

For a campaign scheduled at **Tuesday 9:00 AM UTC**:

| Time | Event | Notification | Channel |
|------|-------|-------------|---------|
| **Monday 9:00 AM** | Pre-Launch (T-24h) | "Campaign launching in 24 hours" | #_traction |
| **Tuesday 8:00 AM** | Pre-Flight (T-1h) | "Running final verifications" | #_traction |
| **Tuesday 8:55 AM** | Launch Warning (T-5min) | "⚠️ Launching in 5 minutes!" | #_traction |
| **Tuesday 9:00 AM** | **LAUNCH** | "🚀 Campaign launched!" | #_traction |
| **Tuesday 9:30 AM** | Wrap-Up (T+30min) | "📊 Delivery metrics + AI analysis" | #_traction |

### Campaign Statuses

```
SCHEDULED → READY → LAUNCHING → SENT → COMPLETED
           ↓
        BLOCKED (if pre-flight fails)
           ↓
        CANCELLED (manual intervention)
```

---

## 📅 Expected Weekly Schedule (When Active)

### Typical 3-Round Campaign Pattern

**Week 1**: Round 1 - Tuesday 9:00 AM UTC
**Week 2**: Round 2 - Tuesday 9:00 AM UTC
**Week 3**: Round 3 - Tuesday 9:00 AM UTC

Each round targets ~33% of total list:
- Total: 1,500 contacts
- Round 1: 500 contacts (MailJet List A)
- Round 2: 500 contacts (MailJet List B)
- Round 3: 500 contacts (MailJet List C)

### #_traction Channel Activity

**Daily**: Health checks, system monitoring
**Campaign Weeks**: 5 notifications per round (Pre-Launch, Pre-Flight, Warning, Launch, Wrap-Up)
**Ad-Hoc**: Manual campaign triggers, error alerts, system updates

---

## 🗄️ List Management API (`/api/lists`)

### Contact Management
```http
GET    /api/lists/contacts                    # List all contacts
POST   /api/lists/contacts                    # Create contact
GET    /api/lists/contacts/:id                # Get contact details
PUT    /api/lists/contacts/:id                # Update contact
DELETE /api/lists/contacts/:id                # Delete contact
POST   /api/lists/contacts/bulk-import        # Bulk import from CSV
POST   /api/lists/contacts/:id/subscribe      # Subscribe to list
POST   /api/lists/contacts/:id/unsubscribe    # Unsubscribe from list
```

### List Management
```http
GET    /api/lists                             # Get all lists
POST   /api/lists                             # Create list
GET    /api/lists/:id                         # Get list details
PUT    /api/lists/:id                         # Update list
DELETE /api/lists/:id                         # Delete list
POST   /api/lists/:id/sync                    # Sync with MailJet
GET    /api/lists/:id/health                  # Health metrics
POST   /api/lists/:id/optimize                # AI optimization
POST   /api/lists/:id/rebalance               # Rebalance segments
```

### Suppression Management
```http
GET    /api/lists/suppressions                # List all suppressions
POST   /api/lists/suppressions                # Add suppression
DELETE /api/lists/suppressions/:id            # Remove suppression
POST   /api/lists/suppressions/bulk-import    # Bulk import
POST   /api/lists/suppressions/check          # Check if email suppressed
```

---

## 🤖 MCP Integration Points

### Available MCP Servers (via Adapters)

#### 1. **MailJet Agent** (`mailjet-agent-client.ts`)
- Create/manage campaigns
- Send transactional emails
- Manage contact lists
- Retrieve delivery statistics
- Handle webhooks (bounce, spam, unsubscribe)

#### 2. **Slack Manager** (`slack-manager-client.ts`)
- Send notifications to channels
- Post campaign updates
- Handle interactive blocks
- Manage user mentions
- Format rich messages

#### 3. **Campaign Orchestrator MCP** (`/mcp` endpoint)
Tools available via `POST /mcp`:
- `createCampaign` - Start new 3-round campaign
- `updateCampaignStatus` - Change campaign status
- `getCampaignAnalytics` - Retrieve metrics
- `listCampaigns` - Query with filters
- `createTask` - Add campaign task
- `assignTask` - Delegate work
- `bulkCreateTasks` - Batch task creation
- `getTasksByStatus` - Filter tasks
- `getTeamAvailability` - Check capacity
- `submitForApproval` - Request review
- `processApproval` - Approve/reject
- `getDashboardMetrics` - System overview
- `getTrendAnalysis` - Historical data
- `exportDashboard` - Generate reports
- `sendNotification` - Alert users
- `getNotifications` - Check unread

---

## 📈 Monitoring & Health

### Health Endpoint
```http
GET /api/health
```

Returns:
- Database connectivity
- Redis connectivity
- Memory usage
- Queue status
- External service health

### Metrics Endpoints
```http
GET /api/dashboard/metrics              # System overview
GET /api/dashboard/campaigns            # Campaign performance
GET /api/dashboard/risks                # Risk assessment
GET /api/dashboard/trends               # Historical trends
```

---

## 🔧 System Architecture

### Dynos (Heroku)
- **Web** (Basic - 512MB): API server, Fastify framework
- **Worker** (Basic - 512MB): Bull queue processor

### Databases
- **PostgreSQL** (Essential-0): Main data store
- **Redis** (Mini): Bull queue & caching

### External Services
- **MailJet**: Email delivery platform
- **Slack**: Notification channel
- **Gemini AI**: Campaign analysis & optimization

### Memory Optimization
- ✅ Single Prisma client instance (singleton pattern)
- ✅ Optimized connection pool (5 connections)
- ✅ Graceful shutdown handling
- ✅ 60-70% memory reduction achieved

---

## 🚀 Current Campaign Status

### Active Campaigns
**Status**: No active campaigns currently scheduled

**Last Campaign**: Client Letter Automation
**Last Activity**: Investigation on October 2, 2025
**Outcome**: Held for review - potential Round 3 early send detected

### Upcoming Campaigns
**Status**: Awaiting new campaign creation via API

**To Schedule New Campaign**:
1. Use `POST /api/lifecycle/campaigns` endpoint
2. System will auto-schedule 3 rounds (weekly intervals)
3. Bull queue jobs will be created
4. Notifications will go to #_traction channel

---

## 📝 Key Files & Documentation

### Documentation
- `/docs/MEMORY_LEAK_ANALYSIS.md` - Memory optimization guide
- `/docs/CAMPAIGN_REVIEW_2025_10_02.md` - Recent campaign investigation
- `/docs/SCHEDULER_CONFLICT_ANALYSIS.md` - Scheduler consolidation
- `/docs/list_management/` - List management system docs

### Core Services
- `/src/services/lifecycle/campaign-orchestrator.service.ts` - Main orchestration
- `/src/services/lifecycle/notification.service.ts` - Slack notifications
- `/src/services/lists/` - Contact & list management
- `/src/lib/prisma.ts` - Database singleton

### API Routes
- `/src/api/routes/lifecycle.ts` - Campaign lifecycle (8 endpoints)
- `/src/api/routes/lists.ts` - List management
- `/src/api/routes/dashboard.ts` - Metrics & monitoring

### Queue Management
- `/src/queues/lifecycle-queue.ts` - Bull queue workers
- `/src/queues/lifecycle-scheduler.ts` - Job scheduling

---

## 🎯 Expected System Behavior

### Weekly Campaign Pattern (When Active)

**Monday**:
- Pre-Launch notifications sent (T-24h)
- Team aware of Tuesday launch

**Tuesday Morning**:
- 8:00 AM: Pre-Flight verification runs
- 8:55 AM: 5-minute warning
- 9:00 AM: Campaign launches to MailJet
- 9:00 AM: Slack confirmation posted
- 9:30 AM: Wrap-up metrics + AI analysis

**Tuesday Afternoon**:
- Metrics collection continues
- Delivery tracking active
- Bounce handling automated

**Rest of Week**:
- Passive monitoring
- Metrics aggregation
- Next round preparation

### #_traction Channel Updates

**Expected Frequency**:
- Campaign weeks: 5 messages per round (15/campaign total)
- Non-campaign weeks: Health checks only
- Emergency alerts: As needed

**Message Types**:
1. 🔔 Pre-Launch (24h notice)
2. ✅ Pre-Flight (verification results)
3. ⚠️ Launch Warning (5min countdown)
4. 🚀 Launch Confirmation (with MailJet ID)
5. 📊 Wrap-Up (metrics + AI analysis)

---

## 🔍 Visibility & Reporting

### How to Check Campaign Schedule

**Via API**:
```bash
# Get specific campaign status
curl "https://campaign-manager-prod.herokuapp.com/api/lifecycle/campaigns/Client%20Letter%20Automation"

# Check all scheduled jobs for a campaign
curl "https://campaign-manager-prod.herokuapp.com/api/lifecycle/campaigns/123/jobs"
```

**Via Slack**:
- Monitor #_traction channel for scheduled notifications
- Pre-Launch messages appear 24h before send

**Via Heroku**:
```bash
# Check queue status
heroku run "node -e \"require('./dist/queues/lifecycle-queue').lifecycleQueue.getJobs(['waiting', 'active', 'delayed']).then(console.log)\"" --app campaign-manager-prod
```

### Dashboard Metrics

Access via `/api/dashboard/metrics`:
- Active campaigns count
- Scheduled campaigns (next 30 days)
- Total recipients this month
- Delivery rate trends
- System health score

---

## ⚡ Quick Reference

### Create New Campaign
```bash
curl -X POST https://campaign-manager-prod.herokuapp.com/api/lifecycle/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Product Launch Q4",
    "listIdPrefix": "q4-launch",
    "subject": "Exciting Product Update",
    "senderName": "Digital Clipboard",
    "senderEmail": "hello@digitalclipboard.com",
    "totalRecipients": 2000,
    "mailjetListIds": [11111, 22222, 33333],
    "mailjetTemplateId": 99999,
    "notificationChannel": "#_traction"
  }'
```

### Check System Health
```bash
curl https://campaign-manager-prod.herokuapp.com/api/health
```

### Get Upcoming Schedule (Next 30 Days)
```bash
# Use dashboard metrics endpoint
curl https://campaign-manager-prod.herokuapp.com/api/dashboard/metrics
```

---

## 🎯 Summary

**Campaign Manager is**:
- ✅ Fully operational with memory leak resolved
- ✅ Ready to schedule new 3-round campaigns
- ✅ Posting automated notifications to #_traction
- ✅ Tracking delivery metrics via MailJet
- ✅ Providing AI-powered campaign analysis

**Current State**:
- 🟢 No active campaigns (awaiting creation)
- 🟢 All systems healthy
- 🟢 Memory usage optimized (200-350MB)
- 🟢 API endpoints operational

**To View Upcoming Schedule**:
1. Check #_traction channel for Pre-Launch notifications
2. Query `/api/lifecycle/campaigns/:campaignName` for specific campaigns
3. Use `/api/dashboard/metrics` for system-wide view

**Weekly Expectations** (when campaigns active):
- Tuesday morning launches (9:00 AM UTC)
- 5 Slack notifications per campaign round
- Automated metric collection and AI analysis
- 3-week campaign cycle (3 rounds, 1 per week)
