# Bounce Cleanup Quick Start Guide

**Last Updated**: October 1, 2025
**Time to Complete**: 15-20 minutes

---

## Prerequisites

✅ Node.js installed
✅ Campaign manager repository cloned
✅ `.env` file configured with Mailjet credentials
✅ Database running (PostgreSQL)

---

## Step 1: One-Time Setup (5 minutes)

### 1.1 Run Database Migration

```bash
cd campaign_manager

# Run migration to create suppressed_contacts table
psql $DATABASE_URL < prisma/migrations/add_suppressed_contacts_table.sql

# OR using Prisma
npx prisma db push
```

### 1.2 Create Suppression List in Mailjet

```bash
node scripts/create-suppression-list.js
```

**Expected Output**:
```
✅ SUPPRESSION LIST CREATED SUCCESSFULLY!
📋 List Name: suppressed_contacts
🆔 List ID: 10503500
```

### 1.3 Configure Environment Variable

Add the List ID to your `.env` file:

```bash
MAILJET_SUPPRESSION_LIST_ID=10503500
```

**Setup Complete!** 🎉

---

## Step 2: Analyze Bounces (3-5 minutes)

**When to run**: 24-48 hours after campaign send

```bash
node scripts/analyze-bounces.js
```

**What happens**:
- Fetches bounce events from Mailjet for batches 1, 2, and 3
- Categorizes as hard bounces (permanent) or soft bounces (temporary)
- Generates 3 report files in `scripts/` directory

**Expected Output**:
```
📊 COMPREHENSIVE BOUNCE ANALYSIS REPORT
========================================

campaign_batch_001 (Round 1):
   Hard Bounces: 45
   Soft Bounces: 12
   Bounce Rate: 5.7%

TOTALS ACROSS ALL BATCHES:
   🔴 Total Hard Bounces: 123
   🟡 Total Soft Bounces: 34
   📊 Overall Bounce Rate: 5.23%

📄 Detailed CSV report saved: bounce-report-2025-10-01.csv
📄 Detailed JSON report saved: bounce-report-2025-10-01.json
📄 Hard bounce Contact IDs saved: hard-bounce-contact-ids-2025-10-01.txt
```

---

## Step 3: Review Report (2 minutes)

Open the CSV report to review:

```bash
open scripts/bounce-report-2025-10-01.csv
```

**Check**:
- ✅ Bounce rate is reasonable (< 10%)
- ✅ Bounce reasons look legitimate
- ✅ Contact IDs are numeric and valid

**⚠️ If bounce rate > 10%**: Investigate data quality issues before cleanup

---

## Step 4: Run Cleanup - Dry Run (2 minutes)

**Important**: Always dry run first!

```bash
node scripts/cleanup-bounced-contacts.js --dry-run scripts/bounce-report-2025-10-01.json
```

**What happens**:
- Shows what WOULD be changed (no actual changes)
- Verifies script can access Mailjet API
- Validates database connection

**Expected Output**:
```
🧹 BOUNCED CONTACTS CLEANUP
===========================
Mode: 🔍 DRY RUN

Processing campaign_batch_001 (Round 1)
🔴 Processing 45 hard bounce(s)...
   Processing Contact 12345678 (user@example.com)...
      [DRY RUN] Would remove from master list and batch lists
      [DRY RUN] Would add to suppression list
      [DRY RUN] Would record in database

📝 DRY RUN COMPLETE - No changes were made
   Run without --dry-run flag to execute cleanup
```

---

## Step 5: Execute Cleanup (5-10 minutes)

**Ready?** Run the real cleanup:

```bash
node scripts/cleanup-bounced-contacts.js scripts/bounce-report-2025-10-01.json
```

**What happens**:
- Removes hard bounce contacts from master "users" list
- Removes from campaign batch lists
- Adds to suppression list in Mailjet
- Records all changes in database with audit trail

