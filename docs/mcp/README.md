# Campaign Manager - MCP Integration

**Purpose**: This directory contains all MCP (Model Context Protocol) integration documentation and configuration for conversational AI control of the Campaign Manager system.

---

## 📁 Directory Structure

```
docs/mcp/
├── README.md                           # This file - MCP overview
├── TOOLS_REFERENCE.md                  # Complete tool documentation
├── Q4_2025_SCHEDULE.md                 # Q4 marketing campaign schedule
├── STAKEHOLDER_SEGMENTATION.md         # 3-round audience model
└── EXAMPLES.md                         # Conversational examples
```

---

## What is MCP?

**Model Context Protocol (MCP)** allows AI assistants (Claude, ChatGPT, etc.) to interact with Campaign Manager through structured tools instead of raw API calls.

### Benefits

**For Executives**:
- Natural language campaign management
- "What's launching this week?" → instant answer
- No technical knowledge required

**For Operations**:
- Weekly planning via conversation
- Forecast #_traction channel activity
- Quick rescheduling and updates

**For Analytics**:
- Post-campaign performance analysis
- AI-powered insights
- Comparative metrics across rounds

---

## Quick Start

### 1. Install MCP Server

```bash
cd /path/to/campaign_manager
npm install
npm run build
```

### 2. Configure MCP Client

Add to your MCP configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "campaign-manager": {
      "command": "node",
      "args": [
        "/path/to/campaign_manager/dist/integrations/mcp-clients/lifecycle-campaign-mcp-server.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@host:5432/dbname",
        "API_BASE_URL": "https://campaign-manager-prod.herokuapp.com"
      }
    }
  }
}
```

### 3. Test Connection

Open your AI assistant and try:
```
> "What campaigns are scheduled for next week?"
```

---

## Available Tools

### Planning & Visibility (4 tools)
- `get_upcoming_campaigns` - Next N days
- `get_weekly_schedule` - Week view
- `get_monthly_view` - Month calendar
- `get_slack_channel_activity` - Forecast notifications

### Campaign Management (4 tools)
- `create_lifecycle_campaign` - New 3-round campaign
- `get_campaign_schedule` - Flexible queries
- `update_campaign_schedule` - Reschedule/update
- `cancel_campaign` - Emergency cancellation

### Analytics (2 tools)
- `get_campaign_metrics` - Performance data
- `import_marketing_schedule` - Bulk import

**See**: [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md) for complete documentation

---

## Q4 2025 Marketing Schedule

Campaign Manager manages **8 marketing releases** across Q4 2025:

| Campaign | Release Date | Stakeholder Model |
|----------|-------------|-------------------|
| Client Letter Automation | Sept 19 | Leadership → Compliance → Users |
| Drawdown Features | Oct 1 | Leadership → Compliance → Users |
| Voyant Integration | Oct 15 | Leadership → Compliance → Users |
| Management Information | Oct 29 | Leadership → Compliance → Users |
| Client Material Tool Kit | Nov 12 | Leadership → Compliance → Users |
| Compliance Corner | Nov 26 | Leadership → Compliance → Users |
| Case Study | Dec 10 | Leadership → Compliance → Users |
| Year in Review | Dec 17 | Leadership → Compliance → Users |

**See**: [Q4_2025_SCHEDULE.md](./Q4_2025_SCHEDULE.md) for complete details

---

## 3-Round Stakeholder Model

Each campaign follows the proven 3-round segmentation:

### Round 1: Leadership (Week 1, Tuesday 9am)
- **Audience**: Practice owners, partners, senior management
- **List**: `{campaign-name}-leadership`
- **Message**: Strategic value, ROI, business impact
- **~1,000 recipients**

### Round 2: Compliance (Week 2, Tuesday 9am)
- **Audience**: Compliance officers, operations managers
- **List**: `{campaign-name}-compliance`
- **Message**: Regulatory alignment, risk mitigation, audit support
- **~500 recipients**

### Round 3: Users (Week 3, Tuesday 9am)
- **Audience**: Active advisers, PAs, end users
- **List**: `{campaign-name}-users`
- **Message**: Features, time savings, practical benefits
- **~1,500 recipients**

**Total per campaign**: ~3,000 recipients across 3 rounds

**See**: [STAKEHOLDER_SEGMENTATION.md](./STAKEHOLDER_SEGMENTATION.md) for detailed model

---

## Example Conversations

### Weekly Planning
```
You: "What campaigns are launching this week?"

