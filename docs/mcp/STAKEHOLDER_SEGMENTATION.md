# 3-Round Stakeholder Segmentation Model

**Last Updated**: October 2, 2025
**Status**: Production Standard

---

## Overview

Every marketing campaign follows a proven **3-round segmentation model** targeting different stakeholder groups with tailored messaging. This approach was established with the successful Client Letter Automation campaign and is now standard for all releases.

---

## Total Audience Size

**~3,000 recipients per campaign** distributed across 3 rounds:
- Round 1 (Leadership): ~1,000 recipients
- Round 2 (Compliance): ~500 recipients
- Round 3 (Users): ~1,500 recipients

---

## Round 1: Leadership Stakeholders

### Timing
**Week 1, Tuesday 9:00 AM UTC**

### Target Audience
- Practice owners
- Partners
- Senior management
- Business decision-makers
- Strategic stakeholders

### List Naming Convention
```
{campaign-name}-leadership
```

**Examples**:
- `client-letter-leadership`
- `drawdown-features-leadership`
- `voyant-integration-leadership`

### Message Focus
- **Strategic value** - Business impact and ROI
- **Competitive advantage** - Market differentiation
- **Growth enablement** - Scale and efficiency
- **Executive metrics** - KPIs and performance indicators

### MailJet Template Customization
```html
<!-- Leadership-specific content -->
<h2>Strategic Impact for Your Practice</h2>
<p>This release delivers measurable ROI through...</p>

<!-- Executive metrics -->
<ul>
  <li>Time saved per adviser: 2+ hours/week</li>
  <li>Revenue protection: Enhanced compliance</li>
  <li>Client satisfaction: Faster turnaround</li>
</ul>

<!-- CTA for leadership -->
<a href="#">Review Business Case</a>
```

### Recipient Count
**~1,000 recipients** (33% of total)

---

## Round 2: Compliance Stakeholders

### Timing
**Week 2, Tuesday 9:00 AM UTC** (7 days after Round 1)

### Target Audience
- Compliance officers
- Operations managers
- Risk managers
- Quality assurance leads
- Regulatory specialists

### List Naming Convention
```
{campaign-name}-compliance
```

**Examples**:
- `client-letter-compliance`
- `drawdown-features-compliance`
- `voyant-integration-compliance`

### Message Focus
- **Regulatory alignment** - FCA & Consumer Duty compliance
- **Risk mitigation** - Audit trails and documentation
- **Policy adherence** - Firm-wide standards
- **Quality assurance** - Consistent delivery

### MailJet Template Customization
```html
<!-- Compliance-specific content -->
<h2>Meeting Regulatory Requirements</h2>
<p>This feature ensures full compliance with...</p>

<!-- Regulatory checklist -->
<ul>
  <li>✅ FCA Consumer Duty alignment</li>
  <li>✅ Automated audit trail</li>
  <li>✅ Risk scoring integration</li>
  <li>✅ Policy-compliant templates</li>
</ul>

<!-- CTA for compliance -->
<a href="#">Download Compliance Guide</a>
```

### Recipient Count
**~500 recipients** (17% of total)

---

## Round 3: User Stakeholders

### Timing
**Week 3, Tuesday 9:00 AM UTC** (7 days after Round 2, 14 days after Round 1)

### Target Audience
- Active advisers
- PAs and support staff
- End users of the platform
- Practice teams
- Day-to-day operators

### List Naming Convention
```
{campaign-name}-users
```

**Examples**:
- `client-letter-users`
- `drawdown-features-users`
- `voyant-integration-users`

### Message Focus
- **Feature benefits** - Practical time savings
- **How-to guidance** - Step-by-step instructions
- **Productivity gains** - Efficiency improvements
- **Support resources** - Training and help docs

### MailJet Template Customization
```html
<!-- User-specific content -->
<h2>Save 2+ Hours Per Week</h2>
<p>Generate client letters in minutes, not hours...</p>

<!-- Practical benefits -->
<ul>
  <li>One-click letter generation</li>
  <li>Auto-populated client data</li>
  <li>Customizable templates</li>
  <li>Instant compliance checks</li>
</ul>

<!-- CTA for users -->
<a href="#">Watch Demo Video</a>
<a href="#">Try It Now</a>
```