**Expected Output**:
```
🧹 BOUNCED CONTACTS CLEANUP
===========================
Mode: ✅ LIVE

Processing campaign_batch_001 (Round 1)
🔴 Processing 45 hard bounce(s)...
   Processing Contact 12345678 (user@example.com)...
      ✓ Removed from master list
      ✓ Removed from campaign_batch_001
      ✓ Added to suppression list
      ✓ Created database record

📊 CLEANUP SUMMARY
==================
Total Hard Bounces Processed: 123
Total Soft Bounces Suppressed: 3
✅ Successful: 126
❌ Failed: 0

📄 Cleanup report saved: cleanup-report-2025-10-01.json
```

---

## Step 6: Verify Results (3 minutes)

### 6.1 Check Mailjet Dashboard

1. Go to https://app.mailjet.com/contacts/lists
2. Check "users" list count (should be lower)
3. Check "suppressed_contacts" list (should have new contacts)

### 6.2 Verify Database

```bash
# Check suppression count
npx prisma studio

# Or via SQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM suppressed_contacts WHERE status='active';"
```

**Expected**: Count matches number of processed bounces

---

## Step 7: Create Next Campaign Batch (2 minutes)

**Use the NEW script** that automatically excludes suppressed contacts:

```bash
# Example: Create Round 4 batch
node scripts/create-batch-list.js --round=4 --size=1000
```

**Expected Output**:
```
✅ BATCH LIST CREATED SUCCESSFULLY!
📋 List Name: campaign_batch_004
🆔 List ID: 10503600
👥 Contacts Added: 1,000
🚫 Suppressed Contacts Excluded: 123
```

**🎉 Done!** Your next campaign will automatically skip suppressed contacts.

---

## Quick Reference

### Common Commands

```bash
# Analyze bounces (run 24-48 hours after campaign)
node scripts/analyze-bounces.js

# Cleanup (dry run first)
node scripts/cleanup-bounced-contacts.js --dry-run <report.json>
node scripts/cleanup-bounced-contacts.js <report.json>

# Create new batch (always use this for future campaigns)
node scripts/create-batch-list.js --round=<number> --size=1000
```

### File Locations

- **Reports**: `scripts/bounce-report-*.json`
- **Cleanup Reports**: `scripts/cleanup-report-*.json`
- **Documentation**: `docs/10_bounce_management_guide.md`

### Key Environment Variables

```bash
MAILJET_API_KEY=<your_api_key>
MAILJET_SECRET_KEY=<your_secret_key>
MAILJET_SUPPRESSION_LIST_ID=<list_id_from_setup>
DATABASE_URL=<your_postgres_connection_string>
```

---

## Troubleshooting

### "No bounce events found"
**Solution**: Wait 24-48 hours after campaign send, then re-run

### "Database connection error"
**Solution**: Check `DATABASE_URL` in `.env`, verify database is running

### "Mailjet API authentication failed"
**Solution**: Verify `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` in `.env`

### Need more help?
See full documentation: [`docs/10_bounce_management_guide.md`](docs/10_bounce_management_guide.md)

---

## Maintenance Schedule

| Frequency | Task | Command |
|-----------|------|---------|
| After every campaign | Analyze & cleanup bounces | See Steps 2-5 |
| Monthly | Review bounce trends | Check reports in `scripts/` |
| Quarterly | Review soft bounces | Check revalidation eligibility |
| Ongoing | Use suppression-aware scripts | `create-batch-list.js` |

---

## Success Checklist

After completing this guide, you should have:

- ✅ Suppression list created in Mailjet
- ✅ Database table for tracking suppressions
- ✅ Analyzed bounce events from campaigns
- ✅ Cleaned up hard bounces from lists
- ✅ Recorded suppressions in database
- ✅ Verified changes in Mailjet dashboard
- ✅ Know how to create future campaigns with suppression filtering

**Congratulations!** Your email campaigns now have automated bounce management. 🎉

---

## Next Steps

1. **Automate**: Set up automated bounce cleanup job (see `docs/10_bounce_management_guide.md` - Workflow 2)
2. **Monitor**: Track bounce rates over time for each campaign
3. **Improve**: Review bounce reasons to identify data quality issues
4. **Maintain**: Run cleanup after every campaign

---

## Questions?

- Full Documentation: `docs/10_bounce_management_guide.md`
- Script Help: Add `--help` flag to any script
- Mailjet API Docs: https://dev.mailjet.com
