# List Management Documentation

**AI-Driven Email List Management System**

---

## Overview

This directory contains comprehensive documentation for the AI-driven list management system that automates contact list maintenance, bounce processing, and rebalancing for email campaigns.

### What This System Does

The list management system:

- **Automates** post-campaign bounce processing and contact suppression
- **Maintains** balanced distribution across three campaign lists
- **Monitors** list health proactively with weekly checks
- **Provides** AI-powered insights with full transparency
- **Logs** all decisions with rationale for audit trails

### Key Features

- 🤖 **4 AI Agents**: Health analysis, rebalancing, optimization, reporting
- 🔄 **3 Workflows**: Post-campaign maintenance, weekly health checks, pre-campaign validation
- 📊 **Real-time Monitoring**: Dashboards, alerts, and Slack notifications
- 🔒 **Safe Operations**: Rollback mechanisms, confidence thresholds, manual review
- 📈 **Measurable Impact**: Track bounce rates, list balance, and deliverability

---

## Documentation Structure

### Core Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [00_brainstorm.md](00_brainstorm.md) | Problem statement, vision, and initial concepts | All stakeholders |
| [01_workflow.md](01_workflow.md) | Visual workflows with sequence diagrams | Technical team, PMs |
| [02_architecture.md](02_architecture.md) | Technical architecture and design decisions | Engineers, architects |
| [03_feature_specification.md](03_feature_specification.md) | Detailed feature specs with AI prompts | Engineers, QA |
| [04_development_specification.md](04_development_specification.md) | Implementation details and code examples | Engineers |
| [05_tdd_specification.md](05_tdd_specification.md) | Test-driven development approach | Engineers, QA |
| [06_implementation_plan.md](06_implementation_plan.md) | Phased rollout strategy and timeline | All stakeholders |

### Quick Navigation

**For Stakeholders**: Start with [00_brainstorm.md](00_brainstorm.md) → [01_workflow.md](01_workflow.md) → [06_implementation_plan.md](06_implementation_plan.md)

**For Engineers**: Start with [02_architecture.md](02_architecture.md) → [04_development_specification.md](04_development_specification.md) → [05_tdd_specification.md](05_tdd_specification.md)

**For Product Managers**: Start with [03_feature_specification.md](03_feature_specification.md) → [06_implementation_plan.md](06_implementation_plan.md)

**For QA**: Start with [03_feature_specification.md](03_feature_specification.md) → [05_tdd_specification.md](05_tdd_specification.md)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Campaign Lifecycle                        │
│                                                               │
│  Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6  │
│  (Draft)   (Ready)   (Sched)   (Send)    (Sent)   (Maint)   │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         │ Triggers (T+24h)
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│           List Management Orchestrator (Stage 6)             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Post-Campaign Maintenance Workflow                  │   │
│  │                                                       │   │
│  │  1. Fetch Bounces → 2. AI Analysis → 3. Suppress →  │   │
│  │  4. Remove → 5. Rebalance → 6. Cache → 7. Log →     │   │
│  │  8. Notify                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ List Health    │  │ Optimization     │  │ Rebalancing │ │
│  │ Agent          │  │ Agent            │  │ Agent       │ │
│  │ (Temperature:  │  │ (Temperature:    │  │ (Temperature│ │
│  │  0.7)          │  │  0.3)            │  │  0.5)       │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
│           │                    │                    │        │
│           └────────────────────┼────────────────────┘        │
│                                │                             │
│                                ▼                             │
│                       ┌─────────────────┐                    │
│                       │ Reporting Agent │                    │
│                       │ (Temperature:   │                    │
│                       │  0.6)           │                    │
│                       └─────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Integrations                     │
│                                                               │
│  Mailjet API    Gemini 2.0    Redis Cache    Slack MCP      │
│  (Lists)        (AI)           (State)        (Notify)       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Runtime**: Node.js 20.x + TypeScript 5.3+
- **Framework**: Express 4.x
- **Database**: PostgreSQL 15+ + Prisma ORM
- **Cache**: Redis 7.x
- **AI**: Google Gemini 2.0 Flash API
- **Email**: Mailjet REST API v3
- **Notifications**: Slack MCP Server
- **Scheduler**: node-cron + Bull Queue
- **Deployment**: Heroku (web + worker dynos)

