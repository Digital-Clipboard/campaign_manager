# Campaign Manager - Critical Rules

## Data Integrity Rules

### ⛔ NEVER USE HARDCODED DATA FOR ASSESSMENTS

**CRITICAL**: All campaign assessments, reports, and analytics MUST use real data from live APIs only.

- ❌ **FORBIDDEN**: Using hardcoded baseline data, mock data, or placeholder values in production assessments
- ❌ **FORBIDDEN**: Using fallback data when API calls fail - instead, fail gracefully and alert
- ✅ **REQUIRED**: Fetch all data from MailJet API, database, or other live sources
- ✅ **REQUIRED**: If data is unavailable, skip the assessment or clearly mark as "Data Unavailable"
- ✅ **REQUIRED**: Log warnings when comparisons cannot be made due to missing historical data

**Why**: Sending assessments based on fake data undermines trust and can lead to incorrect business decisions.

**Examples**:
```typescript
// ❌ BAD - Using hardcoded fallback
const round1Stats = round1Campaign 
  ? await fetchStats(round1Campaign)
  : { sent: 1000, delivered: 970, bounced: 30 }; // NEVER DO THIS

// ✅ GOOD - Skip comparison if data unavailable
const round1Stats = round1Campaign 
  ? await fetchStats(round1Campaign)
  : null; // Clear indication that data doesn't exist

if (!round1Stats) {
  logger.warn('Round 1 data not available - comparison skipped');
  // Assessment proceeds without comparison
}
```

### 🔍 Data Validation

- Always validate that fetched data is recent and complete
- Log data sources and timestamps
- Alert if data appears stale or incomplete