### Recipient Count
**~1,500 recipients** (50% of total)

---

## Why This Model Works

### 1. **Progressive Buy-In**
- Leadership sees strategic value first
- Compliance validates regulatory alignment
- Users receive practical, approved features

### 2. **Tailored Messaging**
- Each group gets relevant content
- No generic "one-size-fits-all" emails
- Higher engagement and activation rates

### 3. **Managed Rollout**
- Identify issues early (leadership feedback)
- Address compliance concerns before broad release
- Scale to users with confidence

### 4. **Channel Load Management**
- Spreads notifications across 3 weeks
- Prevents #_traction channel overload
- Each round gets dedicated attention

### 5. **Proven Results**
From Client Letter Automation campaign:
- Leadership: 42% open rate, strong strategic feedback
- Compliance: 38% open rate, regulatory validation
- Users: 35% open rate, 22% feature activation within 1 week

---

## MailJet List Management

### List Creation Process

For each campaign, create 3 MailJet contact lists:

```bash
# Example: Drawdown Features campaign

1. Create "Drawdown Features - Leadership"
   - Import ~1,000 leadership contacts
   - Tags: leadership, stakeholder, decision-maker

2. Create "Drawdown Features - Compliance"
   - Import ~500 compliance contacts
   - Tags: compliance, operations, risk

3. Create "Drawdown Features - Users"
   - Import ~1,500 user contacts
   - Tags: adviser, user, end-user
```

### List Naming Standards

**Pattern**: `{Campaign Name} - {Stakeholder Group}`

**Examples**:
- "Client Letter Automation - Leadership"
- "Client Letter Automation - Compliance"
- "Client Letter Automation - Users"

**List IDs**:
Store MailJet list IDs in campaign configuration:
```json
{
  "campaignName": "Drawdown Features",
  "mailjetListIds": [
    123456,  // Leadership list
    123457,  // Compliance list
    123458   // Users list
  ]
}
```

---

## Campaign Creation with MCP

### Using MCP Tools

When creating a campaign via MCP, specify the 3 MailJet list IDs:

```typescript
// MCP tool: create_lifecycle_campaign
{
  "campaignName": "Voyant Integration",
  "listIdPrefix": "voyant-integration",
  "subject": "New Integration: Seamless Voyant Cashflow Planning",
  "senderName": "Digital Clipboard",
  "senderEmail": "hello@digitalclipboard.com",
  "totalRecipients": 3000,

  // ✅ Reference lists, not recipient counts
  "mailjetListIds": [
    987654,  // voyant-integration-leadership (~1,000)
    987655,  // voyant-integration-compliance (~500)
    987656   // voyant-integration-users (~1,500)
  ],

  "mailjetTemplateId": 123456,
  "notificationChannel": "#_traction"
}
```

### Automatic Round Assignment

Campaign Manager automatically distributes:
- `mailjetListIds[0]` → Round 1 (Leadership)
- `mailjetListIds[1]` → Round 2 (Compliance)
- `mailjetListIds[2]` → Round 3 (Users)

### Automatic Scheduling

Default: 3 weekly rounds on Tuesdays at 9am:
- Round 1: Week 1, Tuesday 9:00 AM UTC
- Round 2: Week 2, Tuesday 9:00 AM UTC (Round 1 + 7 days)
- Round 3: Week 3, Tuesday 9:00 AM UTC (Round 2 + 7 days)

---

## Template Variations

### Shared Elements (All Rounds)

```html
<!-- Header -->
<img src="logo.png" alt="Digital Clipboard">
<h1>New Release: {Campaign Name}</h1>

<!-- Release info -->
<p>Release Date: {Release Date}</p>
<p>Theme: {Theme}</p>

<!-- Footer -->
<p>Questions? Email support@digitalclipboard.com</p>
<p><a href="#">Unsubscribe</a></p>
```

### Round-Specific Content