---

## AI Agents

### 1. List Health Agent
**Temperature**: 0.7 (Analytical)

Assesses the health of each email list based on bounce rates, delivery metrics, and trends.

**Inputs**:
- List size and target
- Bounce rates (hard/soft)
- Delivery rate
- Historical trends

**Outputs**:
- Health status (healthy | warning | critical)
- Specific concerns
- Risk factors
- Urgency level

### 2. Optimization Agent
**Temperature**: 0.3 (Conservative)

Determines which contacts should be suppressed based on bounce behavior.

**Suppression Criteria**:
- Hard bounces: Immediate suppression
- Soft bounces: 3+ bounces across 3 campaigns
- Pattern analysis for repeated issues

**Outputs**:
- Contacts to suppress
- Rationale for each decision
- Expected impact on deliverability

### 3. Rebalancing Agent
**Temperature**: 0.5 (Balanced)

Calculates optimal contact distribution across three campaign lists.

**Principles**:
- Maintain ±5% balance
- Preserve FIFO ordering
- Minimize unnecessary movements
- Backfill from master list when available

**Outputs**:
- Rebalancing required (yes/no)
- Target distribution
- Movement plan with rationale

### 4. Reporting Agent
**Temperature**: 0.6 (Creative)

Generates executive-level reports with clear summaries and recommendations.

**Report Sections**:
- Executive summary (2-3 sentences)
- Key metrics with trends
- Actions taken
- Recommendations
- Concerns and next steps

---

## Workflows

### Post-Campaign Maintenance Workflow
**Trigger**: 24 hours after campaign send
**Frequency**: Automatic (hourly check for eligible campaigns)
**Duration**: ~60 seconds

**Steps**:
1. Fetch bounce data from Mailjet
2. AI analysis of bounce patterns
3. Execute suppression plan
4. Remove contacts from lists
5. AI rebalancing analysis
6. Execute rebalancing movements
7. Update cache
8. Log all operations
9. Send Slack notification

### Weekly Health Check Workflow
**Trigger**: Every Monday at 10:00 AM UTC
**Frequency**: Weekly
**Duration**: ~30 seconds

**Steps**:
1. Collect current list state
2. AI health analysis for each list
3. Calculate balance metrics
4. Generate weekly report
5. Log health check
6. Send Slack summary

### Pre-Campaign Validation Workflow
**Trigger**: Stage 2 of campaign lifecycle
**Frequency**: Before each campaign
**Duration**: ~10 seconds

**Steps**:
1. Validate list balance
2. Check bounce rate thresholds
3. AI health assessment
4. Block if critical issues found
5. Proceed if healthy

---

## Database Schema

### New Models

#### ListMaintenanceLog
Tracks all maintenance operations with AI decisions and results.

**Key Fields**:
- `campaignScheduleId`: Related campaign
- `maintenanceType`: post_campaign | weekly_health | pre_campaign_validation
- `aiAssessments`: JSON with all AI agent outputs
- `beforeState` / `afterState`: List sizes before/after
- `contactsSuppressed` / `contactsRebalanced`: Counts
- `status`: success | partial_success | failed

#### ListHealthCheck
Weekly health check results with AI analysis.

**Key Fields**:
- `executedAt`: Check timestamp
- `*ListSize`: Sizes for all lists
- `balanceDeviation`: Percentage deviation
- `isBalanced`: Within ±5% threshold
- `healthAssessments`: AI analysis per list
- `urgency`: low | medium | high | critical

