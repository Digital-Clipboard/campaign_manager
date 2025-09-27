# Campaign Manager

> Complete lifecycle management for marketing campaigns with task automation, team coordination, approval workflows, and real-time analytics.

## 🎯 Overview

The Campaign Manager is a production-ready application that provides comprehensive campaign lifecycle management with intelligent task assignment, multi-stage approval workflows, and real-time analytics. Built with a modern MCP (Model Context Protocol) architecture for seamless integration with other Digital-Clipboard services.

## 🏗️ Architecture

### Service Architecture
```
GitHub Actions → Campaign Manager → Slack Manager → Slack
                      ↓
              MCP Integration Layer
                      ↓
        [Marketing Agent | Mailjet Agent | Campaign Orchestrator]
```

### Technology Stack
- **Framework**: Fastify 4.x (high-performance HTTP server)
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ for session storage and job queues
- **Queue Processing**: BullMQ for background jobs
- **Testing**: Vitest with 75%+ coverage
- **Integration**: MCP protocol for service communication

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Digital-Clipboard/campaign_manager.git
   cd campaign_manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Required Environment Variables

#### Core Configuration
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/campaign_manager

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
PORT=3001
```

#### API Keys
```env
# Anthropic API (for Claude integration)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Google Gemini API
GEMINI_API_KEY=AIzaSyDBL8vPi6XP5XYfs4A-Pg9MLLZIEfGZbCk

# Campaign Manager API (for webhook authentication)
CAMPAIGN_MANAGER_API_KEY=b11cf98b6338dc70690bcb6962777a7b2770353670530869b4e9335a5930b8e8
```

#### External Services (MCP Agents)
```env
MARKETING_AGENT_URL=http://localhost:3003
MAILJET_AGENT_URL=http://localhost:3004
SLACK_MANAGER_URL=http://localhost:3005
```

#### Slack Integration
```env
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
```

### Google Cloud Configuration
```env
GOOGLE_CLOUD_PROJECT_ID=campaign-473411
GOOGLE_CLOUD_PROJECT_NUMBER=686617390413
```

## 🏭 Production Deployment

### Deployment Architecture

The Campaign Manager follows a **"build once, deploy everywhere"** pattern using Heroku pipeline promotions:

#### Workflow Pattern
```
Feature Branch → PR to staging → CI/CD Tests → Merge to staging
       ↓
Heroku Auto-Deploy to Staging → Testing → Pipeline Promotion
       ↓
Production Deployment → Code Sync to main branch
```

### Heroku Infrastructure

#### Applications
- **Staging**: `campaign-manager-staging`
  - URL: https://campaign-manager-staging-087b1925d6ef.herokuapp.com
  - Auto-deploys from `staging` branch
- **Production**: `campaign-manager-prod`
  - URL: https://campaign-manager-prod-4ff79a873f5e.herokuapp.com
  - Deployments via pipeline promotion only

#### Pipeline
- **Name**: `campaign-manager`
- **Dashboard**: https://dashboard.heroku.com/pipelines/campaign-manager

### Deployment Commands

#### Staging Deployment (Automatic)
```bash
# Triggered automatically when merging to staging branch
git checkout staging
git merge feature/your-feature
git push origin staging
# Heroku auto-deploys after CI passes
```

#### Production Deployment (Manual Promotion)
```bash
# Promote tested staging artifact to production
heroku pipelines:promote -a campaign-manager-staging

# Separately sync code to main branch for storage
git checkout main
git merge staging
git push origin main
```

#### Rollback Procedures
```bash
# Fast rollback if issues found
heroku rollback -a campaign-manager-prod

# Or rollback to specific version
heroku releases -a campaign-manager-prod
heroku rollback v42 -a campaign-manager-prod
```

## 🧪 Testing

### Test Suite
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:unit
npm run test:integration
```

### Coverage Requirements
- **Minimum**: 75% overall coverage
- **Quality Gates**: All tests must pass before deployment
- **Testing Stack**: Vitest + PostgreSQL + Redis services

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Quality Gates**
   - Linting and type checking
   - Unit and integration tests
   - Security audit
   - Docker build validation

2. **Claude Code Review**
   - Automatic code review on pull requests
   - Security, performance, and best practices analysis

3. **Deployment Notifications**
   - GitHub Actions → Campaign Manager → Slack Manager → Slack
   - Rich deployment information including commit, actor, and workflow links

### Required GitHub Secrets

