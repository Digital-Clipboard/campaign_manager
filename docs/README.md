# Campaign Manager Documentation

Welcome to the Campaign Manager documentation. This directory contains comprehensive guides for understanding, implementing, and operating the campaign management system.

---

## 📚 Documentation Index

### Planning & Architecture

1. **[00_brainstorm.md](./00_brainstorm.md)**
   - Initial brainstorming and concept development
   - Problem statement and goals
   - Feature requirements

2. **[01_workflow.md](./01_workflow.md)**
   - Core workflow documentation
   - Campaign lifecycle processes
   - Operational procedures

3. **[02_architecture.md](./02_architecture.md)**
   - System architecture overview
   - Component design
   - Technology stack
   - Data models

### API & Testing

4. **[03_api_specification.md](./03_api_specification.md)**
   - RESTful API endpoints
   - Request/response formats
   - Authentication & authorization
   - MCP protocol integration

5. **[04_tdd_specification.md](./04_tdd_specification.md)**
   - Test-driven development approach
   - Test coverage requirements
   - Unit and integration testing
   - Test automation

### Implementation

6. **[05_milestone_implementation.md](./05_milestone_implementation.md)**
   - Development milestones
   - Implementation roadmap
   - Feature delivery schedule
   - Progress tracking

7. **[06_repository_setup.md](./06_repository_setup.md)**
   - Repository structure
   - Development environment setup
   - Dependencies and tooling
   - Contribution guidelines

### Deployment & Operations

8. **[07_heroku_scheduler.md](./07_heroku_scheduler.md)**
   - Heroku deployment configuration
   - Scheduler setup for automated jobs
   - Environment variables
   - Production monitoring

### Advanced Features

9. **[08_multi_agent_implementation.md](./08_multi_agent_implementation.md)** 🆕
   - AI-powered campaign analytics
   - Multi-agent architecture with Google Gemini
   - Executive reporting system
   - Notification timing updates
   - **Status**: Implemented Sept 30, 2025

10. **[09_user_segmentation_strategy.md](./09_user_segmentation_strategy.md)** 🆕
    - User segmentation methodology
    - FIFO (First-In-First-Out) strategy
    - Campaign batch management
    - MailJet list creation procedures
    - **Status**: Documented Sept 30, 2025

11. **[10_bounce_management_guide.md](./10_bounce_management_guide.md)** 🆕
    - Email bounce handling and cleanup
    - Suppression list management
    - List hygiene best practices
    - Automated cleanup workflows
    - **Status**: Documented Oct 1, 2025

### Lifecycle Management Feature 🆕

Comprehensive documentation in [`lifecycle/`](./lifecycle/):

11. **[lifecycle/00_brainstorm.md](./lifecycle/00_brainstorm.md)** 🆕
    - Feature concept and problem statement
    - Vision and goals
    - Success metrics and KPIs
    - **Status**: Documented Oct 1, 2025

12. **[lifecycle/01_workflow.md](./lifecycle/01_workflow.md)** 🆕
    - Complete lifecycle flow diagrams
    - Stage-by-stage sequence
    - Data flow architecture
    - State machine and error handling
    - **Status**: Documented Oct 1, 2025

13. **[lifecycle/02_architecture.md](./lifecycle/02_architecture.md)** 🆕
    - System architecture (4 layers)
    - Service implementations
    - Database schema
    - Technology stack
    - **Status**: Documented Oct 1, 2025

14. **[lifecycle/03_feature_specification.md](./lifecycle/03_feature_specification.md)** 🆕
    - Complete feature specification
    - 5-stage lifecycle details
    - AI multi-agent system
    - Notification formats
    - **Status**: Documented Oct 1, 2025

15. **[lifecycle/04_development_specification.md](./lifecycle/04_development_specification.md)** 🆕
    - Database development tasks
    - Core service implementation
    - Scheduler development
    - Code examples and tests
    - **Status**: Documented Oct 1, 2025

16. **[lifecycle/05_tdd_specification.md](./lifecycle/05_tdd_specification.md)** 🆕
    - Test-driven development approach
    - Unit, integration, and E2E tests
    - Coverage requirements (85%+)
    - Performance testing
    - **Status**: Documented Oct 1, 2025