**Leadership Template**:
- Business case and ROI
- Executive summary
- Strategic metrics
- CTA: "Review Business Impact"

**Compliance Template**:
- Regulatory alignment details
- Compliance checklist
- Audit trail information
- CTA: "Download Compliance Guide"

**Users Template**:
- Feature walkthrough
- Step-by-step guide
- Demo video
- CTA: "Try It Now" / "Watch Demo"

---

## Metrics by Stakeholder Group

### Track Separately

Each round should have independent metrics:

```json
{
  "campaignName": "Drawdown Features",
  "rounds": [
    {
      "roundNumber": 1,
      "stakeholderGroup": "Leadership",
      "metrics": {
        "sent": 1000,
        "opened": 420,
        "clicked": 85,
        "openRate": 42.0,
        "clickRate": 8.5
      }
    },
    {
      "roundNumber": 2,
      "stakeholderGroup": "Compliance",
      "metrics": {
        "sent": 500,
        "opened": 190,
        "clicked": 48,
        "openRate": 38.0,
        "clickRate": 9.6
      }
    },
    {
      "roundNumber": 3,
      "stakeholderGroup": "Users",
      "metrics": {
        "sent": 1500,
        "opened": 525,
        "clicked": 330,
        "openRate": 35.0,
        "clickRate": 22.0
      }
    }
  ]
}
```

### Success Benchmarks

**Leadership (Round 1)**:
- Open rate: >35%
- Click rate: >7%
- Strategic feedback received

**Compliance (Round 2)**:
- Open rate: >30%
- Click rate: >8%
- No regulatory concerns raised

**Users (Round 3)**:
- Open rate: >30%
- Click rate: >15%
- Feature activation: >20% within 1 week

---

## Q4 2025 Implementation

### All Campaigns Follow This Model

| Campaign | Round 1 (Leadership) | Round 2 (Compliance) | Round 3 (Users) |
|----------|---------------------|---------------------|-----------------|
| Client Letter | Sept 19 | Sept 26 | Oct 3 |
| Drawdown Features | Oct 1 | Oct 8 | Oct 15 |
| Voyant Integration | Oct 15 | Oct 22 | Oct 29 |
| Management Info | Oct 29 | Nov 5 | Nov 12 |
| Client Toolkit | Nov 12 | Nov 19 | Nov 26 |
| Compliance Corner | Nov 26 | Dec 3 | Dec 10 |
| Case Study | Dec 10 | Dec 17 | Dec 24 |
| Year in Review | Dec 17 | Dec 24 | Dec 31 |

**Total**: 24 campaign rounds across 8 campaigns

---

## Best Practices

### ✅ Do

- Always use 3-round stakeholder segmentation
- Create separate MailJet lists for each group
- Customize messaging for each stakeholder type
- Track metrics separately by round
- Maintain ~1,000 / ~500 / ~1,500 distribution

### ❌ Don't

- Send same message to all stakeholders
- Skip rounds or combine audiences
- Ignore stakeholder-specific concerns
- Use generic "all users" lists
- Deviate from Tuesday 9am schedule without reason

---

## Future Enhancements

### Planned Improvements

- **Dynamic segmentation**: AI-powered audience optimization
- **Personalized send times**: Optimal engagement windows per stakeholder
- **A/B testing**: Message variants within each round
- **Predictive metrics**: Forecast performance before sending
- **Automated list hygiene**: Bounce handling and suppression

---

## References

**Success Story**: Client Letter Automation campaign (Sept 2025)
- 3 rounds, 3,000 recipients
- 38% average open rate across all rounds
- 12% average click rate
- 22% feature activation within 1 week
- Zero regulatory concerns raised

**Model documented in**:
- `/docs/CAMPAIGN_REVIEW_2025_10_02.md`
- MailJet templates: `/templates/campaigns/manual/`

**Related Documentation**:
- [Q4_2025_SCHEDULE.md](./Q4_2025_SCHEDULE.md) - Full campaign calendar
- [README.md](./README.md) - MCP integration overview
- [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md) - MCP tool docs