#### ContactSuppressionHistory
Audit trail of all suppressed contacts.

**Key Fields**:
- `contactId` / `email`: Contact identifiers
- `reason`: hard_bounce | soft_bounce_pattern | manual
- `aiRationale`: AI's explanation
- `aiConfidence`: Confidence score (0-1)
- `removedFromLists`: Which lists removed from

#### ContactListMembership
Cache of contact list membership for performance.

**Key Fields**:
- `contactId`: Unique contact
- `inCampaignList1/2/3`: Boolean flags
- `inSuppressionList`: Boolean flag
- `hardBounceCount` / `softBounceCount`: Bounce history

---

## Configuration

### Environment Variables

```bash
# AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Mailjet Configuration
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_secret
MAILJET_MASTER_LIST_ID=5776
MAILJET_CAMPAIGN_LIST_1_ID=10503497
MAILJET_CAMPAIGN_LIST_2_ID=10503498
MAILJET_CAMPAIGN_LIST_3_ID=10503499
MAILJET_SUPPRESSION_LIST_ID=10503500

# List Management Settings
LIST_BALANCE_THRESHOLD=5  # ±5%
LIST_MAINTENANCE_DELAY_HOURS=24
WEEKLY_HEALTH_CHECK_DAY=1  # Monday
WEEKLY_HEALTH_CHECK_HOUR=10  # 10 AM UTC

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600  # 1 hour

# Feature Flags
LIST_MANAGEMENT_ENABLED=true
```

### Scheduler Configuration

```typescript
// Post-campaign maintenance: Check every hour
cron.schedule('0 * * * *', async () => {
  await executePostCampaignMaintenanceJobs();
});

// Weekly health check: Every Monday at 10:00 AM UTC
cron.schedule('0 10 * * 1', async () => {
  await executeWeeklyHealthCheck();
});

// Cache refresh: Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  await refreshListCache();
});
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: 70%+ coverage
- **E2E Tests**: Critical paths only
- **Overall**: 75%+ code coverage

### Test Pyramid

```
           /\
          /  \
         / E2E \         ← 10% (Workflow tests)
        /--------\
       /          \
      / Integration \    ← 30% (Service + DB tests)
     /--------------\
    /                \
   /   Unit Tests     \  ← 60% (Pure logic tests)
  /--------------------\
```

### Key Test Scenarios

**Unit Tests**:
- AI agent response validation
- List balance calculations
- Suppression criteria logic
- Rebalancing algorithms

**Integration Tests**:
- Database operations
- External API interactions (Mailjet, Gemini)
- Cache behavior
- Workflow orchestration

**E2E Tests**:
- Complete post-campaign maintenance flow
- Weekly health check execution
- Concurrent job handling
- Error recovery and rollback

See [05_tdd_specification.md](05_tdd_specification.md) for complete testing documentation.

---

## Deployment

### Infrastructure

**Heroku Dynos**:
- `web`: Express API server
- `worker`: Scheduler and background jobs

**Add-ons**:
- Heroku Postgres (Standard-0 or higher)
- Heroku Redis (Premium-0 or higher)
- Heroku Scheduler (backup for critical jobs)

### Deployment Process

```bash
# 1. Deploy to staging
git push staging main

# 2. Run migrations
heroku run npm run migrate --app campaign-manager-staging

# 3. Scale worker dyno
heroku ps:scale worker=1 --app campaign-manager-staging

# 4. Verify logs
heroku logs --tail --dyno worker --app campaign-manager-staging

