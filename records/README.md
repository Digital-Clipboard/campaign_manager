# Campaign Records & Logs

Documentation system for tracking campaign operations and cleanup activities.

---

## Directory Structure

```
campaign_manager/
├── logs/                          # Machine-readable detailed logs
│   └── bounce-cleanup/            # Bounce cleanup operation logs (JSON)
│       ├── 2025-10-01-campaign-7758947928.json
│       └── 2025-10-01-campaign-7758985090.json
│
├── records/                       # Human-readable campaign records
│   └── campaigns/                 # Individual campaign documentation (Markdown)
│       ├── campaign-7758947928.md
│       └── campaign-7758985090.md
│
└── CAMPAIGN_CHANGELOG.md          # High-level timeline of all operations
```

---

## When to Create Records

### 1. **After Bounce Cleanup**
Run the cleanup script, which automatically logs to:
- `logs/bounce-cleanup/YYYY-MM-DD-campaign-{ID}.json` (detailed metrics)

Then manually create/update:
- `records/campaigns/campaign-{ID}.md` (human-readable summary)
- `CAMPAIGN_CHANGELOG.md` (add entry to timeline)

### 2. **After Campaign Launch**
Create initial campaign record:
- `records/campaigns/campaign-{ID}.md`
- Record send date, batch info, initial stats
- Update as events occur (cleanup, analysis, etc.)

---

## Log Formats

### Detailed Logs (JSON)
**Location**: `logs/bounce-cleanup/`
**Format**: `YYYY-MM-DD-campaign-{campaignID}.json`
**Purpose**: Machine-readable, detailed metrics for analysis

**Contents**:
```json
{
  "cleanupDate": "ISO timestamp",
  "campaignId": "string",
  "statistics": {
    "bounceRate": "percentage",
    "hardBounces": number,
    "softBounces": number
  },
  "cleanupActions": {
    "contactsRemoved": number,
    "listsCleanedFrom": [...]
  },
  "notes": [...]
}
```

### Campaign Records (Markdown)
**Location**: `records/campaigns/`
**Format**: `campaign-{campaignID}.md`
**Purpose**: Human-readable campaign history

**Sections**:
- Campaign Timeline (dates and events)
- Performance Metrics
- Cleanup Operations
- Issues & Notes
- Related Campaigns

### Changelog (Markdown)
**Location**: `CAMPAIGN_CHANGELOG.md`
**Format**: Chronological entries
**Purpose**: Quick reference for all major events

---

## Usage Examples

### After Running Bounce Cleanup

1. **Check the auto-generated log**:
   ```bash
   cat logs/bounce-cleanup/2025-10-01-campaign-7758947928.json
   ```

2. **Update campaign record**:
   - Edit `records/campaigns/campaign-7758947928.md`
   - Add cleanup section with date, contacts removed, notes

3. **Update changelog**:
   - Edit `CAMPAIGN_CHANGELOG.md`
   - Add entry under current date

### Creating New Campaign Record

```bash
# Copy template
cp records/campaigns/campaign-template.md records/campaigns/campaign-{ID}.md

# Fill in:
# - Campaign ID, name, send date
# - Batch information
# - Initial metrics from Mailjet dashboard
```

---

## Querying Logs

### Find all cleanups for a specific campaign
```bash
find logs/bounce-cleanup -name "*campaign-7758947928*"
```

### Count total bounced contacts removed
```bash
jq '.cleanupActions.totalContactsRemoved' logs/bounce-cleanup/*.json | paste -sd+ | bc
```

### Get all campaigns with bounce rate > 10%
```bash
for file in logs/bounce-cleanup/*.json; do
  rate=$(jq -r '.statistics.bounceRate' "$file" | sed 's/%//')
  if (( $(echo "$rate > 10" | bc -l) )); then
    echo "$file: $rate%"
  fi
done
```

---

## Best Practices

### 1. **Document Immediately**
- Run cleanup → Create logs same day
- Don't wait - details get forgotten

### 2. **Link Related Records**
- Cross-reference campaigns in records
- Use relative links in Markdown

### 3. **Note Patterns**
- Call out trends (increasing bounce rates, etc.)
- Document action items

### 4. **Keep Changelog Updated**
- Add entries for all major operations
- Use consistent format (date, action, impact)

### 5. **Review Regularly**
- Monthly review of bounce trends
- Quarterly analysis of campaign performance

---

## Template Files

### Campaign Record Template
See: `records/campaigns/campaign-template.md` (create if needed)

### Bounce Cleanup Log Schema
See: `logs/bounce-cleanup/schema.json` (create if needed)

---

## Retention Policy

**Logs**: Keep indefinitely (small files, valuable for analysis)
**Records**: Keep indefinitely (documentation)
**Changelog**: Maintain complete history

---

## Quick Reference

| Task | Command |
|------|---------|
| List all cleanup logs | `ls -la logs/bounce-cleanup/` |
| View campaign record | `cat records/campaigns/campaign-{ID}.md` |
| View changelog | `cat CAMPAIGN_CHANGELOG.md` |
| Find campaign by date | `grep "2025-09-26" records/campaigns/*.md` |
| Count total cleanups | `ls logs/bounce-cleanup/*.json \| wc -l` |

---

**Last Updated**: October 1, 2025
