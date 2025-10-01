# Campaign Lifecycle Implementation Plan

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: 📋 Ready for Execution
- **Purpose**: Phased implementation plan with milestones for automated campaign lifecycle

---

## Implementation Overview

### Total Estimated Time
**8-10 weeks** (40-50 working days)

### Team Requirements
- 1 Backend Developer (full-time)
- 1 DevOps Engineer (part-time, 20%)
- 1 QA Engineer (part-time, 30%)
- 1 Product Owner (for acceptance testing)

### Risk Level
**Medium** - Requires integration with existing systems and external APIs

---

## Phase 1: Foundation & Database (Week 1-2)

### Milestone 1.1: Database Schema & Migrations
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 1.1.1 | Create Prisma schema for `CampaignSchedule` model | 2h | ⏳ |
| 1.1.2 | Create Prisma schema for `CampaignMetrics` model | 2h | ⏳ |
| 1.1.3 | Create Prisma schema for `NotificationLog` model | 1h | ⏳ |
| 1.1.4 | Add enums: `CampaignStatus`, `NotificationStage`, `NotificationStatus` | 1h | ⏳ |
| 1.1.5 | Run migration on local database | 1h | ⏳ |
| 1.1.6 | Test schema with sample data | 2h | ⏳ |
| 1.1.7 | Deploy migration to staging | 1h | ⏳ |

**Acceptance Criteria**:
- ✅ All tables created successfully
- ✅ Relationships and indexes in place
- ✅ Sample data can be inserted and queried
- ✅ Migration runs successfully on staging

---

### Milestone 1.2: Database Service Layer
**Duration**: 4 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 1.2.1 | Implement `CampaignScheduleService` | 4h | ⏳ |
| 1.2.2 | Implement `CampaignMetricsService` | 3h | ⏳ |
| 1.2.3 | Implement `NotificationLogService` | 2h | ⏳ |
| 1.2.4 | Write unit tests for all services (80% coverage) | 6h | ⏳ |
| 1.2.5 | Integration tests with database | 4h | ⏳ |
| 1.2.6 | Code review and refactoring | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ All CRUD operations working
- ✅ 80%+ unit test coverage
- ✅ Integration tests pass
- ✅ Code reviewed and merged

---

### Milestone 1.3: Batch Scheduling Service
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 1.3.1 | Implement batch calculation algorithm | 4h | ⏳ |
| 1.3.2 | Implement Tuesday/Thursday scheduling logic | 3h | ⏳ |
| 1.3.3 | Implement `createCampaignSchedule` method | 3h | ⏳ |
| 1.3.4 | Write unit tests for scheduling logic | 4h | ⏳ |
| 1.3.5 | Test with real campaign data (3,529 recipients) | 2h | ⏳ |
| 1.3.6 | Code review | 1h | ⏳ |

**Acceptance Criteria**:
- ✅ Correctly splits recipients into 3 batches
- ✅ Schedules only on Tuesdays and Thursdays at 9:15 AM UTC
- ✅ All tests pass
- ✅ Validated with production data

**Deliverable**: Working batch scheduling service

---

## Phase 2: External Integrations (Week 3-4)

### Milestone 2.1: MailJet Client Enhancements
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 2.1.1 | Add `getCampaignDraft` method | 2h | ⏳ |
| 2.1.2 | Add `getCampaignContent` method | 2h | ⏳ |
| 2.1.3 | Add `getCampaignStatistics` method (enhanced) | 2h | ⏳ |
| 2.1.4 | Add `getContactsList` method (enhanced) | 2h | ⏳ |
| 2.1.5 | Add error handling and retry logic | 3h | ⏳ |
| 2.1.6 | Write integration tests with MailJet API | 4h | ⏳ |
| 2.1.7 | Test with staging MailJet account | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ All MailJet API calls working
- ✅ Retry logic handles transient failures
- ✅ Integration tests pass
- ✅ Tested with real MailJet data

---