# 5. Deploy to production (after validation)
git push production main
heroku run npm run migrate --app campaign-manager
heroku ps:scale worker=1 --app campaign-manager
```

### Monitoring

**Dashboards**:
- Datadog: Real-time metrics and traces
- Heroku Metrics: Dyno health and throughput
- Sentry: Error tracking and alerting

**Key Metrics**:
- Job execution duration (P50, P95, P99)
- AI confidence scores
- Cache hit rate
- Error rate
- List balance deviation

**Alerts**:
- Job failure (PagerDuty)
- High bounce rate (Slack)
- List imbalance > 10% (Slack)
- AI confidence < 0.7 (Slack)

---

## Implementation Timeline

### 12-Week Phased Rollout

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| 1. Foundation | 2 weeks | Database schema, types | Prisma models, migrations |
| 2. Infrastructure | 2 weeks | External clients, cache | Mailjet, Gemini, Redis clients |
| 3. AI Agents | 3 weeks | 4 AI agents + orchestrator | Validated AI agents |
| 4. Workflows | 2 weeks | Workflow services | Post-campaign, weekly health |
| 5. Automation | 2 weeks | Schedulers, API | Worker dyno, cron jobs |
| 6. Production | 1 week | Launch and validation | Live system |

See [06_implementation_plan.md](06_implementation_plan.md) for detailed week-by-week plan.

---

## Success Metrics

### System Performance

- Post-campaign maintenance: < 60s (P95)
- Weekly health check: < 30s (P95)
- Cache hit rate: > 60%
- Uptime: > 99.9%
- Error rate: < 1%

### AI Quality

- List Health Agent accuracy: > 90%
- Optimization Agent false positive rate: < 5%
- Rebalancing Agent efficiency: < 10% contacts moved
- Average AI confidence: > 0.85
- JSON parsing success: > 99%

### Business Impact

- Bounce rate reduction: -20%
- List balance improvement: < 2% deviation
- Manual time saved: -80%
- Campaign send reliability: > 99%
- Stakeholder satisfaction: > 4/5

---

## Common Operations

### Manual Trigger Post-Campaign Maintenance

```bash
curl -X POST https://campaign-manager.herokuapp.com/api/list-management/trigger-maintenance \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaignId": 123}'
```

### Manual Trigger Weekly Health Check

```bash
curl -X POST https://campaign-manager.herokuapp.com/api/list-management/trigger-health-check \
  -H "Authorization: Bearer $API_TOKEN"
```

### View Recent Maintenance Logs

```bash
heroku pg:psql -a campaign-manager
> SELECT id, "maintenanceType", status, "contactsSuppressed", "contactsRebalanced"
  FROM "ListMaintenanceLog"
  ORDER BY "executedAt" DESC
  LIMIT 10;
```

### Check Redis Cache

```bash
heroku redis:cli -a campaign-manager
> KEYS list:*
> GET list:state
> TTL list:state
```

### View Scheduler Status

```bash
heroku logs --tail --dyno worker -a campaign-manager | grep "ListManagementScheduler"
```

---

## Troubleshooting

### Issue: Scheduler Not Running

**Symptoms**: No maintenance logs being created

**Diagnosis**:
```bash
heroku ps -a campaign-manager
# Check if worker dyno is running
```

**Fix**:
```bash
heroku ps:scale worker=1 -a campaign-manager
heroku restart worker -a campaign-manager
```

### Issue: AI Confidence Too Low

**Symptoms**: Notifications show confidence < 0.7

**Diagnosis**:
- Check AI agent logs for response format
- Review input data quality
- Check Gemini API status

**Fix**:
- Tune AI prompts (adjust system prompts)
- Add more context to inputs
- Increase temperature if too deterministic

### Issue: List Rebalancing Not Executing

**Symptoms**: Movements planned but not applied

**Diagnosis**:
```bash
# Check Mailjet API rate limits
heroku logs --tail -a campaign-manager | grep "Mailjet"
```

**Fix**:
- Implement exponential backoff
- Batch requests to stay under limits
- Queue movements for retry

### Issue: Cache Misses Too High

**Symptoms**: Slow performance, high DB load

**Diagnosis**:
```bash
heroku redis:cli -a campaign-manager
> INFO stats
# Check hit/miss ratio
```

**Fix**:
- Increase TTL (adjust CACHE_TTL_SECONDS)
- Warm cache after deployment
- Pre-fetch frequently accessed data

---

## Rollback Procedures

### Quick Rollback (< 5 minutes)

```bash
# 1. Stop schedulers
heroku ps:scale worker=0 -a campaign-manager

