# Simple Bounce Cleanup - Mailjet Native Approach

**Philosophy**: Let Mailjet do the heavy lifting. We just clean up our lists.

---

## How It Works

### What Mailjet Does Automatically ✅
- **Detects** all bounces (hard and soft)
- **Blocks** hard bounced contacts for 90 days automatically
- **Prevents** sending to blocked contacts even if they're on your lists
- **Tracks** all bounce events via API

### What You Need to Do
- **Remove** bounced contacts from your lists (to keep them clean and reduce costs)
- **That's it!**

---

## Quick Start (5 minutes)

### Step 1: Find Your Campaign ID

1. Go to [Mailjet Dashboard](https://app.mailjet.com) → Campaigns
2. Click on your campaign (e.g., "Client Letter Round 1")
3. Get the Campaign ID from:
   - URL: `app.mailjet.com/campaigns/view/12345` → ID is `12345`
   - OR from campaign details page

### Step 2: Run Cleanup Script

```bash
cd campaign_manager

# Dry run first (see what will happen)
node scripts/simple-bounce-cleanup.js --campaign-id=12345 --dry-run

# If it looks good, run for real
node scripts/simple-bounce-cleanup.js --campaign-id=12345
```

**That's it!** The script:
- Fetches bounced contacts from your campaign
- Removes them from master "users" list
- Removes them from batch lists
- Done in 2-3 minutes

---

## Example Output

```bash
$ node scripts/simple-bounce-cleanup.js --campaign-id=12345

🧹 SIMPLE BOUNCE CLEANUP
============================================================
Campaign ID: 12345
Mode: ✅ LIVE
============================================================

📥 Fetching bounced contacts for campaign 12345...
   ✅ Found 45 bounced contacts

Bounced contacts to remove:
   1. invalid@example.com - user unknown
   2. badaddress@test.com - mailbox not found
   3. old@email.com - does not exist
   ... and 42 more

📤 Removing from master "users" list (5776)...
   ✅ Removed 45 contacts from master list

📤 Removing from campaign_batch_001 (10502980)...
   ✅ Removed 23 contacts from campaign_batch_001

📤 Removing from campaign_batch_002 (10503118)...
   ✅ Removed 15 contacts from campaign_batch_002

📤 Removing from campaign_batch_003 (10503192)...
   ✅ Removed 7 contacts from campaign_batch_003

============================================================
✅ CLEANUP COMPLETE!
============================================================
Total bounced contacts: 45
Removed from master list: 45

📝 Note: Mailjet automatically blocks these contacts for 90 days.
   They won't receive emails even if re-added to lists.
```

---

## When to Run This

**After each campaign send**:
1. Wait 24-48 hours (let bounces settle)
2. Run the cleanup script with your campaign ID
3. Done!

**Frequency**: Once per campaign (takes 5 minutes)

---

## What About Future Campaigns?

### Option 1: Mailjet's Automatic Blocking (Simplest)
- **No extra work needed**
- Mailjet blocks bounced contacts for 90 days automatically
- Even if bounced contacts are in your next batch, Mailjet won't send to them
- They just clutter your lists but don't receive emails

### Option 2: Filter Out Bounced Contacts When Creating Batches
If you want truly clean lists, you can enhance batch creation to exclude recently bounced contacts:

```bash
# Future enhancement: Create batch while excluding recent bounces
# (This would require light database tracking of bounced contacts)
```

**Recommendation**: Start with Option 1. Mailjet's blocking handles it. Only add filtering if you want cleaner metrics or lower contact counts.

---

## Comparison: Simple vs Complex Approach

| Feature | Simple Approach | Complex Approach (what we built) |
|---------|----------------|----------------------------------|
| **Script** | 1 simple script | 6 scripts + database + jobs |
| **Database** | None needed | Full schema + migrations |
| **Maintenance** | None | Ongoing |
| **Time per campaign** | 5 minutes | 15-20 minutes |
| **Setup time** | 0 minutes | 30 minutes |
| **Relies on** | Mailjet's native blocking | Custom infrastructure |
| **Bounce protection** | ✅ Mailjet auto-blocks 90 days | ✅ Mailjet + database tracking |
| **List cleanup** | ✅ Removes from lists | ✅ Removes from lists |
| **Future campaign prevention** | ✅ Mailjet blocks automatically | ✅ Database filtering |
| **Overhead** | Minimal | High |

**Verdict**: Simple approach is 95% as effective with 5% of the complexity.

---

## FAQ

### Q: Will bounced contacts still receive emails if I don't remove them?
**A**: No! Mailjet automatically blocks hard bounces for 90 days. They won't receive emails even if they're on your lists. Removing them just keeps your lists clean and reduces contact count costs.

### Q: What about soft bounces?
**A**: Mailjet doesn't auto-block soft bounces (temporary issues like "mailbox full"). The script removes them from your lists. If they soft bounce repeatedly, Mailjet may eventually block them.

### Q: Do I need a database?
**A**: No! Mailjet tracks everything. The database is only needed if you want historical analysis or custom revalidation logic.

### Q: How do I find my campaign ID?
**A**:
- **Option 1**: Mailjet dashboard → Campaigns → Click campaign → Look in URL
- **Option 2**: Mailjet dashboard → Campaigns → Click campaign → Campaign details shows ID
- **Option 3**: Ask your Mailjet MCP agent for campaign IDs

### Q: Can I automate this?
**A**: Yes! You can schedule this script to run 24 hours after each campaign. But honestly, running it manually once per campaign (5 minutes) is probably simpler than setting up automation.

---

## Migration from Complex Approach

If you already set up the complex system:

**What to keep**:
- Nothing required

**What to delete** (optional cleanup):
- `scripts/analyze-bounces.js` (optional - useful for analysis but not needed for cleanup)
- `scripts/cleanup-bounced-contacts.js` (replaced by simple version)
- `scripts/create-batch-list.js` (optional - only if you want database filtering)
- `src/jobs/bounce-cleanup.jobs.ts` (not needed)
- Database table `suppressed_contacts` (optional - doesn't hurt to keep)

**What to use going forward**:
- `scripts/simple-bounce-cleanup.js` (this one!)

---

## Advanced: Batch Creation with Bounce Filtering

If you want to exclude bounced contacts when creating future batches (without a database), you can modify batch creation to:

1. Fetch all contacts from master list
2. For each contact, check if they're blocked in Mailjet (via API)
3. Filter out blocked ones
4. Create batch from clean list

**But honestly**: Mailjet's automatic blocking makes this unnecessary. Blocked contacts won't receive emails anyway.

---

## Summary

**Do this after each campaign**:
```bash
# Wait 24-48 hours, then:
node scripts/simple-bounce-cleanup.js --campaign-id=<your_campaign_id>
```

**Mailjet handles the rest**:
- ✅ Automatically blocks bounced contacts for 90 days
- ✅ Prevents sending to them
- ✅ Tracks bounce events

**Result**:
- Clean lists
- Good deliverability
- Minimal overhead
- 5 minutes per campaign

---

## Support

**To find campaign ID**:
1. Mailjet dashboard → Campaigns
2. Click your campaign
3. ID is in URL or campaign details

**Common errors**:
- "Campaign not found": Check campaign ID
- "Auth failed": Check `.env` has correct Mailjet API keys
- "Rate limit": Script already has delays, just wait and it will continue

That's it! Simple, effective, minimal overhead. 🎉
