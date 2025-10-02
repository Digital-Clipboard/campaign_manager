# Automated Campaign Lifecycle Management - Brainstorm

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Approved
- **Purpose**: Initial brainstorming and concept development for automated campaign lifecycle

---

## Problem Statement

### Current Pain Points

**Manual Campaign Management**
- Stakeholders lack visibility into upcoming campaigns
- No automated pre-flight checks before launch
- Manual verification of campaign configuration is error-prone
- Post-launch analysis requires manual data collection from MailJet
- No standardized timing for notifications and checks

**Inconsistent Communication**
- Ad-hoc notifications about campaign status
- Missing critical updates when issues occur
- No structured format for campaign reports
- Difficult to track campaign history and performance

**Lack of AI-Powered Insights**
- Manual analysis of bounce rates and delivery metrics
- No round-to-round performance comparison
- Missing actionable recommendations
- Difficult to predict future campaign performance

**Campaign Scaling Challenges**
- Difficult to manage campaigns split across multiple rounds
- No automation for multi-batch campaigns (Round 1, 2, 3)
- Manual tracking of which recipients received which round
- Time-consuming to schedule campaigns on specific days (Tue/Thu)

---

## Vision

### What We Want to Build

**Fully Automated Campaign Lifecycle System** that provides:

1. **Proactive Notifications** - Stakeholders receive timely updates at every critical stage
2. **Intelligent Pre-Flight Checks** - Automated verification catches issues before launch
3. **AI-Powered Analysis** - Multi-agent system provides insights and recommendations
4. **Seamless Multi-Round Management** - Automatic splitting and scheduling across rounds
5. **Complete Visibility** - Full campaign history and metrics tracking

---

## Core Concept

### The 5-Stage Lifecycle

```
Campaign Schedule Created
         ↓
Stage 1: Pre-Launch Notification (T-21 hours)
  • 3 PM UTC day before launch
  • Campaign details + AI preview
  • Expected performance insights
         ↓
Stage 2: Pre-Flight Check (T-3.25 hours)
  • 6 AM UTC launch day
  • Verify list, campaign, technical config
  • AI readiness assessment
         ↓
Stage 3: Launch Warning (T-15 minutes)
  • 9:00 AM UTC
  • Final countdown
  • Confirm team readiness
         ↓
Stage 4: Launch Confirmation (T+0)
  • 9:15 AM UTC (manual trigger)
  • Confirm campaign sent
  • Initial send statistics
         ↓
Stage 5: Post-Launch Wrap-Up (T+30 minutes)
  • 9:45 AM UTC
  • Complete delivery metrics
  • AI analysis and recommendations
  • Round-to-round comparison
```

### Campaign Batch Strategy

**Split All Campaigns into Thirds**
- Round 1: First 1/3 of recipients
- Round 2: Second 1/3 of recipients
- Round 3: Final 1/3 of recipients

**Scheduling Rules**
- Send only on Tuesdays and Thursdays
- Send time: 9:15 AM UTC
- Automatic calculation of next available send date

**Example**: 3,529 total recipients
- Round 1: Users 1-1,177 (Tuesday)
- Round 2: Users 1,178-2,353 (Thursday)
- Round 3: Users 2,354-3,529 (Next Tuesday)

---

## Key Features

### 1. Automated Scheduling

**Batch Calculation**
- Automatically split recipients into 3 equal batches
- Create MailJet contact lists for each batch
- Schedule send dates on next available Tue/Thu
- Generate campaign drafts for each round

**Time-Based Triggers**
- Cron schedulers for each lifecycle stage
- Automatic execution at specified times
- No manual intervention required

### 2. Pre-Flight Verification

**List Verification**
- Check list exists in MailJet
- Verify subscriber count matches expected
- Flag discrepancies > 10 contacts

**Campaign Setup Verification**
- Confirm campaign draft exists
- Verify content is loaded
- Check subject line is set
- Validate sender configuration
- Ensure recipient list is attached

**Technical Validation**
- Verify all links are valid
- Check unsubscribe link present
- Confirm tracking configured
- Validate SPF/DKIM settings

**Overall Status Determination**
- 🟢 READY: All checks pass
- 🟡 NEEDS ATTENTION: Some warnings
- 🔴 BLOCKED: Critical failures

### 3. AI-Powered Analysis

**Multi-Agent System**
```
Campaign Metrics
      ↓
  ┌───┴───┬───────┬────────┐
  ↓       ↓       ↓        ↓
List   Delivery  Comp-   Recom-
Quality Analysis arison  mendation
Agent   Agent    Agent   Agent
  ↓       ↓       ↓        ↓
  └───┬───┴───────┴────────┘
      ↓
  Report Formatting Agent
      ↓
  Slack Notification
```