### Milestone 2.2: Slack MCP Client Enhancements
**Duration**: 2 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 2.2.1 | Enhance `postMessage` for Block Kit format | 3h | ⏳ |
| 2.2.2 | Add error handling for Slack failures | 2h | ⏳ |
| 2.2.3 | Add retry logic for failed messages | 2h | ⏳ |
| 2.2.4 | Test with staging Slack channel | 2h | ⏳ |
| 2.2.5 | Validate Block Kit formatting | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ Messages post successfully to Slack
- ✅ Block Kit format renders correctly
- ✅ Retry logic handles failures
- ✅ Tested in staging channel

---

### Milestone 2.3: Gemini AI Client
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 2.3.1 | Implement `GeminiAIClient` base class | 3h | ⏳ |
| 2.3.2 | Implement `ListQualityAgent` | 3h | ⏳ |
| 2.3.3 | Implement `DeliveryAnalysisAgent` | 3h | ⏳ |
| 2.3.4 | Implement `ComparisonAgent` | 3h | ⏳ |
| 2.3.5 | Implement `RecommendationAgent` | 3h | ⏳ |
| 2.3.6 | Implement `AgentOrchestrator` | 3h | ⏳ |
| 2.3.7 | Test AI responses with sample data | 3h | ⏳ |

**Acceptance Criteria**:
- ✅ All AI agents working
- ✅ Orchestrator coordinates multi-agent analysis
- ✅ Responses are relevant and actionable
- ✅ Performance < 30 seconds per analysis

**Deliverable**: Complete AI analysis system

---

## Phase 3: Core Lifecycle Services (Week 5-6)

### Milestone 3.1: Verification Service (Pre-Flight)
**Duration**: 4 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 3.1.1 | Implement `verifyList` method | 3h | ⏳ |
| 3.1.2 | Implement `verifyCampaignSetup` method | 3h | ⏳ |
| 3.1.3 | Implement `verifyTechnicalConfig` method | 3h | ⏳ |
| 3.1.4 | Implement `runAllChecks` orchestrator | 2h | ⏳ |
| 3.1.5 | Implement status determination logic | 2h | ⏳ |
| 3.1.6 | Write unit tests (80% coverage) | 4h | ⏳ |
| 3.1.7 | Integration tests with MailJet | 3h | ⏳ |
| 3.1.8 | Test with real campaign data | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ All verification checks working
- ✅ Correctly identifies issues
- ✅ Status determination accurate
- ✅ Tests pass with real data

---

### Milestone 3.2: Metrics Collection Service
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 3.2.1 | Implement `collectAndSaveMetrics` method | 4h | ⏳ |
| 3.2.2 | Implement `getPreviousRoundMetrics` method | 2h | ⏳ |
| 3.2.3 | Implement `calculateDeltas` method | 2h | ⏳ |
| 3.2.4 | Add rate calculations (delivery, bounce, open, click) | 3h | ⏳ |
| 3.2.5 | Write unit tests | 4h | ⏳ |
| 3.2.6 | Integration tests with MailJet | 3h | ⏳ |

**Acceptance Criteria**:
- ✅ Metrics collected accurately from MailJet
- ✅ Rates calculated correctly
- ✅ Previous round comparison working
- ✅ Data saved to database

---

### Milestone 3.3: Notification Service
**Duration**: 5 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 3.3.1 | Implement `sendPreLaunchNotification` | 4h | ⏳ |
| 3.3.2 | Implement `sendPreFlightNotification` | 4h | ⏳ |
| 3.3.3 | Implement `sendLaunchWarning` | 2h | ⏳ |
| 3.3.4 | Implement `sendLaunchConfirmation` | 2h | ⏳ |
| 3.3.5 | Implement `sendWrapUpReport` | 4h | ⏳ |
| 3.3.6 | Create Block Kit formatters for each stage | 8h | ⏳ |
| 3.3.7 | Implement error handling and retry logic | 4h | ⏳ |
| 3.3.8 | Write unit tests | 6h | ⏳ |
| 3.3.9 | Integration tests with Slack | 4h | ⏳ |

