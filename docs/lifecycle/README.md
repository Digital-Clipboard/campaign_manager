# Automated Campaign Lifecycle Management

## Overview

This directory contains complete documentation for the **Automated Campaign Lifecycle Management** feature - a comprehensive system that automates campaign execution with AI-powered insights, pre-flight verification, and multi-stage notifications.

---

## What is Campaign Lifecycle Management?

A fully automated system that manages campaigns from scheduling through post-launch analysis, providing stakeholders with real-time visibility and AI-powered recommendations at every critical stage.

### The 5-Stage Lifecycle

```
1. Pre-Launch Notification (T-21 hours)
   ↓
2. Pre-Flight Check (T-3.25 hours)
   ↓
3. Launch Warning (T-15 minutes)
   ↓
4. Launch Confirmation (T+0)
   ↓
5. Post-Launch Wrap-Up (T+30 minutes)
```

### Key Features

✅ **Automated Scheduling** - Split campaigns into thirds, schedule on Tue/Thu
✅ **Pre-Flight Verification** - Automated checks catch issues before launch
✅ **AI-Powered Analysis** - Multi-agent system provides insights & recommendations
✅ **Slack Integration** - Real-time notifications to #_traction channel
✅ **Complete Tracking** - Full audit trail in database

---

## Documentation Index

### 1. [00_brainstorm.md](./00_brainstorm.md) - Feature Concept
**What it covers:**
- Problem statement and pain points
- Vision and core concept
- Key features overview
- Success metrics
- Risk analysis

**Read this if:** You want to understand the "why" behind the feature and business goals.

---

### 2. [01_workflow.md](./01_workflow.md) - Workflow Diagrams
**What it covers:**
- Complete lifecycle flow diagram
- Single round sequence diagram
- Pre-flight check workflow
- AI assessment flow
- State machine
- Error handling flow

**Read this if:** You want visual representation of how the system works.

---

### 3. [02_architecture.md](./02_architecture.md) - Technical Architecture
**What it covers:**
- System architecture (4 layers)
- Component architecture
- Service implementations
- Database schema (Prisma)
- Technology stack
- Security & monitoring

**Read this if:** You're a developer or architect who needs to understand the technical design.

---

### 4. [03_feature_specification.md](./03_feature_specification.md) - Complete Feature Spec
**What it covers:**
- Detailed 5-stage lifecycle
- Campaign batch strategy
- AI multi-agent system
- Slack notification formats
- Configuration & testing

**Read this if:** You need the complete, detailed feature specification.

---

### 5. [04_development_specification.md](./04_development_specification.md) - Development Tasks
**What it covers:**
- Database schema & migrations
- Service layer implementation
- Code examples for all components
- Testing requirements
- Deployment steps

**Read this if:** You're implementing the feature and need detailed dev tasks.

---

### 6. [05_tdd_specification.md](./05_tdd_specification.md) - Test-Driven Development
**What it covers:**
- Unit test specifications (90%+ coverage)
- Integration test requirements
- End-to-end test scenarios
- Performance testing
- CI/CD integration

**Read this if:** You're writing tests or setting up test infrastructure.

---

### 7. [06_implementation_plan.md](./06_implementation_plan.md) - Implementation Plan
**What it covers:**
- 8-10 week phased implementation
- 16 detailed milestones
- Task breakdown with time estimates
- Risk management
- Success criteria

**Read this if:** You're planning or managing the implementation project.

---

## Quick Start

### For Product Owners
1. Start with [00_brainstorm.md](./00_brainstorm.md) - Understand the vision
2. Review [03_feature_specification.md](./03_feature_specification.md) - See detailed features
3. Check [06_implementation_plan.md](./06_implementation_plan.md) - Understand timeline

### For Developers
1. Start with [02_architecture.md](./02_architecture.md) - Understand the system
2. Review [04_development_specification.md](./04_development_specification.md) - See implementation tasks
3. Check [05_tdd_specification.md](./05_tdd_specification.md) - Understand testing approach

### For DevOps
1. Review [02_architecture.md](./02_architecture.md) - System architecture
2. Check [04_development_specification.md](./04_development_specification.md) - Deployment requirements
3. Review [06_implementation_plan.md](./06_implementation_plan.md) - Rollout plan

---

## Implementation Status

| Phase | Status | Timeline |
|-------|--------|----------|
| Documentation | ✅ Complete | Week 0 (Oct 1, 2025) |
| Phase 1: Foundation | ⏳ Not Started | Week 1-2 |
| Phase 2: Integrations | ⏳ Not Started | Week 3-4 |
| Phase 3: Core Services | ⏳ Not Started | Week 5-6 |
| Phase 4: Scheduler | ⏳ Not Started | Week 7-8 |
| Phase 5: Testing | ⏳ Not Started | Week 9 |
| Phase 6: Production | ⏳ Not Started | Week 10 |