17. **[lifecycle/06_implementation_plan.md](./lifecycle/06_implementation_plan.md)** 🆕
    - 8-10 week phased implementation
    - 16 detailed milestones
    - Task breakdown with estimates
    - Risk management
    - **Status**: Documented Oct 1, 2025

### Technical Documentation

18. **[MCP_API_DOCUMENTATION.md](./MCP_API_DOCUMENTATION.md)**
    - Model Context Protocol API reference
    - Agent communication protocols
    - Integration specifications

19. **[MCP_INTEGRATION_REQUIREMENTS.md](./MCP_INTEGRATION_REQUIREMENTS.md)**
    - MCP integration requirements
    - Service dependencies
    - Configuration guidelines

20. **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)**
    - Current implementation status
    - Feature completion tracking
    - Known issues and roadmap

21. **[CREATE_PR.md](./CREATE_PR.md)**
    - Pull request guidelines
    - Code review process
    - Contribution workflow

### Quick Start Guides

Located in [`guides/`](./guides/):

- **[Bounce Cleanup Quickstart](./guides/BOUNCE_CLEANUP_QUICKSTART.md)** - Complete bounce cleanup guide (15-20 min)
- **[Simple Bounce Cleanup](./guides/SIMPLE_BOUNCE_CLEANUP.md)** - Lightweight cleanup approach (5 min)
- **[Logging Structure](./guides/LOGGING_STRUCTURE.md)** - Campaign logging and documentation

### Archive

Historical documentation in [`archive/`](./archive/):

- **[Round 2 Launch Ready](./archive/ROUND2_LAUNCH_READY.md)** - Round 2 setup (Sept 2025)
- **[Round 3 Setup Guide](./archive/ROUND3_SETUP_GUIDE.md)** - Round 3 setup (Oct 2025)

---

## 🚀 Quick Start

### For New Team Members

1. Start with [02_architecture.md](./02_architecture.md) to understand the system
2. Review [01_workflow.md](./01_workflow.md) for operational processes
3. Check [06_repository_setup.md](./06_repository_setup.md) for environment setup
4. Read [03_api_specification.md](./03_api_specification.md) for API details

### For Campaign Managers

1. Read [09_user_segmentation_strategy.md](./09_user_segmentation_strategy.md) for user list management
2. Review [01_workflow.md](./01_workflow.md) for campaign processes
3. Check [10_bounce_management_guide.md](./10_bounce_management_guide.md) for post-campaign cleanup
4. Review [08_multi_agent_implementation.md](./08_multi_agent_implementation.md) for reporting features
5. **NEW**: Explore [lifecycle/](./lifecycle/) for automated campaign lifecycle management

### For Developers

1. Start with [02_architecture.md](./02_architecture.md)
2. Review [04_tdd_specification.md](./04_tdd_specification.md) for testing
3. Check [05_milestone_implementation.md](./05_milestone_implementation.md) for roadmap
4. Read [03_api_specification.md](./03_api_specification.md) for API integration
5. **NEW**: Review [lifecycle/](./lifecycle/) for automated lifecycle feature implementation

### For DevOps/SRE

1. Review [07_heroku_scheduler.md](./07_heroku_scheduler.md) for deployment
2. Check [06_repository_setup.md](./06_repository_setup.md) for environment config
3. Read [08_multi_agent_implementation.md](./08_multi_agent_implementation.md) for AI agent setup

---

## 📖 Document Conventions

### Status Indicators
- ✅ **Complete** - Fully implemented and documented
- 🔄 **In Progress** - Currently being developed
- ⏳ **Planned** - Scheduled for future implementation
- 🆕 **New** - Recently added documentation

### File Naming
- Documents are numbered for logical reading order
- Use underscores for multi-word file names
- `.md` extension for Markdown documents

### Content Structure
Each document follows this structure:
```markdown
# Title

## Document Information
- Version
- Date
- Status
- Purpose

## Content sections...

## References
```

---

## 🔧 System Overview

### Core Components