**Acceptance Criteria**:
- ✅ All 5 notification stages working
- ✅ Block Kit formatting correct
- ✅ Messages post to Slack successfully
- ✅ Error handling and retry working
- ✅ Tests pass

**Deliverable**: Complete notification system

---

## Phase 4: Scheduler & Automation (Week 7-8)

### Milestone 4.1: Cron Scheduler Implementation
**Duration**: 4 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 4.1.1 | Implement `LifecycleScheduler` base class | 3h | ⏳ |
| 4.1.2 | Implement pre-launch trigger logic | 3h | ⏳ |
| 4.1.3 | Implement pre-flight trigger logic | 3h | ⏳ |
| 4.1.4 | Implement launch warning trigger logic | 2h | ⏳ |
| 4.1.5 | Implement wrap-up trigger logic | 3h | ⏳ |
| 4.1.6 | Implement time window finder | 3h | ⏳ |
| 4.1.7 | Add scheduler start/stop controls | 2h | ⏳ |
| 4.1.8 | Write unit tests for trigger logic | 4h | ⏳ |
| 4.1.9 | Integration tests for full scheduler | 4h | ⏳ |

**Acceptance Criteria**:
- ✅ All cron jobs running on schedule
- ✅ Triggers fire at correct times
- ✅ No duplicate notifications
- ✅ Scheduler can start/stop cleanly

---

### Milestone 4.2: Bull Queue Integration (Optional)
**Duration**: 3 days
**Owner**: Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 4.2.1 | Set up Redis connection | 2h | ⏳ |
| 4.2.2 | Create Bull queue for lifecycle jobs | 3h | ⏳ |
| 4.2.3 | Implement job processors | 4h | ⏳ |
| 4.2.4 | Add retry logic for failed jobs | 3h | ⏳ |
| 4.2.5 | Add job monitoring dashboard | 4h | ⏳ |
| 4.2.6 | Test queue with high load | 3h | ⏳ |

**Acceptance Criteria**:
- ✅ Jobs queued and processed correctly
- ✅ Failed jobs retry automatically
- ✅ Monitoring dashboard working
- ✅ Handles 100+ jobs concurrently

**Note**: This is optional and can be deferred to Phase 5 if needed.

---

### Milestone 4.3: Worker Process Setup
**Duration**: 2 days
**Owner**: DevOps Engineer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 4.3.1 | Create `worker.ts` entry point | 2h | ⏳ |
| 4.3.2 | Update `Procfile` with worker dyno | 1h | ⏳ |
| 4.3.3 | Configure Heroku worker dyno | 1h | ⏳ |
| 4.3.4 | Set up environment variables | 1h | ⏳ |
| 4.3.5 | Test worker startup and shutdown | 2h | ⏳ |
| 4.3.6 | Deploy to staging | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ Worker dyno runs successfully
- ✅ Scheduler starts automatically
- ✅ Logs show scheduler activity
- ✅ Tested on staging

**Deliverable**: Automated scheduling system

---

## Phase 5: Testing & Validation (Week 9)

### Milestone 5.1: End-to-End Testing
**Duration**: 5 days
**Owner**: QA Engineer + Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 5.1.1 | Create test campaign schedule | 2h | ⏳ |
| 5.1.2 | Test pre-launch notification (T-21h) | 2h | ⏳ |
| 5.1.3 | Test pre-flight checks (T-3.25h) | 3h | ⏳ |
| 5.1.4 | Test launch warning (T-15min) | 2h | ⏳ |
| 5.1.5 | Test launch confirmation (T+0) | 2h | ⏳ |
| 5.1.6 | Test wrap-up report (T+30min) | 3h | ⏳ |
| 5.1.7 | Test with real MailJet campaign | 4h | ⏳ |
| 5.1.8 | Test error scenarios (API failures, etc.) | 4h | ⏳ |
| 5.1.9 | Test AI analysis quality | 3h | ⏳ |
| 5.1.10 | Performance testing (latency, throughput) | 4h | ⏳ |

