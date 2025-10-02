# User Segmentation Strategy

## Document Information
- **Version**: 1.0
- **Date**: September 30, 2025
- **Status**: Active
- **Purpose**: Document the user segmentation strategy for email campaigns

---

## Overview

This document describes how users are segmented for phased email campaign rollouts. The strategy uses a **First-In-First-Out (FIFO)** approach based on user registration order to ensure fair, systematic distribution.

---

## Segmentation Criteria

### Primary Method: First-In-First-Out (FIFO)

**Rationale:**
- Fair treatment of all users
- Systematic, predictable segmentation
- Easy to reproduce for subsequent rounds
- No bias based on engagement, geography, or other factors

**Implementation:**
- Users are ordered by their Contact ID in MailJet
- Contact ID represents registration order (lower ID = earlier registration)
- Segments of 1,000 users extracted sequentially

---

## Master User List

### Source
- **List Name**: `users`
- **MailJet List ID**: 5776
- **Total Contacts**: 3,529 (as of Sept 30, 2025)
- **Location**: MailJet Contact Lists

### Characteristics
- All registered users from the platform
- Includes active and inactive users
- Excludes unsubscribed users (managed by MailJet)
- Continuously growing as new users register

---

## Campaign Batches

### Batch Structure
Each campaign batch contains exactly **1,000 users** extracted sequentially from the master list.

### Batch Naming Convention
```
campaign_batch_[round_number]
```

Examples:
- `campaign_batch_001` - Round 1 (Users 1-1,000)
- `campaign_batch_002` - Round 2 (Users 1,001-2,000)
- `campaign_batch_003` - Round 3 (Users 2,001-3,000)

---

## Round Details

### Round 1: Client Letter Campaign (Complete)
- **List Name**: campaign_batch_001
- **MailJet List ID**: 10502980
- **User Range**: 1-1,000
- **Contact ID Range**: 9707452 to ~85228721
- **Status**: ✅ Launched
- **Date Created**: Prior to September 29, 2025
- **Subscriber Count**: 1,000

**Selection Criteria:**
```javascript
// Pseudocode
users = getAllUsers().sortBy('ContactID');
round1Users = users.slice(0, 1000);
```

### Round 2: Client Letter Campaign (Today)
- **List Name**: campaign_batch_002
- **MailJet List ID**: 10503118
- **User Range**: 1,001-2,000
- **Contact ID Range**: 85228722 to 1049602518
- **Status**: ✅ Created (Sept 30, 2025, 8:12 AM UTC)
- **Launch Time**: September 30, 2025, 9:15 AM UTC
- **Subscriber Count**: 1,000 (processing)

**Selection Criteria:**
```javascript
// Pseudocode
users = getAllUsers().sortBy('ContactID');
round2Users = users.slice(1000, 2000); // Skip first 1000
```

### Round 3: Client Letter Campaign (Setup - FINAL ROUND)
- **List Name**: campaign_batch_003
- **MailJet List ID**: 10503192
- **User Range**: 2,001-3,529 (ALL remaining - 1,529 users)
- **Contact ID Range**: 1049602519 to 3727054106
- **Status**: 🟡 List Ready - Campaign Pending
- **Created**: October 1, 2025
- **Launch Date**: October 2, 2025, 9:15 AM UTC

**Selection Criteria:**
```javascript
// Pseudocode
users = getAllUsers().sortBy('ContactID');
round3Users = users.slice(2000); // Take ALL remaining users (no upper limit)
```

**Note**: Round 3 completes the entire user base (3,529 total users). No Round 4 needed with current users.

---

## Implementation Process

### Creating a New Batch List

**Prerequisites:**
- MailJet API credentials configured
- Node.js environment set up
- Campaign Manager repository

**Steps:**

1. **Run the creation script**:
   ```bash
   cd campaign_manager
   node scripts/create-round2-list.js  # Modify for round number
   ```

2. **Wait for processing**:
   - MailJet processes uploads asynchronously
   - Typical processing time: 1-2 minutes
   - Monitor with: `node scripts/verify-round2-list.js`

3. **Verify list**:
   - Check MailJet dashboard
   - Confirm subscriber count = 1,000
   - Verify no overlap with previous rounds

4. **Document list ID**:
   - Record MailJet List ID
   - Update campaign configuration
   - Update this documentation

5. **Configure Campaign Manager**:
   - Update environment variables or config files
   - Test notification system
   - Verify campaign schedule

---

## Validation Rules

### Pre-Launch Checklist
- [ ] List created with correct name (campaign_batch_XXX)
- [ ] Subscriber count = 1,000
- [ ] No overlap with previous rounds confirmed
- [ ] Users follow FIFO order (Contact IDs sequential)
- [ ] List ID documented and configured
- [ ] Campaign schedule updated
- [ ] Test notification successful

