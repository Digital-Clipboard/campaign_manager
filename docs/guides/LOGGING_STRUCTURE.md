# Campaign Manager - Logging & Documentation Structure

Quick reference for how we track campaign operations and cleanup activities.

---

## 📁 File Structure Overview

```
campaign_manager/
│
├── 📊 CAMPAIGN_CHANGELOG.md              # High-level timeline (all operations)
│
├── 📂 logs/                               # Machine-readable logs
│   └── bounce-cleanup/                    # Automated cleanup logs
│       ├── 2025-10-01-campaign-7758947928.json
│       └── 2025-10-01-campaign-7758985090.json
│
├── 📂 records/                            # Human-readable documentation
│   ├── README.md                          # How to use this system
│   └── campaigns/                         # Individual campaign records
│       ├── campaign-7758947928.md
│       └── campaign-7758985090.md
│
└── 📂 scripts/                            # Automation scripts
    ├── simple-bounce-cleanup.js           # Auto-logs to logs/bounce-cleanup/
    └── list-recent-campaigns.js
```

---

## 🔄 Workflow: After Each Campaign

### 1. **Campaign Sends** (Day 0)
- Launch campaign via Mailjet
- Note Campaign ID from Mailjet dashboard

### 2. **Wait 24-48 Hours** (Days 1-2)
- Allow bounces to settle

### 3. **Run Bounce Cleanup** (Day 2-3)
```bash
node scripts/simple-bounce-cleanup.js --campaign-id=<ID>
```

**What happens automatically**:
- ✅ Fetches bounced contacts from Mailjet
- ✅ Removes from all lists
- ✅ **Auto-creates log**: `logs/bounce-cleanup/YYYY-MM-DD-campaign-<ID>.json`

### 4. **Create Campaign Record** (Day 2-3)
Manually create: `records/campaigns/campaign-<ID>.md`

**Include**:
- Campaign timeline (send date, cleanup date)
- Performance metrics from Mailjet
- Link to automated log
- Notes on issues/patterns

### 5. **Update Changelog** (Day 2-3)
Add entry to `CAMPAIGN_CHANGELOG.md`:
```markdown
### October 1, 2025 - Bounce Cleanup
- ✅ Campaign <ID> - Removed X bounced contacts
- Detail: See records/campaigns/campaign-<ID>.md
```

---

## 📝 What Gets Logged Where

| Information | Location | Format | Created By |
|-------------|----------|--------|------------|
| **Detailed bounce metrics** | `logs/bounce-cleanup/*.json` | JSON | **Automatic** (script) |
| **Campaign history** | `records/campaigns/*.md` | Markdown | Manual |
| **High-level timeline** | `CAMPAIGN_CHANGELOG.md` | Markdown | Manual |

---

## 📋 Templates & Examples

### Automated Log (JSON)
**File**: `logs/bounce-cleanup/2025-10-01-campaign-7758947928.json`

```json
{
  "cleanupDate": "2025-10-01T18:30:00Z",
  "campaignId": "7758947928",
  "bouncedContacts": 269,
  "masterListRemoved": 269,
  "listsProcessed": ["campaign_batch_001", "campaign_batch_002", "campaign_batch_003"],
  "sampleContacts": [
    { "email": "user@example.com", "reason": "Hard bounce" }
  ]
}
```

### Campaign Record (Markdown)
**File**: `records/campaigns/campaign-7758947928.md`

```markdown
# Campaign Record: Client Letters Round 1

**Campaign ID**: 7758947928
**Batch**: campaign_batch_001

## Timeline
- Sep 26: Campaign launched
- Oct 1: Bounce cleanup completed

## Performance
- Delivered: 731 (73.1%)
- Bounced: 242 (24.2%) ⚠️

## Cleanup
- Removed 269 bounced contacts
- Log: logs/bounce-cleanup/2025-10-01-campaign-7758947928.json
```

### Changelog Entry
**File**: `CAMPAIGN_CHANGELOG.md`

```markdown
### October 1, 2025 - Bounce Cleanup
✅ Campaign 7758947928 (Round 1) - Removed 269 bounced contacts
✅ Campaign 7758985090 (Round 2) - Removed 269 bounced contacts

Total: 538 bounced contacts cleaned
```

---

## 🔍 Quick Commands

### View all cleanup logs
```bash
ls -la logs/bounce-cleanup/
```

### Check latest campaign record
```bash
ls -t records/campaigns/ | head -1 | xargs -I {} cat "records/campaigns/{}"
```

### View changelog
```bash
cat CAMPAIGN_CHANGELOG.md
```

### Find campaign by ID
```bash
grep -r "7758947928" records/
```

### Count total cleanups
```bash
ls logs/bounce-cleanup/*.json | wc -l
```

---

## ✅ Checklist: After Each Campaign

After running `simple-bounce-cleanup.js`:

- [ ] ✅ Automated log created in `logs/bounce-cleanup/`
- [ ] 📝 Created/updated campaign record in `records/campaigns/`
- [ ] 📊 Added entry to `CAMPAIGN_CHANGELOG.md`
- [ ] 🔍 Reviewed bounce rate (alert if >5%)
- [ ] 📧 Noted any patterns or issues
- [ ] 🔗 Cross-referenced related campaigns

---

## 🎯 Benefits of This System

### For You (Human)
- **Quick Reference**: Changelog shows everything at a glance
- **Campaign History**: Detailed records per campaign
- **Pattern Detection**: Easy to spot trends across campaigns

### For Automation
- **Structured Data**: JSON logs for programmatic analysis
- **Audit Trail**: Complete history of all cleanup operations
- **Integration Ready**: Logs can feed dashboards/reports

### For Compliance
- **Documentation**: What was done, when, and why
- **Traceability**: Link from changelog → record → detailed log
- **Retention**: Permanent record of all operations

---

## 💡 Tips

1. **Document immediately** - Don't wait, create records same day
2. **Note patterns** - High bounce rates, timing issues, etc.
3. **Link related items** - Cross-reference campaigns and batches
4. **Keep changelog current** - Add entries for all major operations
5. **Review monthly** - Look for trends across multiple campaigns

---

## 🚨 Current Issue Alert

**High Bounce Rates Detected**:
- Campaign 7758947928: 24.2% (10x above threshold)
- Campaign 7758985090: 26.3% (10x above threshold)

**Action Required**: Investigate email list data quality
**Documented In**:
- `records/campaigns/campaign-7758947928.md`
- `records/campaigns/campaign-7758985090.md`
- `CAMPAIGN_CHANGELOG.md`

---

**Last Updated**: October 1, 2025