**Acceptance Criteria**:
- ✅ Complete lifecycle executes successfully
- ✅ All notifications sent on time
- ✅ AI analysis accurate and relevant
- ✅ Error handling works correctly
- ✅ Performance meets SLAs

---

### Milestone 5.2: Staging Deployment & Validation
**Duration**: 2 days
**Owner**: DevOps Engineer + Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 5.2.1 | Deploy to staging environment | 2h | ⏳ |
| 5.2.2 | Run database migration on staging | 1h | ⏳ |
| 5.2.3 | Configure environment variables | 1h | ⏳ |
| 5.2.4 | Start scheduler on staging | 1h | ⏳ |
| 5.2.5 | Monitor logs for 24 hours | 4h | ⏳ |
| 5.2.6 | Create test campaign on staging | 2h | ⏳ |
| 5.2.7 | Validate all stages execute | 4h | ⏳ |
| 5.2.8 | Fix any issues found | 4h | ⏳ |

**Acceptance Criteria**:
- ✅ Staging deployment successful
- ✅ Test campaign completes full lifecycle
- ✅ No errors in logs
- ✅ All services healthy

**Deliverable**: Validated staging environment

---

## Phase 6: Production Deployment (Week 10)

### Milestone 6.1: Production Deployment
**Duration**: 3 days
**Owner**: DevOps Engineer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 6.1.1 | Create production deployment checklist | 2h | ⏳ |
| 6.1.2 | Backup production database | 1h | ⏳ |
| 6.1.3 | Run database migration on production | 1h | ⏳ |
| 6.1.4 | Deploy application to production | 2h | ⏳ |
| 6.1.5 | Configure production environment variables | 1h | ⏳ |
| 6.1.6 | Start scheduler on production | 1h | ⏳ |
| 6.1.7 | Monitor logs for 48 hours | 8h | ⏳ |
| 6.1.8 | Set up alerts and monitoring | 3h | ⏳ |

**Acceptance Criteria**:
- ✅ Production deployment successful
- ✅ No errors in logs
- ✅ Scheduler running correctly
- ✅ Alerts configured
- ✅ Monitoring dashboard live

---

### Milestone 6.2: First Production Campaign
**Duration**: 2 days
**Owner**: Product Owner + Backend Developer

#### Tasks

| Task | Description | Time | Status |
|------|-------------|------|--------|
| 6.2.1 | Create Round 3 campaign schedule | 2h | ⏳ |
| 6.2.2 | Monitor pre-launch notification | 2h | ⏳ |
| 6.2.3 | Monitor pre-flight checks | 2h | ⏳ |
| 6.2.4 | Monitor launch warning | 1h | ⏳ |
| 6.2.5 | Monitor launch confirmation | 1h | ⏳ |
| 6.2.6 | Monitor wrap-up report | 2h | ⏳ |
| 6.2.7 | Validate AI assessment quality | 2h | ⏳ |
| 6.2.8 | Document any issues or improvements | 2h | ⏳ |

**Acceptance Criteria**:
- ✅ Round 3 campaign completes successfully
- ✅ All notifications sent on time
- ✅ No production incidents
- ✅ Stakeholder approval received

**Deliverable**: Production-ready automated campaign lifecycle

---

## Milestones Summary

| Phase | Milestone | Duration | Dependencies | Deliverable |
|-------|-----------|----------|--------------|-------------|
| 1 | Database Schema | 3 days | None | Database tables |
| 1 | Database Services | 4 days | M1.1 | CRUD operations |
| 1 | Batch Scheduling | 3 days | M1.2 | Scheduling logic |
| 2 | MailJet Client | 3 days | None | Enhanced MailJet API |
| 2 | Slack Client | 2 days | None | Enhanced Slack MCP |
| 2 | Gemini AI | 3 days | None | AI analysis system |
| 3 | Verification Service | 4 days | M2.1 | Pre-flight checks |
| 3 | Metrics Service | 3 days | M2.1 | Metrics collection |
| 3 | Notification Service | 5 days | M2.2, M2.3 | All notifications |
| 4 | Cron Scheduler | 4 days | M3.3 | Automated triggers |
| 4 | Bull Queue (Optional) | 3 days | M4.1 | Job queue |
| 4 | Worker Process | 2 days | M4.1 | Heroku worker |
| 5 | E2E Testing | 5 days | M4.3 | Tested system |
| 5 | Staging Validation | 2 days | M5.1 | Validated staging |
| 6 | Production Deploy | 3 days | M5.2 | Live system |
| 6 | First Campaign | 2 days | M6.1 | Validated production |