**Campaign Manager**
- Multi-agent AI system for campaign analysis
- Automated scheduling and notifications
- Real-time performance reporting
- MailJet integration for email campaigns

**Key Features**
- ✅ Multi-agent AI analytics (Google Gemini)
- ✅ Executive-level reporting
- ✅ FIFO user segmentation
- ✅ Automated campaign lifecycle
- ✅ Slack notifications
- ✅ MailJet API integration
- ✅ PostgreSQL with Prisma ORM
- ✅ TypeScript/Node.js runtime

---

## 🎯 Current Implementation Status

### Phase 1: Foundation (Complete)
- ✅ Core infrastructure
- ✅ Database schema
- ✅ API endpoints
- ✅ Authentication

### Phase 2: Campaign Management (Complete)
- ✅ Campaign lifecycle
- ✅ Scheduling system
- ✅ Notification system
- ✅ MailJet integration

### Phase 3: AI Enhancement (Complete) - Sept 30, 2025
- ✅ Campaign Analytics Agent
- ✅ Report Formatting Agent
- ✅ Multi-agent orchestration
- ✅ Executive reporting

### Phase 4: User Segmentation (Complete) - Sept 30, 2025
- ✅ FIFO strategy documented
- ✅ Batch list creation automated
- ✅ Round 2 list created (campaign_batch_002)
- ✅ Validation procedures

---

## 📊 Active Campaigns

### Client Letter Campaign (Sept-Oct 2025)

**Round 1** (Complete)
- Users: 1-1,000
- List: campaign_batch_001 (ID: 10502980)
- Status: ✅ Launched

**Round 2** (Complete - Sept 30, 2025)
- Users: 1,001-2,000
- List: campaign_batch_002 (ID: 10503118)
- Campaign ID: 7758985090
- Status: ✅ Launched

**Round 3** (Setup - Oct 2, 2025)
- Users: 2,001-3,529 (ALL remaining - 1,529 users)
- List: campaign_batch_003 (ID: 10503192)
- Campaign ID: TBD (pending manual creation)
- Launch: 9:15 AM UTC Oct 2
- Status: 🟡 List Ready - Campaign Pending

---

## 🛠️ Useful Commands

### Development
```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Campaign Operations
```bash
# Investigate existing lists
node scripts/investigate-round1-list.js

# Create new batch list
node scripts/create-round2-list.js

# Verify list creation
node scripts/verify-round2-list.js

# Test notifications
node scripts/test-notification.js
```

### Database
```bash
# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Update schedule
node scripts/populate-week-schedule.js
```

---

## 📝 Contributing

When adding new documentation:

1. **Follow naming convention**: `[number]_[descriptive_name].md`
2. **Update this README**: Add entry in appropriate section
3. **Include metadata**: Version, date, status, purpose
4. **Add references**: Link to related docs
5. **Use clear language**: Write for your audience

---

## 🔗 External Resources

### MailJet
- API Documentation: https://dev.mailjet.com/email/reference/
- Dashboard: https://app.mailjet.com/

### Google Gemini
- API Documentation: https://ai.google.dev/docs
- API Key: https://aistudio.google.com/app/apikey

### Deployment
- Heroku Dashboard: https://dashboard.heroku.com/
- Campaign Manager App: https://campaign-manager-prod.herokuapp.com/

### Related Systems
- Marketing Agent: `/00_traction/marketing_agent`
- Slack Manager: External MCP service

---

## 📞 Support

### For Questions
- Review relevant documentation first
- Check implementation status
- Consult API specifications
- Review workflow documentation

### For Issues
- Check logs: `logs/app.log`
- Verify environment variables
- Confirm dependencies installed
- Review error messages carefully

---

## 📅 Last Updated

**Date**: October 1, 2025
**Version**: 1.2
**Contributors**: Campaign Manager Development Team
**Recent Changes**:
- ✅ Added bounce management documentation
- ✅ Created logging structure for campaign operations
- ✅ Reorganized docs into guides/ and archive/
- ✅ Added technical documentation (MCP, Implementation Status, PR Guide)
- ✅ Documented bounce cleanup for campaigns 1 & 2

---

*This documentation is continuously updated as the system evolves. Check the individual document dates for the most recent information.*