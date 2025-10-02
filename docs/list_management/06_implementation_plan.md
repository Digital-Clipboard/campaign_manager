# List Management - Implementation Plan

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Approved
- **Purpose**: Phased implementation plan for AI-driven list management system

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Implementation Phases](#implementation-phases)
3. [Phase 1: Foundation](#phase-1-foundation)
4. [Phase 2: Core Infrastructure](#phase-2-core-infrastructure)
5. [Phase 3: AI Agents](#phase-3-ai-agents)
6. [Phase 4: Workflow Services](#phase-4-workflow-services)
7. [Phase 5: Automation](#phase-5-automation)
8. [Phase 6: Production Launch](#phase-6-production-launch)
9. [Timeline](#timeline)
10. [Risk Management](#risk-management)
11. [Success Metrics](#success-metrics)
12. [Rollback Plan](#rollback-plan)

---

## Executive Summary

### Overview

This implementation plan outlines a **6-phase approach** to deploying the AI-driven list management system. The plan prioritizes **incremental delivery**, **risk mitigation**, and **continuous validation**.

### Key Principles

1. **Build Bottom-Up**: Start with database and infrastructure, end with user-facing features
2. **Validate Early**: Test each component thoroughly before moving to next phase
3. **Fail Safe**: Implement rollback mechanisms at every stage
4. **Monitor Constantly**: Track metrics and AI decisions from day one
5. **Iterate Quickly**: Use feedback loops to refine AI prompts and logic

### Total Timeline

**12 weeks** from start to production launch

```
Week 1-2:   Phase 1 - Foundation
Week 3-4:   Phase 2 - Core Infrastructure
Week 5-7:   Phase 3 - AI Agents
Week 8-9:   Phase 4 - Workflow Services
Week 10-11: Phase 5 - Automation
Week 12:    Phase 6 - Production Launch
```

### Team Requirements

| Role | Allocation | Responsibilities |
|------|------------|------------------|
| Backend Engineer | 100% | Database, services, API |
| DevOps Engineer | 50% | Infrastructure, deployment, monitoring |
| QA Engineer | 50% | Testing, validation, quality assurance |
| Product Manager | 25% | Requirements, priorities, stakeholder comms |

---

## Implementation Phases

### Phase Overview

```
┌─────────────┐
│   Phase 1   │  Foundation (Database, Prisma)
│  Foundation │
└──────┬──────┘
       │
┌──────▼──────────┐
│    Phase 2      │  Core Infrastructure (Redis, Mailjet, Gemini)
│ Infrastructure  │
└──────┬──────────┘
       │
┌──────▼──────────┐
│    Phase 3      │  AI Agents (4 agents + orchestrator)
│   AI Agents     │
└──────┬──────────┘
       │
┌──────▼──────────┐
│    Phase 4      │  Workflow Services (Post-campaign, Weekly health)
│   Workflows     │
└──────┬──────────┘
       │
┌──────▼──────────┐
│    Phase 5      │  Automation (Schedulers, jobs)
│  Automation     │
└──────┬──────────┘
       │
┌──────▼──────────┐
│    Phase 6      │  Production Launch (Monitoring, alerts)
│  Production     │
└─────────────────┘
```

---

## Phase 1: Foundation

### Duration: 2 weeks (Weeks 1-2)

### Objectives

- Set up database schema for list management
- Create Prisma models and migrations
- Establish testing infrastructure
- Define type definitions

### Tasks

#### Week 1: Database Schema

**Day 1-2: Schema Design**
- [ ] Review and finalize Prisma schema additions
- [ ] Create `ListMaintenanceLog` model
- [ ] Create `ListHealthCheck` model
- [ ] Create `ContactSuppressionHistory` model
- [ ] Create `ContactListMembership` model
- [ ] Add relationships to existing `CampaignSchedule` model

**Day 3-4: Migration**
- [ ] Generate Prisma migration SQL
- [ ] Test migration on local database
- [ ] Verify all indexes created correctly
- [ ] Test foreign key constraints
- [ ] Create rollback migration script

**Day 5: Testing Infrastructure**
- [ ] Set up Jest configuration
- [ ] Create test database helper
- [ ] Create test fixtures for list states
- [ ] Create test fixtures for bounce data
- [ ] Set up code coverage tools

#### Week 2: Type Definitions & Validation

**Day 1-2: TypeScript Types**
- [ ] Create `src/types/list-management.types.ts`
- [ ] Define all input/output interfaces
- [ ] Define AI agent response types
- [ ] Define workflow result types
- [ ] Add JSDoc comments

**Day 3-4: Database Seeding**
- [ ] Create seed script for test data
- [ ] Populate test campaigns
- [ ] Populate test bounce data
- [ ] Populate test contact memberships
- [ ] Verify seed data integrity

**Day 5: Validation**
- [ ] Write unit tests for type validators
- [ ] Test Prisma client queries
- [ ] Verify database constraints work
- [ ] Document schema decisions
- [ ] Team review and sign-off

### Deliverables

✅ Prisma schema updated with 4 new models
✅ Database migration scripts (forward + rollback)
✅ Type definitions for all list management entities
✅ Test infrastructure configured
✅ Seed data for development and testing

### Success Criteria

- [ ] All migrations run successfully on dev database
- [ ] 100% of type definitions have JSDoc comments
- [ ] Test infrastructure passes health check
- [ ] Team can query new tables via Prisma client

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema changes break existing queries | High | Thorough testing of existing campaign features |
| Migration fails on production | Critical | Test on production-like database first |
| Type definitions incomplete | Medium | Code review by 2+ engineers |

---

## Phase 2: Core Infrastructure

### Duration: 2 weeks (Weeks 3-4)

### Objectives

- Implement external service clients (Mailjet, Gemini, Redis)
- Build caching layer
- Create list operations service
- Establish monitoring and logging

### Tasks

#### Week 3: External Clients

**Day 1-2: Gemini Client**
- [ ] Implement `GeminiClient` class
- [ ] Add `generateCompletion()` method
- [ ] Add `generateJSON()` method with parsing
- [ ] Handle API errors and retries
- [ ] Write unit tests with mocked responses
- [ ] Test with real Gemini API calls

**Day 2-3: Mailjet Client Extensions**
- [ ] Extend existing `MailjetClient` class
- [ ] Add `getListContactCount()` method
- [ ] Add `addContactToList()` method
- [ ] Add `removeContactFromList()` method
- [ ] Add `fetchCampaignBounces()` method
- [ ] Add rate limiting (300 req/min)
- [ ] Write unit tests with mocked API

**Day 4-5: Redis Cache Client**
- [ ] Implement `RedisClient` class
- [ ] Add connection management with retries
- [ ] Add `get()`, `set()`, `del()` methods
- [ ] Add `getJSON()`, `setJSON()` helpers
- [ ] Handle connection failures gracefully
- [ ] Write unit tests with Redis mock

#### Week 4: Services & Monitoring

**Day 1-3: List Operations Service**
- [ ] Implement `ListOperationsService` class
- [ ] Add `getCurrentListState()` method
- [ ] Add `suppressContacts()` method
- [ ] Add `executeRebalancing()` method
- [ ] Add `calculateBalanceDeviation()` utility
- [ ] Add `isBalanced()` utility
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests with test database

**Day 3-4: List Cache Service**
- [ ] Implement `ListCacheService` class
- [ ] Add `cacheListState()` method
- [ ] Add `getListState()` method
- [ ] Add `cacheContactMembership()` method
- [ ] Add `updateContactMembership()` method
- [ ] Add `invalidateAll()` method
- [ ] Test cache-aside pattern
- [ ] Test TTL expiration (1 hour)

**Day 5: Logging & Monitoring**
- [ ] Set up structured logging (Winston/Pino)
- [ ] Add log correlation IDs
- [ ] Set up error tracking (Sentry)
- [ ] Configure log levels by environment
- [ ] Add performance timing logs
- [ ] Test log aggregation

### Deliverables

✅ `GeminiClient` with JSON parsing
✅ Extended `MailjetClient` with list operations
✅ `RedisClient` with connection management
✅ `ListOperationsService` with core methods
✅ `ListCacheService` with cache-aside pattern
✅ Structured logging and error tracking

### Success Criteria

- [ ] GeminiClient successfully calls Gemini API and parses JSON
- [ ] MailjetClient can fetch list counts and manage contacts
- [ ] Redis caching reduces database queries by 60%+
- [ ] ListOperationsService passes all unit tests
- [ ] All errors logged to Sentry with context

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini API rate limits hit | Medium | Implement exponential backoff, request queuing |
| Mailjet API downtime | High | Implement circuit breaker, fallback to cached data |
| Redis connection issues | Medium | Graceful degradation, continue without cache |
| Cache invalidation bugs | Medium | Conservative TTL (1 hour), manual invalidation API |

---

## Phase 3: AI Agents

### Duration: 3 weeks (Weeks 5-7)

### Objectives

- Implement all 4 AI agents
- Build orchestrator to coordinate agents
- Validate AI response quality
- Tune prompts for optimal results

### Tasks

#### Week 5: List Health & Optimization Agents

**Day 1-2: List Health Agent**
- [ ] Implement `ListHealthAgent` class
- [ ] Define system prompt (temperature: 0.7)
- [ ] Implement `analyze()` method
- [ ] Add response validation
- [ ] Write unit tests with mocked Gemini
- [ ] Test with real Gemini API
- [ ] Validate response quality (10 test cases)
- [ ] Tune prompt if confidence < 0.85

**Day 3-4: Optimization Agent**
- [ ] Implement `OptimizationAgent` class
- [ ] Define system prompt (temperature: 0.3)
- [ ] Implement `determineSuppression()` method
- [ ] Add suppression criteria logic
- [ ] Write unit tests
- [ ] Test with real bounce data
- [ ] Validate suppression decisions (accuracy > 95%)
- [ ] Tune prompt for conservative decisions

**Day 5: Integration Testing**
- [ ] Test List Health + Optimization together
- [ ] Verify consistent decision-making
- [ ] Test edge cases (zero bounces, all bounces)
- [ ] Performance test (response time < 5s)
- [ ] Document prompt engineering decisions

#### Week 6: Rebalancing & Reporting Agents

**Day 1-2: Rebalancing Agent**
- [ ] Implement `RebalancingAgent` class
- [ ] Define system prompt (temperature: 0.5)
- [ ] Implement `determineRebalancing()` method
- [ ] Add FIFO ordering logic
- [ ] Write unit tests
- [ ] Test with unbalanced distributions
- [ ] Validate movement plans (minimize movements)
- [ ] Tune prompt for optimal distribution

**Day 3-4: Reporting Agent**
- [ ] Implement `ReportingAgent` class
- [ ] Define system prompt (temperature: 0.6)
- [ ] Implement `generateReport()` method
- [ ] Add executive summary format
- [ ] Write unit tests
- [ ] Test with various scenarios
- [ ] Validate report clarity (stakeholder review)
- [ ] Tune prompt for concise summaries

**Day 5: Integration Testing**
- [ ] Test all 4 agents in sequence
- [ ] Verify output compatibility
- [ ] Test with real campaign data
- [ ] Performance test (total time < 20s)

#### Week 7: Orchestrator & Validation

**Day 1-3: List Management Orchestrator**
- [ ] Implement `ListManagementOrchestrator` class
- [ ] Add shared `GeminiClient` instance
- [ ] Implement `analyzePostCampaign()` workflow
- [ ] Implement `analyzeWeeklyHealth()` workflow
- [ ] Add error handling and retries
- [ ] Write integration tests
- [ ] Test complete workflows end-to-end

**Day 4-5: AI Quality Validation**
- [ ] Create validation dataset (50 scenarios)
- [ ] Run agents on validation set
- [ ] Measure accuracy, precision, recall
- [ ] Collect confidence scores
- [ ] Analyze failure cases
- [ ] Refine prompts based on failures
- [ ] Re-test and validate improvements
- [ ] Document AI performance metrics

### Deliverables

✅ `ListHealthAgent` with validated prompts
✅ `OptimizationAgent` with conservative suppression logic
✅ `RebalancingAgent` with FIFO preservation
✅ `ReportingAgent` with executive summaries
✅ `ListManagementOrchestrator` coordinating all agents
✅ AI quality validation report

### Success Criteria

- [ ] All agents return valid JSON 99%+ of the time
- [ ] List Health Agent accuracy > 90% (vs manual assessment)
- [ ] Optimization Agent false positive rate < 5%
- [ ] Rebalancing Agent minimizes movements (< 10% of contacts)
- [ ] Reporting Agent summaries approved by stakeholders
- [ ] Average confidence scores > 0.85 across all agents

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI responses inconsistent | High | Lower temperature, add validation rules |
| Gemini API costs too high | Medium | Cache responses, batch requests |
| Prompt engineering takes longer | Medium | Allocate buffer time, involve stakeholders early |
| AI makes incorrect decisions | Critical | Manual review workflow, confidence thresholds |

---

## Phase 4: Workflow Services

### Duration: 2 weeks (Weeks 8-9)

### Objectives

- Implement post-campaign maintenance workflow
- Implement weekly health check workflow
- Add pre-campaign validation
- Integrate with Slack notifications

### Tasks

#### Week 8: Post-Campaign Maintenance

**Day 1-3: Service Implementation**
- [ ] Implement `PostCampaignMaintenanceService` class
- [ ] Add `execute()` method (9-step workflow)
- [ ] Integrate with `BounceProcessorService`
- [ ] Integrate with `ListOperationsService`
- [ ] Integrate with orchestrator
- [ ] Add before/after state capture
- [ ] Add database logging
- [ ] Handle partial failures
- [ ] Write unit tests with mocks

**Day 4-5: Integration & Testing**
- [ ] Write integration tests with test database
- [ ] Test with real campaign data (test list)
- [ ] Test error scenarios (API failures, rollback)
- [ ] Validate suppression logging
- [ ] Validate rebalancing execution
- [ ] Performance test (complete in < 60s)
- [ ] Slack notification testing

#### Week 9: Weekly Health Check & Pre-Campaign

**Day 1-2: Weekly Health Check Service**
- [ ] Implement `WeeklyHealthCheckService`
- [ ] Add list state collection
- [ ] Add AI analysis workflow
- [ ] Add health check logging
- [ ] Add Slack reporting
- [ ] Write unit and integration tests
- [ ] Test with current production data (read-only)

**Day 3-4: Pre-Campaign Validation**
- [ ] Implement `PreCampaignValidationService`
- [ ] Add list balance checks
- [ ] Add bounce rate warnings
- [ ] Add size validation
- [ ] Add AI health assessment
- [ ] Integrate into campaign lifecycle Stage 2
- [ ] Write tests
- [ ] Test with upcoming campaigns

**Day 5: Slack Notifications**
- [ ] Implement Slack notification templates
- [ ] Add Block Kit formatting
- [ ] Add threaded replies for updates
- [ ] Add action buttons (future: approve/reject)
- [ ] Test all notification types
- [ ] Validate formatting on mobile and desktop

### Deliverables

✅ `PostCampaignMaintenanceService` with 9-step workflow
✅ `WeeklyHealthCheckService` with AI analysis
✅ `PreCampaignValidationService` integrated into lifecycle
✅ Slack notification templates with Block Kit
✅ Complete integration tests for all workflows

### Success Criteria

- [ ] Post-campaign maintenance completes in < 60s (90th percentile)
- [ ] Weekly health check runs successfully every Monday
- [ ] Pre-campaign validation blocks invalid campaigns
- [ ] Slack notifications delivered within 30s of workflow completion
- [ ] All workflows have 80%+ code coverage

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workflow takes too long | Medium | Add timeout and partial success handling |
| Database writes fail | High | Transactional boundaries, rollback logic |
| Slack rate limits hit | Low | Queue notifications, batch updates |
| Integration breaks existing lifecycle | Critical | Feature flag, extensive testing |

---

## Phase 5: Automation

### Duration: 2 weeks (Weeks 10-11)

### Objectives

- Implement scheduler jobs
- Set up worker dyno
- Add manual trigger endpoints
- Configure monitoring and alerts

### Tasks

#### Week 10: Scheduler Jobs

**Day 1-2: Post-Campaign Job**
- [ ] Implement `post-campaign-maintenance.job.ts`
- [ ] Add campaign eligibility query (24h after send)
- [ ] Add job execution loop
- [ ] Add error handling per campaign
- [ ] Schedule hourly execution (cron: `0 * * * *`)
- [ ] Write integration tests
- [ ] Test with multiple campaigns

**Day 2-3: Weekly Health Check Job**
- [ ] Implement `weekly-health-check.job.ts`
- [ ] Add Monday 10 AM UTC execution
- [ ] Add comprehensive health analysis
- [ ] Schedule weekly execution (cron: `0 10 * * 1`)
- [ ] Write integration tests
- [ ] Test manually

**Day 3-4: Cache Refresh Job**
- [ ] Implement `cache-refresh.job.ts`
- [ ] Add list state caching
- [ ] Add contact membership batch refresh
- [ ] Schedule every 30 minutes
- [ ] Test cache invalidation
- [ ] Monitor cache hit rates

**Day 5: Job Orchestration**
- [ ] Implement `ListManagementScheduler` class
- [ ] Register all cron jobs
- [ ] Add graceful shutdown handling
- [ ] Add job monitoring (Bull dashboard)
- [ ] Test concurrent job execution
- [ ] Test scheduler restart recovery

#### Week 11: Worker Dyno & API Endpoints

**Day 1-2: Worker Dyno**
- [ ] Create `src/worker.ts` entry point
- [ ] Add scheduler initialization
- [ ] Update `Procfile` (add `worker:` command)
- [ ] Configure environment variables
- [ ] Test locally with separate processes
- [ ] Deploy to Heroku staging
- [ ] Verify scheduler runs on worker dyno

**Day 3-4: Manual Trigger API**
- [ ] Create `list-management.routes.ts`
- [ ] Add `POST /api/list-management/trigger-maintenance`
- [ ] Add `POST /api/list-management/trigger-health-check`
- [ ] Add authentication/authorization
- [ ] Add request validation
- [ ] Write E2E tests for API
- [ ] Test with Postman/cURL

**Day 5: Monitoring & Alerts**
- [ ] Set up Datadog/New Relic integration
- [ ] Add custom metrics (maintenance duration, contacts suppressed)
- [ ] Create dashboards for list management
- [ ] Set up alerts (job failures, high bounce rates)
- [ ] Configure PagerDuty escalation
- [ ] Test alert delivery

### Deliverables

✅ Post-campaign maintenance job (hourly)
✅ Weekly health check job (Monday 10 AM UTC)
✅ Cache refresh job (every 30 minutes)
✅ Worker dyno configuration
✅ Manual trigger API endpoints
✅ Monitoring dashboards and alerts

### Success Criteria

- [ ] All scheduled jobs run successfully on worker dyno
- [ ] Post-campaign maintenance triggers within 1 hour of eligibility
- [ ] Weekly health check executes every Monday at 10 AM UTC
- [ ] Manual trigger API responds within 2 seconds
- [ ] Monitoring dashboards show real-time metrics
- [ ] Alerts fire within 5 minutes of failure

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Worker dyno crashes | High | Auto-restart, health checks, alerting |
| Cron schedules miss execution | Medium | Job queue with retry, monitoring |
| Concurrent jobs conflict | Medium | Job locking, idempotency keys |
| API abuse (manual triggers) | Low | Rate limiting, authentication |

---

## Phase 6: Production Launch

### Duration: 1 week (Week 12)

### Objectives

- Deploy to production
- Run initial validation campaigns
- Monitor system performance
- Collect feedback and iterate

### Tasks

#### Week 12: Production Deployment

**Day 1: Pre-Launch Validation**
- [ ] Run full test suite (unit, integration, E2E)
- [ ] Verify 75%+ code coverage
- [ ] Run load tests (simulate 1000 contacts)
- [ ] Security audit (dependencies, API keys)
- [ ] Review all AI prompts and confidence thresholds
- [ ] Stakeholder demo and approval
- [ ] Create launch checklist

**Day 2: Staging Deployment**
- [ ] Deploy to Heroku staging
- [ ] Run database migrations
- [ ] Verify worker dyno starts
- [ ] Verify schedulers running
- [ ] Test manual triggers
- [ ] Run smoke tests
- [ ] Monitor for 24 hours

**Day 3: Production Deployment**
- [ ] Deploy to Heroku production
- [ ] Run database migrations (with backup)
- [ ] Scale worker dyno to 1
- [ ] Enable schedulers
- [ ] Verify Slack notifications
- [ ] Monitor logs continuously
- [ ] Set up on-call rotation

**Day 4-5: Validation & Monitoring**
- [ ] Wait for first post-campaign maintenance (24h)
- [ ] Review AI decisions manually
- [ ] Verify suppressions executed correctly
- [ ] Check Slack notifications delivered
- [ ] Monitor error rates (target: < 1%)
- [ ] Check performance metrics (latency, throughput)
- [ ] Collect stakeholder feedback

**Day 6: First Weekly Health Check**
- [ ] Wait for Monday 10 AM UTC execution
- [ ] Review weekly health report
- [ ] Validate list balance calculations
- [ ] Check AI assessments for accuracy
- [ ] Present report to stakeholders
- [ ] Gather feedback on report format
- [ ] Make adjustments if needed

**Day 7: Retrospective & Iteration**
- [ ] Team retrospective meeting
- [ ] Document lessons learned
- [ ] Identify improvement areas
- [ ] Prioritize enhancements
- [ ] Update documentation
- [ ] Celebrate launch! 🎉

### Deliverables

✅ Production deployment complete
✅ First post-campaign maintenance executed
✅ First weekly health check executed
✅ Monitoring dashboards live
✅ Stakeholder feedback collected
✅ Iteration backlog created

### Success Criteria

- [ ] Zero critical bugs in first 7 days
- [ ] Post-campaign maintenance runs successfully (100% of eligible campaigns)
- [ ] Weekly health check completes without errors
- [ ] AI decisions reviewed and validated by team
- [ ] Stakeholders approve of reports and notifications
- [ ] System uptime > 99.9% in first week

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Production deployment fails | Critical | Rehearse deployment, have rollback plan |
| AI makes incorrect decisions | High | Manual review for first 2 weeks, confidence thresholds |
| Performance issues under load | Medium | Load testing before launch, auto-scaling |
| Stakeholder dissatisfaction | Medium | Early feedback loops, clear communication |

---

## Timeline

### Gantt Chart

```
Week  1  2  3  4  5  6  7  8  9  10 11 12
      │  │  │  │  │  │  │  │  │  │  │  │
Phase 1: Foundation
      [████████]
             │
Phase 2: Core Infrastructure
             [████████]
                    │
Phase 3: AI Agents
                    [████████████]
                              │
Phase 4: Workflow Services
                              [████████]
                                    │
Phase 5: Automation
                                    [████████]
                                          │
Phase 6: Production Launch
                                          [████]
```

### Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 2 | Foundation Complete | Database schema, types, testing infrastructure |
| 4 | Infrastructure Complete | External clients, caching, monitoring |
| 7 | AI Agents Complete | All 4 agents validated and tuned |
| 9 | Workflows Complete | Post-campaign, weekly health, pre-campaign |
| 11 | Automation Complete | Schedulers, worker dyno, API endpoints |
| 12 | Production Launch | System live and validated |

### Dependencies

```
Foundation (Phase 1)
    ↓
Core Infrastructure (Phase 2)
    ↓
AI Agents (Phase 3)
    ↓
┌───────────────────┐
│   Workflows (P4)  │
└───────────────────┘
    ↓
┌───────────────────┐
│ Automation (P5)   │
└───────────────────┘
    ↓
Production (Phase 6)
```

---

## Risk Management

### High-Priority Risks

#### Risk 1: AI Quality Issues

**Description**: AI agents make incorrect or inconsistent decisions, leading to inappropriate suppressions or rebalancing.

**Probability**: Medium
**Impact**: Critical
**Mitigation Strategy**:
- Implement manual review workflow for first 2 weeks
- Set high confidence thresholds (> 0.85)
- Add safety checks (e.g., max 10% suppressions per campaign)
- Weekly prompt tuning sessions
- Fallback to manual decision if confidence < 0.7

**Monitoring**:
- Track false positive/negative rates
- Monitor confidence score distributions
- Alert on confidence < 0.7
- Daily AI decision review dashboard

#### Risk 2: Production Data Integrity

**Description**: List management operations corrupt contact data or break existing lists.

**Probability**: Low
**Impact**: Critical
**Mitigation Strategy**:
- Extensive testing on test lists first
- Database backups before migrations
- Transactional operations with rollback
- Read-only mode for first 24 hours (monitoring only)
- Manual approval for first 5 maintenance operations

**Monitoring**:
- Track list size changes
- Alert on unexpected size drops (> 5%)
- Daily data integrity checks
- Automated reconciliation with Mailjet

#### Risk 3: Performance Degradation

**Description**: System becomes too slow, causing delayed campaign sends or timeout errors.

**Probability**: Medium
**Impact**: High
**Mitigation Strategy**:
- Load testing with 2x expected volume
- Redis caching for frequently accessed data
- Async processing for non-critical operations
- Database query optimization
- Auto-scaling for worker dynos

**Monitoring**:
- Track P50, P95, P99 latencies
- Alert on latency > 60s
- Monitor Mailjet API rate limits
- Database connection pool monitoring

### Medium-Priority Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Gemini API outage | Low | High | Cache AI responses, fallback prompts, manual mode |
| Mailjet API rate limits | Medium | Medium | Request queuing, exponential backoff |
| Redis connection failures | Low | Medium | Graceful degradation without cache |
| Slack notification failures | Low | Low | Retry logic, email fallback |
| Team bandwidth constraints | Medium | Medium | Buffer time in schedule, prioritize ruthlessly |

---

## Success Metrics

### System Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Post-campaign maintenance completion time | < 60s (P95) | Datadog latency tracking |
| Weekly health check completion time | < 30s (P95) | Datadog latency tracking |
| Cache hit rate | > 60% | Redis INFO stats |
| Uptime | > 99.9% | Heroku metrics + Pingdom |
| Error rate | < 1% | Sentry error tracking |

### AI Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| List Health Agent accuracy | > 90% | Manual validation sample (50 cases) |
| Optimization Agent false positive rate | < 5% | Manual review of suppressions |
| Rebalancing Agent efficiency | < 10% contacts moved | Calculate movements / total contacts |
| Average AI confidence score | > 0.85 | Log and aggregate confidence scores |
| JSON parsing success rate | > 99% | Track parsing failures in logs |

### Business Impact Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bounce rate reduction | -20% | Compare 30-day pre/post launch |
| List balance improvement | < 2% deviation | Weekly balance deviation tracking |
| Manual list management time saved | -80% | Team time tracking |
| Campaign send reliability | > 99% | Track failed sends due to list issues |
| Stakeholder satisfaction | > 4/5 | Monthly NPS survey |

### Monitoring Dashboard

Create Datadog dashboard with:
- Real-time job execution status
- AI agent performance (latency, confidence)
- List health trends (bounce rates, balance deviation)
- Contact movement volume (suppressions, rebalancing)
- Error rates and types
- Slack notification delivery status

---

## Rollback Plan

### Rollback Triggers

Initiate rollback if any of the following occur:

1. **Critical Bug**: System causes data loss or corruption
2. **Performance Collapse**: P95 latency > 5 minutes
3. **AI Failure**: AI decisions incorrect > 20% of the time
4. **Operational Failure**: > 10% of scheduled jobs fail
5. **Stakeholder Request**: Product/business decision to pause

### Rollback Procedure

#### Immediate Actions (< 5 minutes)

1. **Stop Schedulers**
   ```bash
   heroku ps:scale worker=0 -a campaign-manager
   ```

2. **Disable Manual Triggers**
   - Set feature flag `LIST_MANAGEMENT_ENABLED=false`
   - Deploy configuration change

3. **Notify Stakeholders**
   - Send Slack message to #_traction
   - Explain situation and estimated resolution time

#### Database Rollback (< 30 minutes)

1. **Backup Current State**
   ```bash
   heroku pg:backups:capture -a campaign-manager
   ```

2. **Restore Previous State** (if data corruption)
   ```bash
   heroku pg:backups:restore [backup-id] -a campaign-manager
   ```

3. **Rollback Migrations**
   ```bash
   npm run migrate:rollback
   ```

#### Application Rollback (< 15 minutes)

1. **Rollback to Previous Release**
   ```bash
   heroku rollback -a campaign-manager
   ```

2. **Verify Rollback**
   ```bash
   heroku logs --tail -a campaign-manager
   ```

3. **Run Smoke Tests**
   - Verify existing campaign features work
   - Check database connectivity
   - Test critical API endpoints

#### Post-Rollback

1. **Root Cause Analysis**
   - Review logs and error traces
   - Identify specific failure
   - Document findings

2. **Fix & Re-test**
   - Implement fix in development
   - Run full test suite
   - Test on staging with production-like data

3. **Re-launch Decision**
   - Team meeting to review fix
   - Stakeholder approval
   - Schedule new launch date

### Rollback Testing

- **Practice rollback** in staging environment (Week 11, Day 5)
- Time each step to validate < 30 minute total rollback time
- Document any issues encountered
- Update rollback procedure based on learnings

---

## Appendices

### Appendix A: Environment Variables Checklist

```bash
# Required for Launch
GEMINI_API_KEY=<your_key>
MAILJET_API_KEY=<your_key>
MAILJET_API_SECRET=<your_secret>
MAILJET_MASTER_LIST_ID=5776
MAILJET_CAMPAIGN_LIST_1_ID=10503497
MAILJET_CAMPAIGN_LIST_2_ID=10503498
MAILJET_CAMPAIGN_LIST_3_ID=10503499
MAILJET_SUPPRESSION_LIST_ID=10503500
DATABASE_URL=<postgres_url>
REDIS_URL=<redis_url>
SLACK_WEBHOOK_URL=<slack_webhook>

# Optional Configuration
LIST_BALANCE_THRESHOLD=5
LIST_MAINTENANCE_DELAY_HOURS=24
WEEKLY_HEALTH_CHECK_DAY=1
WEEKLY_HEALTH_CHECK_HOUR=10
CACHE_TTL_SECONDS=3600
LIST_MANAGEMENT_ENABLED=true
```

### Appendix B: Launch Day Checklist

**Pre-Launch (Day Before)**
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage > 75%
- [ ] Security audit complete
- [ ] Staging deployment validated
- [ ] Database backups verified
- [ ] Rollback procedure tested
- [ ] On-call rotation scheduled
- [ ] Stakeholders notified of launch time

**Launch Day**
- [ ] Deploy to production (9 AM UTC)
- [ ] Run database migrations
- [ ] Scale worker dyno to 1
- [ ] Enable schedulers
- [ ] Verify first job execution
- [ ] Monitor logs for 2 hours
- [ ] Check error rates (< 1%)
- [ ] Verify Slack notifications
- [ ] Send launch announcement

**Post-Launch (First 24 Hours)**
- [ ] Monitor all scheduled job executions
- [ ] Review first AI decisions manually
- [ ] Check list state consistency
- [ ] Verify no data corruption
- [ ] Respond to any alerts within 15 minutes
- [ ] Collect initial stakeholder feedback
- [ ] Update documentation with any findings

### Appendix C: Team Contacts

| Role | Name | Slack | Email | Phone |
|------|------|-------|-------|-------|
| Backend Engineer | TBD | @engineer | engineer@example.com | +1-XXX-XXX-XXXX |
| DevOps Engineer | TBD | @devops | devops@example.com | +1-XXX-XXX-XXXX |
| QA Engineer | TBD | @qa | qa@example.com | +1-XXX-XXX-XXXX |
| Product Manager | TBD | @pm | pm@example.com | +1-XXX-XXX-XXXX |
| On-Call Rotation | TBD | #on-call | - | PagerDuty |

### Appendix D: Useful Commands

**Check worker dyno status**
```bash
heroku ps -a campaign-manager
```

**View scheduler logs**
```bash
heroku logs --tail --dyno worker -a campaign-manager
```

**Manually trigger maintenance**
```bash
curl -X POST https://campaign-manager.herokuapp.com/api/list-management/trigger-maintenance \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaignId": 123}'
```

**Check Redis cache**
```bash
heroku redis:cli -a campaign-manager
> KEYS list:*
> GET list:state
```

**Database query**
```bash
heroku pg:psql -a campaign-manager
> SELECT COUNT(*) FROM "ListMaintenanceLog";
> SELECT * FROM "ListHealthCheck" ORDER BY "executedAt" DESC LIMIT 5;
```

---

## Conclusion

This implementation plan provides a structured, phased approach to deploying the AI-driven list management system. By following these phases, validating at each step, and maintaining focus on quality and safety, we can deliver a robust system that:

- **Automates** 80% of manual list management work
- **Improves** deliverability through proactive bounce management
- **Maintains** balanced list distribution
- **Provides** transparency through AI decision explanations
- **Scales** to handle growing contact volume

**Next Steps**:
1. Review this plan with the full team
2. Assign team members to roles
3. Set up project tracking (Jira, Linear, etc.)
4. Begin Phase 1: Foundation (Week 1)

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Approved
**Sign-off Required**: Backend Lead, DevOps Lead, Product Manager