**Agent Responsibilities**

**List Quality Agent**
- Analyze bounce rates (hard vs soft)
- Assess list health
- Identify sender reputation risks

**Delivery Analysis Agent**
- Evaluate delivery performance
- Identify ISP issues
- Detect technical problems

**Comparison Agent** (Rounds 2+)
- Compare current vs previous round
- Identify trends and patterns
- Flag degradation or improvement

**Recommendation Agent**
- Generate actionable recommendations
- Predict future performance
- Identify risk factors

**Report Formatting Agent**
- Format insights for Slack
- Create executive-level summaries
- Ensure consistent structure

### 4. Slack Integration

**Notification Channel**: #_traction

**Block Kit Formatting**
- Clean, professional layout
- Code blocks for data (monospaced)
- Color indicators (🟢🟡🔴)
- Clear section dividers
- Clickable links

**Notification Content**
- Campaign details (name, round, time)
- Recipient information (count, range)
- Metrics (delivery, bounces, engagement)
- AI insights and recommendations
- Next steps and timing

### 5. Complete Tracking

**Database Storage**
- Campaign schedules with all rounds
- Notification delivery tracking
- Campaign metrics history
- Error logs with retry attempts

**Audit Trail**
- When each notification was sent
- What status each check returned
- Which AI insights were generated
- Any errors or failures encountered

---

## User Stories

### As a Marketing Manager

**Pre-Launch**
> "I want to receive a notification the day before a campaign launches with all the details, so I can review and prepare."

**Pre-Flight**
> "I want automated checks to verify the campaign is correctly configured before it sends, so I don't have to manually check everything."

**Launch**
> "I want to receive a warning 15 minutes before launch and a confirmation when it's sent, so I know the campaign went out on time."

**Post-Launch**
> "I want an AI-powered report 30 minutes after launch showing delivery metrics, bounce rates, and recommendations for the next round."

### As a Campaign Operator

**Batch Management**
> "I want campaigns to automatically split into 3 batches and schedule on Tuesdays and Thursdays, so I don't have to manually calculate and schedule each round."

**Error Handling**
> "I want to be notified immediately if a pre-flight check fails, with specific details about what's wrong, so I can fix it before launch."

**Round Comparison**
> "I want to see how each round performs compared to previous rounds, so I can identify trends and optimize future campaigns."

### As a Product Owner

**Visibility**
> "I want complete visibility into all scheduled campaigns and their lifecycle stages, so I can track progress and identify issues."

**Historical Data**
> "I want all campaign metrics and AI insights stored in the database, so I can analyze trends over time and improve our campaigns."

---

## Technical Approach

### Architecture Layers

**1. Scheduler Layer**
- Cron-based job scheduling
- Time-window trigger detection
- Job queue management (Bull + Redis)

**2. Lifecycle Layer**
- Campaign schedule management
- Notification orchestration
- Verification checks
- Metrics collection

**3. AI Analysis Layer**
- Multi-agent orchestration
- Gemini API integration
- Prompt engineering
- Response formatting

**4. Integration Layer**
- MailJet API client
- Slack MCP client
- PostgreSQL + Prisma
- Redis for caching

### Technology Stack

**Backend**: Node.js + TypeScript + Express
**Database**: PostgreSQL + Prisma ORM
**Scheduling**: node-cron + Bull Queue
**AI**: Google Gemini 2.0 Flash
**Notifications**: Slack MCP Server
**Email Platform**: MailJet REST API v3
**Deployment**: Heroku (web + worker dynos)

### Key Design Decisions

**Why Split into 3 Batches?**
- Reduces risk of large-scale issues
- Allows learning between rounds
- Limits impact of list quality problems
- Enables round-to-round optimization

**Why Tuesday/Thursday?**
- Avoids Monday (low engagement)
- Avoids Friday (weekend proximity)
- Mid-week optimal for B2B campaigns
- Consistent schedule for planning

**Why 5 Lifecycle Stages?**
- Pre-Launch: Advance notice for preparation
- Pre-Flight: Catch issues before launch
- Launch Warning: Final readiness check
- Launch Confirmation: Immediate feedback
- Wrap-Up: Complete analysis with context

**Why AI Multi-Agent System?**
- Specialized analysis (list quality, delivery, etc.)
- Parallel processing for speed
- Modular and maintainable
- Easy to add new agents

**Why 30-Minute Wrap-Up Delay?**
- Allows time for email delivery
- MailJet metrics stabilize
- Bounce processing completes
- More accurate statistics

---

## Success Metrics

### Operational Metrics