```env
# Anthropic API for Claude code reviews
ANTHROPIC_API_KEY=your-anthropic-api-key

# Heroku deployment credentials
HEROKU_API_KEY=your-heroku-api-token
HEROKU_EMAIL=your-heroku-email

# Campaign Manager webhook authentication
CAMPAIGN_MANAGER_API_KEY=b11cf98b6338dc70690bcb6962777a7b2770353670530869b4e9335a5930b8e8

# Slack notifications (fallback - primary routing through Campaign Manager)
SLACK_WEBHOOK=your-slack-webhook-url
```

## 🔌 MCP Integration

### Available MCP Clients

The Campaign Manager exposes 20+ tools via MCP protocol and integrates with:

#### Slack Manager Client
```typescript
// Send deployment notifications
await slackClient.sendMessage(channelId, message, blocks);

// Send direct messages
await slackClient.sendDirectMessage(userId, message);
```

#### Marketing Agent Client
```typescript
// Campaign performance analytics
await marketingAgent.analyzeCampaignPerformance(campaignId);
```

#### Mailjet Agent Client
```typescript
// Email campaign management
await mailjetAgent.createEmailCampaign(campaignData);
```

### Campaign Orchestrator
```typescript
// Multi-service workflow coordination
await orchestrator.executeCampaignWorkflow({
  campaign: campaignData,
  approvals: approvalFlow,
  notifications: notificationSettings
});
```

## 📊 Core Features

### Campaign Management
- Complete lifecycle management (planning → execution → analysis)
- Readiness scoring and validation
- Status transition workflows
- Activity logging and audit trails

### Task Automation
- Intelligent auto-assignment based on skills and workload
- Dependency management
- Overdue task tracking
- Workload balancing

### Approval Workflows
- Multi-stage approval routing (content → compliance → executive)
- Auto-approval rules with configurable deadlines
- Escalation policies for overdue approvals
- Interactive Slack approvals with buttons

### Team Coordination
- Availability tracking with weekly schedules
- Workload monitoring and capacity calculations
- Performance metrics and analytics
- Skill-based task matching

### Analytics & Reporting
- Real-time dashboard with WebSocket updates
- Campaign performance metrics
- Team utilization analytics
- Export capabilities (JSON, CSV, PDF, Excel)

## 🛠️ Development

### Project Structure
```
/src
├── /api/routes/          # 8 route modules (95+ endpoints)
├── /services/            # 15+ service classes
├── /integrations/        # MCP clients and orchestration
├── /types/              # Comprehensive TypeScript definitions
├── /utils/              # Logging, validation, helpers
├── /tests/              # Test suite (75% coverage)
└── /adapters/           # MCP server implementation
```

### Available Scripts
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run test          # Run test suite
npm run test:coverage # Run tests with coverage
npm run lint          # Run ESLint
npm run type-check    # Run TypeScript checks
npm run db:migrate    # Run database migrations
npm run db:seed       # Seed database with test data
```

### Database Management
```bash
# Reset database
npm run db:reset

# View database
npx prisma studio

# Generate Prisma client
npx prisma generate

# Create new migration
npx prisma migrate dev --name your-migration-name
```

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- API key authentication for webhooks
- Session management with Redis

### Security Measures
- Input validation middleware
- Rate limiting per endpoint
- SQL injection prevention
- XSS protection via Helmet
- CORS configuration

## 📈 Monitoring

### Health Checks
- Application health endpoint: `/health`
- Database connectivity checks
- Redis connectivity checks
- External service health monitoring

### Logging
- Structured logging with Winston
- Configurable log levels by environment
- Request/response logging
- Error tracking and alerting

### Metrics
- Application performance metrics
- Database query performance
- Cache hit/miss rates
- Queue processing statistics

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
npm run db:status

# Reset database
npm run db:reset
```

#### Redis Connection Issues
```bash
# Check Redis connectivity
redis-cli ping

# Clear Redis cache
redis-cli flushall
```

#### Environment Variables
```bash
# Verify environment setup
npm run env:check
```

### Logs and Debugging
```bash
# View application logs
heroku logs --tail --app campaign-manager-staging

# View specific dyno logs
heroku logs --tail --dyno web --app campaign-manager-prod

# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📞 Support

### Resources
- **Repository**: https://github.com/Digital-Clipboard/campaign_manager
- **Issues**: https://github.com/Digital-Clipboard/campaign_manager/issues
- **Documentation**: See `/docs` directory
- **API Documentation**: Available at `/api/docs` when running

### Team Contacts
- **Development Team**: Digital-Clipboard Organization
- **Deployment**: brian@digitalclipboard.com

## 📄 License

This project is part of the Digital-Clipboard organization. See the organization's license terms for usage rights and restrictions.

---

**Campaign Manager v1.0.0** - Production Ready
*Last Updated: January 2025*