**Current Status**: 🔄 Ready for Development
**Estimated Completion**: December 2025 (8-10 weeks)

---

## Technology Stack

### Backend
- Node.js 20 + TypeScript 5
- Express.js
- Prisma ORM + PostgreSQL

### Scheduling
- node-cron
- Bull Queue + Redis

### External Services
- MailJet REST API v3
- Slack MCP Server
- Google Gemini 2.0 Flash

### Infrastructure
- Heroku (web + worker dynos)
- PostgreSQL (Heroku Postgres)
- Redis (Heroku Redis)

---

## Key Concepts

### Campaign Batch Strategy
- **Split into 3 rounds**: Every campaign divided into thirds
- **Scheduling**: Only Tuesdays and Thursdays at 9:15 AM UTC
- **FIFO ordering**: Recipients ordered by ContactID for fair distribution

### 5-Stage Lifecycle
1. **Pre-Launch (T-21h)**: Advance notice with campaign details + AI preview
2. **Pre-Flight (T-3.25h)**: Automated verification of list, campaign, technical config
3. **Launch Warning (T-15min)**: Final countdown notification
4. **Launch Confirmation (T+0)**: Immediate feedback with initial stats
5. **Wrap-Up (T+30min)**: Complete metrics + AI analysis + recommendations

### AI Multi-Agent System
- **List Quality Agent**: Analyzes bounce rates and list health
- **Delivery Analysis Agent**: Evaluates delivery performance
- **Comparison Agent**: Compares rounds for trends
- **Recommendation Agent**: Generates actionable recommendations
- **Report Formatting Agent**: Formats insights for Slack

---

## Success Metrics

### Operational Targets
- Notification delivery: < 60 seconds
- Pre-flight check time: < 30 seconds
- AI analysis time: < 30 seconds
- Notification success rate: > 99%

### Business Targets
- Campaign preparation time: -50%
- Manual work reduction: -90%
- Issues caught before launch: > 80%
- Stakeholder satisfaction: > 90%

---

## Examples

### Example Campaign Schedule

```typescript
{
  campaignName: "Client Letters 2.0",
  totalRecipients: 3529,

  rounds: [
    {
      round: 1,
      recipients: "1-1177",
      scheduledDate: "2025-09-30 09:15 UTC"
    },
    {
      round: 2,
      recipients: "1178-2353",
      scheduledDate: "2025-10-02 09:15 UTC"
    },
    {
      round: 3,
      recipients: "2354-3529",
      scheduledDate: "2025-10-07 09:15 UTC"
    }
  ]
}
```

### Example Notification Timeline

```
Monday 3:00 PM UTC → Pre-Launch Notification sent
Tuesday 6:00 AM UTC → Pre-Flight Check runs
Tuesday 9:00 AM UTC → Launch Warning sent
Tuesday 9:15 AM UTC → Campaign launches (manual trigger)
Tuesday 9:45 AM UTC → Wrap-Up Report sent with AI insights
```

---

## FAQ

**Q: Why split into 3 batches?**
A: Reduces risk, allows learning between rounds, limits impact of issues, enables optimization.

**Q: Why Tuesday and Thursday only?**
A: Mid-week days have optimal engagement. Avoids Monday (low) and Friday (weekend proximity).

**Q: Why 30 minutes for wrap-up?**
A: Allows time for email delivery, bounce processing, and MailJet metrics to stabilize.

**Q: Can I change the schedule after creation?**
A: Yes, via database updates. Future enhancement will add UI for this.

**Q: What happens if pre-flight check fails?**
A: Campaign status set to BLOCKED, notification sent with details, manual intervention required.

**Q: Can I skip a stage?**
A: Not recommended. Each stage serves a critical purpose in the lifecycle.

---

## Contributing

When adding new features or updates to lifecycle management:

1. Update relevant documentation files
2. Maintain consistent formatting and structure
3. Update this README if adding new documents
4. Keep examples current and accurate
5. Update implementation status

---

## Support

### For Questions
- Review this README first
- Check specific document for detailed info
- Consult architecture for technical details

### For Issues
- Check logs in production
- Review error handling in [01_workflow.md](./01_workflow.md)
- Consult troubleshooting in implementation docs

---

## References

### Related Documentation
- [../01_workflow.md](../01_workflow.md) - Core system workflow
- [../08_multi_agent_implementation.md](../08_multi_agent_implementation.md) - AI agents
- [../09_user_segmentation_strategy.md](../09_user_segmentation_strategy.md) - User segmentation
- [../10_bounce_management_guide.md](../10_bounce_management_guide.md) - Bounce handling

### External Resources
- [MailJet API Documentation](https://dev.mailjet.com/email/reference/)
- [Google Gemini Documentation](https://ai.google.dev/docs)
- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder)
- [Heroku Documentation](https://devcenter.heroku.com/)

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: 📋 Ready for Development

---

*This feature is part of the Campaign Manager system. For main documentation, see [../README.md](../README.md)*