---

## Timeline Visualization

```
Week 1-2:  Foundation & Database
├─ M1.1: Database Schema (3d)
├─ M1.2: Database Services (4d)
└─ M1.3: Batch Scheduling (3d)

Week 3-4:  External Integrations
├─ M2.1: MailJet Client (3d)
├─ M2.2: Slack Client (2d)
└─ M2.3: Gemini AI (3d)

Week 5-6:  Core Services
├─ M3.1: Verification Service (4d)
├─ M3.2: Metrics Service (3d)
└─ M3.3: Notification Service (5d)

Week 7-8:  Scheduler & Automation
├─ M4.1: Cron Scheduler (4d)
├─ M4.2: Bull Queue [Optional] (3d)
└─ M4.3: Worker Process (2d)

Week 9:    Testing & Validation
├─ M5.1: E2E Testing (5d)
└─ M5.2: Staging Validation (2d)

Week 10:   Production
├─ M6.1: Production Deploy (3d)
└─ M6.2: First Campaign (2d)

Total: 8-10 weeks
```

---

## Risk Management

### High-Risk Areas

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MailJet API rate limits | High | Medium | Implement caching, respect rate limits |
| Gemini AI response time > 30s | Medium | Low | Add timeout, fallback to basic metrics |
| Scheduler misses trigger | High | Low | Add redundant checks, monitoring alerts |
| Slack notification failures | Medium | Medium | Implement retry logic, fallback channel |
| Database migration issues | High | Low | Test thoroughly on staging, backup prod |

### Contingency Plans

**If Phase 2 (AI) is delayed**:
- Proceed with basic metrics in Phase 3
- Add AI analysis in Phase 5

**If Phase 4 (Bull Queue) is complex**:
- Skip Bull Queue initially
- Use simple cron scheduler
- Add Bull Queue in Phase 7 (post-launch)

**If staging testing reveals issues**:
- Allocate additional week for bug fixes
- Push production deployment to Week 11

---

## Success Criteria

### Technical Success

- ✅ All 5 lifecycle stages execute automatically
- ✅ Notifications delivered within 60 seconds of trigger time
- ✅ AI analysis completes in < 30 seconds
- ✅ 99.9% notification success rate
- ✅ Zero critical bugs in production

### Business Success

- ✅ Stakeholders receive timely campaign updates
- ✅ Issues identified before launch via pre-flight checks
- ✅ Post-launch insights actionable and accurate
- ✅ Manual work reduced by 90%
- ✅ Campaign preparation time reduced by 50%

---

## Post-Launch Activities

### Week 11-12: Monitoring & Optimization

- Monitor first 3 campaigns in production
- Gather feedback from stakeholders
- Optimize AI prompts based on accuracy
- Tune scheduler timing if needed
- Document lessons learned

### Future Enhancements (Phase 7)

- Predictive scheduling based on engagement patterns
- Advanced AI agents (subject line optimization, etc.)
- Real-time campaign performance dashboard
- A/B testing automation
- Automated bounce suppression

---

## References

- [00_brainstorm.md](./00_brainstorm.md) - Feature concept and brainstorm
- [01_workflow.md](./01_workflow.md) - Workflow diagrams
- [02_architecture.md](./02_architecture.md) - Architecture
- [03_feature_specification.md](./03_feature_specification.md) - Feature specification
- [04_development_specification.md](./04_development_specification.md) - Development spec
- [05_tdd_specification.md](./05_tdd_specification.md) - Test-driven development

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: 📋 Ready for Execution
