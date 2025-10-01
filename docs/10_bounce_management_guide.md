# Bounce Management & Suppression List Guide

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: Active
- **Purpose**: Comprehensive guide for email bounce management and suppression list operations

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Scripts Reference](#scripts-reference)
4. [Database Schema](#database-schema)
5. [Operational Workflows](#operational-workflows)
6. [Suppression Rules](#suppression-rules)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

The bounce management system ensures high email deliverability by:
- Identifying and categorizing bounced emails (hard vs soft)
- Maintaining a suppression list of invalid/problematic contacts
- Automatically removing bounced contacts from mailing lists
- Preventing future sends to suppressed contacts
- Tracking bounce history for analysis and revalidation

### Key Benefits

- **Improved Deliverability**: Better sender reputation with lower bounce rates
- **Cost Savings**: Don't pay to send to invalid addresses
- **Accurate Metrics**: More reliable engagement statistics
- **Automation**: Reduces manual list cleanup work
- **Compliance**: Follows email best practices

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Campaign Send                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            Mailjet Delivery Attempts                         │
│  (Records bounce events for failed deliveries)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         24-48 Hour Delay (Automated Job)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Bounce Analysis Script                          │
│  • Fetch bounce events from Mailjet API                      │
│  • Categorize as hard or soft bounces                        │
│  • Generate detailed report with Contact IDs                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Cleanup Script                                  │
│  • Remove hard bounces from all lists                        │
│  • Add to suppression list in Mailjet                        │
│  • Record in database with audit trail                       │
│  • Track soft bounces for threshold monitoring               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Future Campaign Creation                             │
│  • Exclude suppressed contacts automatically                 │
│  • Generate clean batch lists                                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Campaign Execution**: Campaign sends to batch list
2. **Bounce Collection**: Mailjet records bounce events
3. **Analysis**: Script analyzes bounces 24-48 hours post-send
4. **Cleanup**: Removes bounced contacts from lists
5. **Suppression**: Adds to suppression list in Mailjet and database
6. **Prevention**: Future campaigns exclude suppressed contacts

---

## Scripts Reference

### 1. Analyze Bounces Script

**File**: [`scripts/analyze-bounces.js`](../scripts/analyze-bounces.js)

**Purpose**: Fetch and analyze bounce data from Mailjet for completed campaigns

**Usage**:
```bash
cd campaign_manager
node scripts/analyze-bounces.js
```

**What it does**:
- Fetches bounce events for batches 1, 2, and 3
- Categorizes bounces as hard (permanent) or soft (temporary)
- Generates detailed report with:
  - Contact IDs of bounced contacts
  - Email addresses
  - Bounce reasons
  - Error codes
  - Campaign source
- Saves reports in multiple formats:
  - `bounce-report-YYYY-MM-DD.json` - Full structured data
  - `bounce-report-YYYY-MM-DD.csv` - Spreadsheet format
  - `hard-bounce-contact-ids-YYYY-MM-DD.txt` - List of IDs for cleanup

**Output Example**:
```
📊 COMPREHENSIVE BOUNCE ANALYSIS REPORT
========================================

campaign_batch_001 (Round 1):
   List ID: 10502980
   Total Sent: ~1,000 (estimated)
   Hard Bounces: 45
   Soft Bounces: 12
   Bounce Rate: 5.7%

TOTALS ACROSS ALL BATCHES:
   🔴 Total Hard Bounces: 123
   🟡 Total Soft Bounces: 34
   📧 Total Bounces: 157
   📊 Overall Bounce Rate: 5.23%
```

---

### 2. Create Suppression List Script

**File**: [`scripts/create-suppression-list.js`](../scripts/create-suppression-list.js)

**Purpose**: Set up dedicated suppression list in Mailjet

**Usage**:
```bash
node scripts/create-suppression-list.js
```

**What it does**:
- Creates a new Mailjet list named "suppressed_contacts"
- Returns the List ID for configuration
- Checks if list already exists to avoid duplicates

**Output**:
```
✅ SUPPRESSION LIST CREATED SUCCESSFULLY!
📋 List Name: suppressed_contacts
🆔 List ID: 10503500
👥 Initial Contacts: 0

📝 NEXT STEPS:
1. Save List ID to environment variables:
   MAILJET_SUPPRESSION_LIST_ID=10503500
```

**Configuration**:
Add to `.env` file:
```bash
MAILJET_SUPPRESSION_LIST_ID=10503500
```

---

### 3. Cleanup Bounced Contacts Script

**File**: [`scripts/cleanup-bounced-contacts.js`](../scripts/cleanup-bounced-contacts.js)

**Purpose**: Remove bounced contacts from lists and add to suppression list

**Usage**:
```bash
# Dry run (no changes made)
node scripts/cleanup-bounced-contacts.js --dry-run bounce-report-2025-10-01.json

# Live execution
node scripts/cleanup-bounced-contacts.js bounce-report-2025-10-01.json
```

**What it does**:
- Reads bounce report JSON file
- For each hard bounce:
  - Removes from master "users" list (ID: 5776)
  - Removes from campaign batch list
  - Adds to suppression list in Mailjet
  - Records in database with full audit trail
- For soft bounces:
  - Records in database for tracking
  - Suppresses after 3-5 consecutive bounces
- Generates cleanup report

**Output Example**:
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
Total Hard Bounces Processed: 45
Total Soft Bounces Suppressed: 3
✅ Successful: 48
❌ Failed: 0
```

---

### 4. Create Batch List with Suppression Filtering

**File**: [`scripts/create-batch-list.js`](../scripts/create-batch-list.js)

**Purpose**: Create new campaign batch lists that automatically exclude suppressed contacts

**Usage**:
```bash
# Create Round 4 with 1000 contacts
node scripts/create-batch-list.js --round=4 --size=1000

# Create Round 5 with custom offset
node scripts/create-batch-list.js --round=5 --offset=4000 --size=500
```

**What it does**:
- Fetches all contacts from master list
- Fetches suppressed contacts from database
- Filters out suppressed contacts BEFORE slicing
- Creates clean batch list in Mailjet
- Reports how many contacts were excluded

**Output Example**:
```
🚀 Creating Campaign Batch List with Suppression Filtering
===========================================================
🎯 Round: 4
📊 Batch Size: 1000

Step 1: Fetching contacts from master "users" list...
   ✅ Total contacts fetched: 3,529

Step 2: Fetching suppressed contacts...
   ✅ Found 123 suppressed contacts

Step 3: Filtering out suppressed contacts...
   ✅ Filtered 123 suppressed contacts
   ✅ 3,406 valid contacts remaining

✅ BATCH LIST CREATED SUCCESSFULLY!
📋 List Name: campaign_batch_004
🆔 List ID: 10503600
👥 Contacts Added: 1,000
🚫 Suppressed Contacts Excluded: 123
```

---

## Database Schema

### SuppressedContact Model

**Table**: `suppressed_contacts`

**Purpose**: Track all suppressed email contacts with full audit trail

**Schema**:
```typescript
model SuppressedContact {
  id                      String    @id @default(uuid())

  // Contact identifiers
  contactId               BigInt    @unique // Mailjet Contact ID
  email                   String    @unique

  // Suppression details
  suppressionType         String    // hard_bounce, soft_bounce, spam_complaint, unsubscribe, manual
  reason                  String    // Detailed reason
  bounceCount             Int       @default(1)
  firstBounceDate         DateTime?
  lastBounceDate          DateTime?

  // Source tracking
  sourceCampaignId        String?   // Mailjet campaign ID
  sourceBatch             String?   // e.g., campaign_batch_001
  sourceRound             Int?      // Round number

  // Mailjet integration
  mailjetListId           BigInt?   // Suppression list ID
  mailjetBlocked          Boolean   @default(false)
  mailjetErrorCode        String?

  // Status and lifecycle
  status                  String    @default("active") // active, revalidated, removed
  isPermanent             Boolean   @default(true)
  revalidationEligibleAt  DateTime? // 180 days for soft bounces
  revalidatedAt           DateTime?

  // Audit trail
  suppressedBy            String    @default("system")
  notes                   String?
  metadata                Json?

  // Timestamps
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}
```

**Key Fields**:
- `contactId`: Mailjet's unique identifier for the contact
- `suppressionType`: Type of suppression (hard_bounce, soft_bounce, etc.)
- `bounceCount`: Number of times contact has bounced (used for soft bounce threshold)
- `isPermanent`: If false, contact may be revalidated after 180 days
- `sourceBatch`: Which campaign batch caused the suppression

**Indexes**:
- Email, Contact ID, Suppression Type, Status
- Source Batch, Created At, Revalidation Date
- Composite indexes for common queries

---

## Operational Workflows

### Workflow 1: Post-Campaign Cleanup (Recommended)

**Timeline**: 24-48 hours after campaign send

**Steps**:

1. **Wait for Bounces to Settle**
   - Most bounces occur within 24 hours
   - Some delayed bounces appear up to 48 hours

2. **Run Analysis Script**
   ```bash
   cd campaign_manager
   node scripts/analyze-bounces.js
   ```
   - Generates report files in `scripts/` directory
   - Review bounce-report-YYYY-MM-DD.json

3. **Review Report**
   - Check bounce rate (should be < 5%)
   - Identify patterns in bounce reasons
   - Verify Contact IDs look correct

4. **Run Cleanup (Dry Run First)**
   ```bash
   node scripts/cleanup-bounced-contacts.js --dry-run bounce-report-2025-10-01.json
   ```
   - Verify what will be changed
   - Review output for any issues

5. **Execute Cleanup**
   ```bash
   node scripts/cleanup-bounced-contacts.js bounce-report-2025-10-01.json
   ```
   - Removes bounced contacts
   - Adds to suppression list
   - Records in database

6. **Verify in Mailjet Dashboard**
   - Check master list count decreased
   - Check suppression list count increased
   - Spot check a few Contact IDs

---

### Workflow 2: Automated Cleanup (Future Implementation)

**Automated Job**: [`src/jobs/bounce-cleanup.jobs.ts`](../src/jobs/bounce-cleanup.jobs.ts)

**How it works**:
- Automatically triggered 24 hours after campaign send
- Runs as background job via BullMQ
- Performs same operations as manual cleanup script
- Sends Slack notification if bounce rate > 5%

**Enable**:
```typescript
import { scheduleBounceCleanup } from './jobs/bounce-cleanup.jobs';

// After campaign launch
await scheduleBounceCleanup({
  campaignName: 'Client Letter Campaign',
  roundNumber: 4,
  batchListId: 10503600,
  batchListName: 'campaign_batch_004',
  campaignId: '12345', // Mailjet campaign ID
  delayHours: 24
});
```

---

### Workflow 3: Creating New Campaign Batches

**Always use the new script** that filters suppressed contacts:

```bash
# Create next batch
node scripts/create-batch-list.js --round=4 --size=1000
```

**Old scripts (create-round2-list.js, etc.)**:
- ⚠️ Do NOT use - they don't filter suppressed contacts
- Kept for reference only

---

## Suppression Rules

### Hard Bounce Rules

**Definition**: Permanent delivery failure

**Common Reasons**:
- Email address doesn't exist
- Domain doesn't exist
- Mailbox has been deleted
- Invalid email format

**Action**:
- ✅ Suppress immediately (after 1 occurrence)
- ✅ Remove from all lists
- ✅ Never send again (permanent)
- ✅ No revalidation

**Threshold**: 1 bounce

---

### Soft Bounce Rules

**Definition**: Temporary delivery failure

**Common Reasons**:
- Mailbox full
- Server temporarily unavailable
- Connection timeout
- Greylisting (spam prevention)

**Action**:
- 🟡 Track and monitor
- 🟡 Suppress after 3-5 consecutive bounces
- 🟡 Eligible for revalidation after 180 days
- 🟡 May become deliverable again

**Threshold**: 3-5 consecutive bounces without successful delivery

---

### Spam Complaints

**Action**:
- ✅ Suppress immediately
- ✅ Permanent suppression
- ✅ Never send again
- ⚠️ Investigate why user marked as spam

---

### Manual Suppressions

**Use Cases**:
- User requests to never receive emails
- Known problematic addresses
- Test accounts
- Competitor addresses

**Process**:
```typescript
await prisma.suppressedContact.create({
  data: {
    contactId: BigInt(12345678),
    email: 'user@example.com',
    suppressionType: 'manual',
    reason: 'User requested removal via support ticket',
    suppressedBy: 'support_team',
    isPermanent: true
  }
});
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Bounce Rate per Campaign**
   - Target: < 2%
   - Warning: 2-5%
   - Critical: > 5%

2. **Hard Bounce Rate**
   - Target: < 1%
   - Warning: 1-3%
   - Critical: > 3%

3. **Suppression List Growth Rate**
   - Track week-over-week growth
   - Sudden spikes indicate data quality issues

4. **Deliverability Trends**
   - Monitor delivery rate over time
   - Should improve as list becomes cleaner

### Alerts to Configure

**High Bounce Rate Alert**:
```typescript
if (bounceRate > 5) {
  await sendSlackAlert({
    channel: '#email-alerts',
    message: `⚠️ High bounce rate detected: ${bounceRate}% in ${campaignName}`,
    urgency: 'high'
  });
}
```

**Suppression List Growth Alert**:
```typescript
if (weeklyGrowthRate > 10) {
  await sendSlackAlert({
    channel: '#email-alerts',
    message: `📈 Suppression list grew by ${weeklyGrowthRate}% this week`,
    urgency: 'medium'
  });
}
```

---

## Troubleshooting

### Issue: "No bounce events found"

**Possible Causes**:
- Campaign hasn't fully processed yet (wait 24-48 hours)
- Campaign ID incorrect
- Mailjet API credentials invalid

**Solution**:
- Wait longer and re-run analysis
- Verify campaign ID in Mailjet dashboard
- Check `.env` file for correct API keys

---

### Issue: "Database connection error"

**Possible Causes**:
- Database not running
- Connection string incorrect
- Prisma not initialized

**Solution**:
```bash
# Check database connection
psql $DATABASE_URL

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

### Issue: "Contact already in suppression list"

**This is normal!**
- Script checks for existing records
- Updates bounce count instead of creating duplicate
- Not an error

---

### Issue: "Cleanup script running slow"

**Expected**:
- Processing 100+ contacts takes several minutes
- Rate limiting delays prevent API throttling

**Speed up**:
- Reduce rate limiting delays (not recommended)
- Run during off-peak hours
- Process in smaller batches

---

### Issue: "Suppression list not excluding contacts"

**Checklist**:
1. Is `MAILJET_SUPPRESSION_LIST_ID` set in `.env`?
2. Did you run the database migrations?
3. Are you using the NEW `create-batch-list.js` script?
4. Check database: `SELECT COUNT(*) FROM suppressed_contacts WHERE status='active'`

**Solution**:
```bash
# Verify suppression list ID
echo $MAILJET_SUPPRESSION_LIST_ID

# Check database
npx prisma studio
# Navigate to suppressed_contacts table

# Use correct script
node scripts/create-batch-list.js --round=4 --size=1000
```

---

## Best Practices

### 1. Run Cleanup After Every Campaign

- Don't let bounces accumulate
- Clean lists maintain better deliverability
- Automated job recommended

### 2. Review Bounce Reports Monthly

- Look for patterns in bounce reasons
- Identify data quality issues early
- Track improvement trends

### 3. Revalidate Soft Bounces Quarterly

- Soft bounces may become valid again
- Check revalidation_eligible_at dates
- Consider re-engagement campaigns

### 4. Monitor Suppression List Growth

- Should be < 2% of total list per month
- High growth = data quality problem
- Review data sources and validation

### 5. Use Suppression-Aware Scripts

- Always use `create-batch-list.js`
- Never bypass suppression filtering
- Maintain suppression list integrity

---

## API Reference

### Mailjet Bounce Events API

**Endpoint**: `GET /v3/REST/messageeventlist`

**Parameters**:
- `CampaignID`: Filter by campaign
- `Event`: `bounce` or `blocked`
- `Limit`: Max results per page (1000)
- `Offset`: Pagination offset

**Response Fields**:
- `ContactID`: Contact identifier
- `Email`: Email address
- `StateDesc`: Error description
- `StatePermanent`: Is permanent (hard bounce)
- `Blocked`: Was contact blocked by Mailjet
- `ArrivedAt`: Timestamp of event

---

## Appendix: File Locations

### Scripts
- `scripts/analyze-bounces.js` - Bounce analysis
- `scripts/create-suppression-list.js` - Suppression list setup
- `scripts/cleanup-bounced-contacts.js` - Manual cleanup
- `scripts/create-batch-list.js` - Batch creation with filtering

### Jobs
- `src/jobs/bounce-cleanup.jobs.ts` - Automated cleanup job

### Database
- `prisma/schema.prisma` - Database schema
- `prisma/migrations/add_suppressed_contacts_table.sql` - Migration file

### Documentation
- `docs/09_user_segmentation_strategy.md` - Batch creation strategy
- `docs/10_bounce_management_guide.md` - This document

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review script output logs
3. Check Mailjet API documentation: https://dev.mailjet.com
4. Contact campaign manager team

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-01 | Initial documentation - full bounce management system |