### Overlap Prevention
To ensure no user receives duplicate emails:

```javascript
// Get users already included in previous rounds
const round1Users = getListContacts(10502980); // campaign_batch_001
const round2Users = getListContacts(10503118); // campaign_batch_002

// Check for duplicates
const overlap = findDuplicates(round1Users, round2Users);
if (overlap.length > 0) {
  console.error('OVERLAP DETECTED:', overlap);
  // Abort and fix
}
```

---

## Technical Details

### MailJet API Integration

**Authentication:**
```javascript
const mailjetAuth = Buffer.from(
  `${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`
).toString('base64');
```

**Fetch Master List Contacts:**
```javascript
GET https://api.mailjet.com/v3/REST/listrecipient
  ?ContactsList=5776
  &Limit=1000
  &Offset=0
```

**Create New List:**
```javascript
POST https://api.mailjet.com/v3/REST/contactslist
Body: { "Name": "campaign_batch_002" }
```

**Add Contacts to List:**
```javascript
POST https://api.mailjet.com/v3/REST/contactslist/{listId}/managemanycontacts
Body: {
  "Action": "addnoforce",
  "Contacts": [{ "ContactID": 12345 }, ...]
}
```

---

## Future Considerations

### Alternative Segmentation Strategies

While FIFO is current strategy, alternatives for future campaigns:

1. **Engagement-Based**:
   - Segment by email open rates
   - High-engagement users first
   - Re-engagement campaigns for low-engagement

2. **Geographic**:
   - Segment by country/region
   - Optimize send times per timezone
   - Localized content

3. **Product Usage**:
   - Active vs inactive users
   - Feature adoption levels
   - Usage frequency

4. **Demographic**:
   - Business size (advisers, practices)
   - Industry vertical
   - Customer tier/plan

5. **A/B Testing**:
   - Random sample for test variants
   - Stratified sampling for fairness
   - Control groups

### Scaling Considerations

As user base grows beyond 10,000:
- Consider 2,000 user batches for efficiency
- Implement automated batch creation
- Schedule multiple campaigns per day
- Use parallel campaign execution

---

## Scripts Reference

### Available Scripts

1. **`investigate-round1-list.js`**
   - Purpose: Analyze existing lists to understand segmentation
   - Usage: `node scripts/investigate-round1-list.js`

2. **`analyze-campaign-batch.js`**
   - Purpose: Deep-dive analysis of campaign_batch_001
   - Usage: `node scripts/analyze-campaign-batch.js`

3. **`create-round2-list.js`**
   - Purpose: Create campaign_batch_002 with users 1,001-2,000
   - Usage: `node scripts/create-round2-list.js`
   - Output: New MailJet list with List ID

4. **`verify-round2-list.js`**
   - Purpose: Verify list creation and subscriber count
   - Usage: `node scripts/verify-round2-list.js`
   - Check: Subscriber count should = 1,000

### Creating Round 3 List

To create Round 3:

```bash
# Option 1: Modify create-round2-list.js
# Change: slice(1000, 2000) → slice(2000, 3000)
# Change: 'campaign_batch_002' → 'campaign_batch_003'

# Option 2: Use parameterized script (future enhancement)
node scripts/create-batch-list.js --round=3 --size=1000
```

---

## Monitoring & Reporting

### Metrics to Track
- Total users per batch
- Delivery rate per batch
- Open rate per batch
- Click rate per batch
- Unsubscribe rate per batch
- Bounce rate per batch

### Comparison Analysis
Compare Round 1 vs Round 2 vs Round 3 to identify:
- Engagement trends over user cohorts
- Impact of registration date on engagement
- Optimal messaging for different user groups

---

## Support & Questions

### Common Issues

**Q: List shows 0 subscribers after creation**
- A: Normal - MailJet processes asynchronously. Wait 1-2 minutes.

**Q: How to verify no overlaps?**
- A: Compare Contact ID ranges. Round 2 should start where Round 1 ended.

**Q: What if master list has fewer than expected users?**
- A: Check "users" list (ID: 5776) for current count. Adjust batch size if needed.

**Q: Can I re-run list creation if it fails?**
- A: Yes, but delete the incomplete list in MailJet first to avoid duplicates.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-09-30 | Campaign Manager Team | Initial documentation based on Round 1 & 2 analysis |

---

## References

- MailJet API Documentation: https://dev.mailjet.com/email/reference/
- Campaign Manager Repository: `/00_traction/campaign_manager`
- Campaign Schedule: `docs/01_workflow.md`
- Multi-Agent Implementation: `docs/08_multi_agent_implementation.md`