# 2. Disable feature
heroku config:set LIST_MANAGEMENT_ENABLED=false -a campaign-manager

# 3. Notify stakeholders
# Post to #_traction Slack channel
```

### Full Rollback (< 30 minutes)

```bash
# 1. Backup current state
heroku pg:backups:capture -a campaign-manager

# 2. Rollback application
heroku rollback -a campaign-manager

# 3. Rollback database migrations (if needed)
heroku run npm run migrate:rollback -a campaign-manager

# 4. Verify rollback
heroku logs --tail -a campaign-manager
```

See [06_implementation_plan.md](06_implementation_plan.md) for complete rollback procedures.

---

## FAQ

### How does the system handle Mailjet API failures?

The system implements:
- Exponential backoff with retries (3 attempts)
- Circuit breaker pattern
- Graceful degradation (continue without non-critical operations)
- Error logging to Sentry with context

### What happens if AI makes an incorrect decision?

Safety mechanisms:
- Confidence thresholds (< 0.7 triggers manual review)
- Max suppression limits (10% per campaign)
- Manual review workflow for first 2 weeks
- Rollback capability for rebalancing operations
- Complete audit trail with AI rationale

### Can I manually approve AI decisions?

Not in Phase 6, but planned for Phase 7:
- Slack action buttons for approve/reject
- Manual review dashboard
- Override capability for edge cases

### How is FIFO ordering preserved?

The system:
- Queries contacts with `ORDER BY created_at ASC`
- Moves contacts from later lists to earlier lists when possible
- Backfills new contacts only after internal rebalancing
- Logs movement reasons for audit

### What if Redis goes down?

Graceful degradation:
- System continues without cache
- Falls back to direct database queries
- Performance slower but functional
- Alerts sent to on-call engineer

### How do I test AI agents without production data?

Use test fixtures:
```typescript
import bounceData from 'tests/fixtures/bounce-data.json';
import listStates from 'tests/fixtures/list-states.json';

const result = await agent.analyze(listStates.balanced);
```

See [05_tdd_specification.md](05_tdd_specification.md) for test data.

---

## Resources

### Internal Links

- [Campaign Manager Main Docs](../README.md)
- [Campaign Lifecycle Documentation](../lifecycle/README.md)
- [API Documentation](../../api/README.md)

### External Resources

- [Mailjet API Documentation](https://dev.mailjet.com/email/reference/)
- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)

### Team Contacts

- **Backend Lead**: [Contact info]
- **DevOps Lead**: [Contact info]
- **Product Manager**: [Contact info]
- **On-Call Rotation**: PagerDuty #campaign-manager

---

## Contributing

### Documentation Updates

When updating these docs:

1. Update the relevant document (00-06)
2. Update this README if structure changes
3. Update version numbers and dates
4. Get review from at least one other team member
5. Commit with descriptive message

### Code Contributions

Follow the implementation plan in [06_implementation_plan.md](06_implementation_plan.md):

1. Create feature branch from `develop`
2. Implement with TDD approach (write tests first)
3. Ensure code coverage > 75%
4. Update relevant documentation
5. Create PR with clear description
6. Get approval from 2+ reviewers
7. Merge to `develop`, then `main`

---

## Changelog

### Version 1.0 (October 1, 2025)
- Initial documentation release
- All 7 documents created (00-06 + README)
- Complete architecture, workflows, and implementation plan
- Ready for Phase 1 development

---

## License

Internal documentation - Campaign Manager Team

---

**Last Updated**: October 1, 2025
**Documentation Version**: 1.0
**Status**: ✅ Approved for Implementation