| Metric | Target | Current (Manual) |
|--------|--------|------------------|
| Notification Delivery Time | < 60 seconds | N/A |
| Pre-Flight Check Time | < 30 seconds | N/A |
| AI Analysis Time | < 30 seconds | N/A |
| Notification Success Rate | > 99% | ~80% (ad-hoc) |
| Issues Caught Before Launch | > 80% | ~30% |

### Business Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Campaign Preparation Time | -50% | Baseline |
| Manual Work Reduction | -90% | Baseline |
| Stakeholder Satisfaction | > 90% | ~60% |
| Campaign Success Rate | > 95% | ~85% |
| Time to Fix Issues | -70% | Baseline |

### Quality Metrics

| Metric | Target |
|--------|--------|
| AI Insight Accuracy | > 85% |
| Pre-Flight False Positives | < 5% |
| Pre-Flight False Negatives | < 2% |
| Recommendation Adoption | > 60% |
| System Uptime | > 99.5% |

---

## Risks & Mitigation

### Technical Risks

**MailJet API Rate Limits**
- Risk: Exceed API limits during peak usage
- Mitigation: Implement caching, respect rate limits, stagger requests

**Gemini AI Response Time**
- Risk: AI analysis takes > 30 seconds
- Mitigation: Add timeout, use faster model, implement fallback to basic metrics

**Scheduler Reliability**
- Risk: Cron jobs miss trigger times
- Mitigation: Redundant checks, monitoring alerts, manual trigger capability

**Slack Notification Failures**
- Risk: Messages fail to deliver
- Mitigation: Retry logic (3 attempts), fallback channel, alert on persistent failures

### Operational Risks

**Database Migration Issues**
- Risk: Migration fails in production
- Mitigation: Test thoroughly on staging, have rollback plan, backup production DB

**Pre-Flight False Positives**
- Risk: Blocks valid campaigns
- Mitigation: Manual override capability, alert team, refine checks based on feedback

**AI Hallucinations**
- Risk: AI generates incorrect insights
- Mitigation: Validate against actual data, include disclaimers, human review option

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

**Predictive Scheduling**
- AI predicts optimal send times based on engagement patterns
- Audience timezone optimization
- Seasonal adjustment recommendations

**Advanced AI Agents**
- Subject line optimization agent
- Content recommendation agent
- Audience segmentation agent
- Competitor analysis agent

**Real-Time Monitoring**
- Live campaign performance dashboard
- Real-time engagement metrics
- Automated anomaly detection
- Instant alerts for critical issues

**Enhanced Reporting**
- Executive summary generation
- Trend analysis across campaigns
- ROI calculation and forecasting
- Benchmarking against industry standards

**Automated Optimization**
- A/B test scheduling and analysis
- Dynamic content personalization
- Automated list hygiene
- Bounce suppression workflow

---

## Open Questions

**Answered During Planning:**
- ✅ Should we use cron or Bull Queue? → Both (cron for triggers, Bull for execution)
- ✅ How to handle failed notifications? → Retry 3 times, then fallback channel
- ✅ What if pre-flight check blocks valid campaign? → Manual override + alert
- ✅ How detailed should AI analysis be? → Executive-level summary with actionable items
- ✅ Store all metrics or just aggregates? → Store all metrics for historical analysis

**To Be Resolved During Implementation:**
- How to handle MailJet API downtime during critical stage?
- Should we add SMS notifications for critical failures?
- How to optimize AI prompts for best accuracy?
- What triggers should pause the scheduler? (e.g., holidays)

---

## Next Steps

### Immediate Actions
1. ✅ Create detailed feature specification
2. ✅ Design workflow diagrams
3. ✅ Document technical architecture
4. ✅ Write development specification
5. ✅ Create implementation plan with milestones

### Before Development
1. Review and approve all documentation
2. Set up development environment
3. Create test MailJet account for staging
4. Set up staging Slack channel
5. Provision Gemini API key

### Development Phases
1. **Phase 1**: Foundation & Database (Week 1-2)
2. **Phase 2**: External Integrations (Week 3-4)
3. **Phase 3**: Core Services (Week 5-6)
4. **Phase 4**: Scheduler & Automation (Week 7-8)
5. **Phase 5**: Testing & Validation (Week 9)
6. **Phase 6**: Production Deployment (Week 10)

---

## References

- [01_workflow.md](./01_workflow.md) - Workflow diagrams and flows
- [02_architecture.md](./02_architecture.md) - Technical architecture
- [03_feature_specification.md](./03_feature_specification.md) - Complete feature specification
- [04_development_specification.md](./04_development_specification.md) - Development tasks and implementation
- [05_tdd_specification.md](./05_tdd_specification.md) - Test-driven development approach
- [06_implementation_plan.md](./06_implementation_plan.md) - Phased implementation plan

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Approved