AI: [uses get_weekly_schedule]

Response:
"Week of Oct 1-7, 2025:
- Tuesday Oct 1, 9:00 AM: Drawdown Features - Round 1 (Leadership)
  ~1,000 recipients
- No other campaigns this week"
```

### Forecast Channel Activity
```
You: "How busy will #_traction be next month?"

AI: [uses get_slack_channel_activity]

Response:
"Next 30 days: 40 notifications
- 8 campaigns launching
- Each campaign = 5 messages per round (Pre-Launch, Pre-Flight, Warning, Launch, Wrap-Up)
- Peak activity: Tuesdays 9am UTC"
```

### Create New Campaign
```
You: "Schedule a campaign for the Voyant Integration release on October 15th"

AI: [uses create_lifecycle_campaign]

Input:
- Campaign name: "Voyant Integration"
- Release date: Oct 15
- 3 rounds: Leadership (Oct 15), Compliance (Oct 22), Users (Oct 29)
- MailJet lists: voyant-leadership, voyant-compliance, voyant-users
- Total: 3,000 recipients

Response:
"✅ Created 3-round campaign:
- Round 1 (Leadership): Oct 15, 9am, ~1,000 recipients
- Round 2 (Compliance): Oct 22, 9am, ~500 recipients
- Round 3 (Users): Oct 29, 9am, ~1,500 recipients
- 15 Slack notifications scheduled to #_traction"
```

**See**: [EXAMPLES.md](./EXAMPLES.md) for more conversation patterns

---

## Files in This Directory

### [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md)
Complete MCP tool documentation:
- Tool descriptions
- Parameter schemas
- Request/response examples
- Error handling

### [Q4_2025_SCHEDULE.md](./Q4_2025_SCHEDULE.md)
Complete Q4 marketing schedule:
- 8 campaign details
- Timeline and themes
- Success metrics
- Import instructions

### [STAKEHOLDER_SEGMENTATION.md](./STAKEHOLDER_SEGMENTATION.md)
3-round audience model:
- Stakeholder definitions
- List naming conventions
- Message personalization
- Recipient distribution

### [EXAMPLES.md](./EXAMPLES.md)
Conversational AI examples:
- Common queries
- Multi-step workflows
- Error scenarios
- Best practices

---

## Integration with Other Systems

### MailJet
- Campaign creation and delivery
- List management
- Metrics collection

### Slack (#_traction)
- Pre-Launch notifications (T-24h)
- Pre-Flight verification (T-1h)
- Launch warnings (T-5min)
- Launch confirmations
- Wrap-up analytics (T+30min)

### Bull Queue
- Automated job scheduling
- Lifecycle stage orchestration
- Notification delivery

---

## Best Practices

### ✅ Do

- Check weekly schedule on Mondays for team planning
- Use `get_slack_channel_activity` before scheduling new campaigns
- Review metrics after all 3 rounds complete
- Follow 3-round stakeholder model for consistency

### ❌ Don't

- Schedule more than 2-3 campaigns per week (channel overload)
- Skip stakeholder segmentation (use all 3 rounds)
- Forget to verify MailJet lists exist before creating campaign
- Reschedule without checking for conflicts

---

## Support

**Documentation Issues**: File issue in campaign_manager repo
**MCP Server Issues**: Check logs in `dist/integrations/mcp-clients/`
**Questions**: #campaign-manager Slack channel or brian@digitalclipboard.com

---

## Related Documentation

**Main System**:
- [../CAMPAIGN_MANAGER_STATUS.md](../CAMPAIGN_MANAGER_STATUS.md) - System overview
- [../MEMORY_LEAK_ANALYSIS.md](../MEMORY_LEAK_ANALYSIS.md) - Performance optimization

**API Documentation**:
- [../api/](../api/) - HTTP API reference
- REST endpoints mirror MCP tool functionality

**Lifecycle System**:
- [../lifecycle/](../lifecycle/) - 3-round automation details
- Pre-Flight, Launch, Wrap-Up stages
