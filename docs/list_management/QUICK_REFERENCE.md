# List Management - Quick Reference

## Common Operations

### Create Lists

```bash
# Master List
POST /api/lists
{
  "name": "Master User List",
  "type": "MASTER",
  "mailjetListId": "5776"
}

# Campaign Lists
POST /api/lists
{ "name": "Round 1 - Tuesday", "type": "CAMPAIGN_ROUND_1", "mailjetListId": "123456" }

POST /api/lists
{ "name": "Round 2 - Thursday", "type": "CAMPAIGN_ROUND_2", "mailjetListId": "123457" }

POST /api/lists
{ "name": "Round 3 - Next Tue", "type": "CAMPAIGN_ROUND_3", "mailjetListId": "123458" }

# Suppression List
POST /api/lists
{ "name": "Suppression List", "type": "SUPPRESSION", "mailjetListId": "10503500" }
```

### Import Contacts

```bash
# Bulk Import
POST /api/lists/{listId}/import
{
  "contacts": [
    { "email": "user1@example.com", "name": "User One" },
    { "email": "user2@example.com", "name": "User Two" }
  ]
}

# Add Single Contact
POST /api/lists/{listId}/contacts
{
  "contacts": [
    { "email": "new@example.com", "name": "New User" }
  ]
}
```

### Check List Health

```bash
# Get Cached Health
GET /api/lists/{listId}/health

# Run AI Analysis
POST /api/lists/{listId}/health/analyze
```

### Suppress Contacts

```bash
# Manual Suppression
POST /api/suppression
{
  "contactId": "uuid",
  "reason": "hard_bounce",
  "suppressedBy": "admin@example.com",
  "confidence": 1.0
}

# Check if Suppressed
GET /api/suppression/check/{email}

# View Suppression History
GET /api/suppression/{contactId}/history
```

### Sync with MailJet

```bash
# Sync Single List
POST /api/lists/{listId}/sync

# Get MailJet Stats
# (Automatically synced every hour via cache)
GET /api/lists/{listId}/health
```

### Monitor Stage 6

```bash
# Check Job Status
GET /api/lifecycle/campaigns/{scheduleId}/jobs

# View Maintenance Logs
GET /api/lists/maintenance/logs

# Get Specific Log
GET /api/lists/maintenance/logs/{id}
```

---

## SQL Queries

### View Recent Suppressions

```sql
SELECT
  c.email,
  s.reason,
  s.suppressed_by,
  s.ai_rationale,
  s.confidence,
  s.suppressed_at
FROM suppression_history s
JOIN contacts c ON c.id = s.contact_id
WHERE s.is_active = true
ORDER BY s.suppressed_at DESC
LIMIT 20;
```

### Check List Balance

```sql
SELECT
  name,
  type,
  contact_count,
  bounce_rate,
  health_score
FROM contact_lists
WHERE type IN ('CAMPAIGN_ROUND_1', 'CAMPAIGN_ROUND_2', 'CAMPAIGN_ROUND_3')
ORDER BY type;
```

### View Maintenance History

```sql
SELECT
  lml.id,
  lml.campaign_schedule_id,
  cl.name as list_name,
  lml.contacts_suppressed,
  lml.ai_confidence,
  lml.ai_recommendation,
  lml.executed_at
FROM list_maintenance_logs lml
JOIN contact_lists cl ON cl.id = lml.list_id
ORDER BY lml.executed_at DESC
LIMIT 10;
```

### Suppression Stats

```sql
-- By Type
SELECT
  reason,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence
FROM suppression_history
WHERE is_active = true
GROUP BY reason;

-- By Source
SELECT
  suppressed_by,
  COUNT(*) as count
FROM suppression_history
WHERE is_active = true
GROUP BY suppressed_by;

-- Recent Trend (Last 7 Days)
SELECT
  DATE(suppressed_at) as date,
  COUNT(*) as suppressions
FROM suppression_history
WHERE suppressed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(suppressed_at)
ORDER BY date;
```

---

## Redis Commands

### View Cached Lists

```bash
# Connect
heroku redis:cli --app campaign-manager

# View all list metadata
redis> KEYS list:metadata:*

# Get specific list
redis> GET list:metadata:{uuid}

# Check TTL
redis> TTL list:metadata:{uuid}  # Should be ~3600 (1 hour)
```

### View Suppression Cache

```bash
# All suppressed contacts
redis> KEYS suppression:contact:*

# Check specific contact
redis> GET suppression:contact:{uuid}  # Returns "1" or "0"

# Check TTL
redis> TTL suppression:contact:{uuid}  # Should be ~86400 (24 hours)
```

### Clear Cache

```bash
# Clear all list metadata
redis> KEYS list:metadata:* | xargs redis-cli DEL

# Clear specific list
redis> DEL list:metadata:{uuid}

# Clear all suppression cache
redis> KEYS suppression:contact:* | xargs redis-cli DEL
```

---

## Heroku Commands

### Check Services

```bash
# Check dynos
heroku ps --app campaign-manager

# Check worker logs
heroku logs --dyno worker --app campaign-manager --tail

# Check Redis
heroku redis:info --app campaign-manager

# Check database
heroku pg:info --app campaign-manager
```

### Monitor Jobs

```bash
# List maintenance jobs
heroku logs --dyno worker --app campaign-manager --grep "list-maintenance" --tail

# AI agent decisions
heroku logs --dyno worker --app campaign-manager --grep "Agent" --tail

# Suppression operations
heroku logs --dyno worker --app campaign-manager --grep "Suppression" --tail
```

### Database Operations

```bash
# Connect to database
heroku pg:psql --app campaign-manager

# Run migration
heroku run npm run db:deploy --app campaign-manager

# Create backup
heroku pg:backups:capture --app campaign-manager

# Restore backup
heroku pg:backups:restore b001 --app campaign-manager
```

---

## TypeScript Examples

### Use ListManagementService

```typescript
import { ListManagementService } from '@/services/lists';

const service = new ListManagementService();

// Get campaign lists
const lists = await service.getCampaignLists();
console.log(lists.round1?.contactCount);

// Sync from MailJet
const synced = await service.syncListFromMailjet(listId);
console.log(synced.bounceRate);

// Get cached metadata
const metadata = await service.getCachedListMetadata(listId);
console.log(metadata?.healthScore);
```

### Use SuppressionService

```typescript
import { SuppressionService } from '@/services/lists';

const service = new SuppressionService();

// Suppress a contact
await service.suppressContact({
  contactId: 'uuid',
  reason: 'hard_bounce',
  suppressedBy: 'ai',
  aiRationale: 'Email bounced with permanent error',
  confidence: 1.0
});

// Check suppression
const check = await service.isContactSuppressed('user@example.com');
console.log(check.isSuppressed); // true/false

// Get stats
const stats = await service.getSuppressionStats();
console.log(stats.totalSuppressed);
```

### Run List Maintenance Manually

```typescript
import { ListMaintenanceOrchestrator } from '@/services/lists/list-maintenance-orchestrator.service';

const orchestrator = new ListMaintenanceOrchestrator();

const result = await orchestrator.runPostCampaignMaintenance({
  campaignScheduleId: 123,
  listId: 'list-uuid',
  campaignName: 'Q4 Launch',
  roundNumber: 1
});

console.log(result.summary); // AI summary
console.log(result.contactsSuppressed); // Count
```

### Use AI Agents

```typescript
import {
  ListHealthAgent,
  OptimizationAgent,
  RebalancingAgent
} from '@/services/lists/agents';

// Health Analysis
const healthAgent = new ListHealthAgent();
const assessment = await healthAgent.analyzeListHealth({
  listName: 'Round 1',
  contactCount: 1000,
  activeContactCount: 950,
  bounceRate: 0.05,
  hardBounceRate: 0.03,
  softBounceRate: 0.02,
  deliveryRate: 0.95
});
console.log(assessment.healthScore); // 0-100
console.log(assessment.recommendations);

// Suppression Recommendations
const optimizationAgent = new OptimizationAgent();
const plan = await optimizationAgent.generateSuppressionPlan({
  campaignName: 'Q4 Launch',
  listName: 'Round 1',
  bounces: [/* bounce data */],
  currentDeliveryRate: 0.95
});
console.log(plan.recommendedSuppressions);
console.log(plan.suppressions); // Detailed plan

// Rebalancing
const rebalancingAgent = new RebalancingAgent();
const rebalancePlan = await rebalancingAgent.generateRebalancingPlan({
  lists: [
    { listId: '1', listName: 'Round 1', roundNumber: 1, currentContactCount: 1200 },
    { listId: '2', listName: 'Round 2', roundNumber: 2, currentContactCount: 1000 },
    { listId: '3', listName: 'Round 3', roundNumber: 3, currentContactCount: 800 }
  ],
  totalContacts: 3000,
  suppressedCount: 0,
  preserveFIFO: true
});
console.log(rebalancePlan.isBalanced);
console.log(rebalancePlan.moves); // Contact moves needed
```

---

## Testing Commands

### Unit Tests

```bash
# Run all tests
npm test

# Run list management tests only
npm test -- tests/unit/services/lists/

# Watch mode
npm run test:watch -- tests/unit/services/lists/

# Coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run integration tests
npm test -- tests/integration/lists/

# Test MailJet integration
npm test -- tests/integration/lists/mailjet-sync.test.ts

# Test API endpoints
npm test -- tests/integration/lists/api-endpoints.test.ts
```

### Manual API Testing

```bash
# Create test data
curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -d '{"name": "Test List", "type": "CUSTOM"}'

# Import contacts
curl -X POST http://localhost:3000/api/lists/{id}/import \
  -H "Content-Type: application/json" \
  -d '{"contacts": [{"email": "test@example.com"}]}'

# Suppress contact
curl -X POST http://localhost:3000/api/suppression \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "uuid",
    "reason": "test",
    "suppressedBy": "admin"
  }'
```

---

## Troubleshooting Commands

### Debug Stage 6

```bash
# Check if job scheduled
curl http://localhost:3000/api/lifecycle/campaigns/1/jobs | jq '.listMaintenance'

# Monitor worker
heroku logs --dyno worker --grep "list-maintenance" --tail

# Check maintenance logs
curl http://localhost:3000/api/lists/maintenance/logs | jq '.[0]'
```

### Debug AI Agents

```bash
# Enable debug logging
export LOG_LEVEL=debug

# View AI prompts/responses
heroku logs --app campaign-manager --grep "Agent" --tail

# Check confidence scores
SELECT AVG(ai_confidence) FROM list_maintenance_logs;
```

### Debug Cache

```bash
# Check Redis connection
redis-cli PING

# View cache keys
redis-cli KEYS "*"

# Monitor cache hits/misses
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

### Debug Database

```bash
# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'list_%' OR tablename LIKE 'contact%' OR tablename LIKE 'suppression%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('contact_lists', 'contacts', 'list_memberships', 'suppression_history')
ORDER BY tablename, indexname;

# Check constraints
SELECT
  conname,
  contype,
  conrelid::regclass AS table_name
FROM pg_constraint
WHERE conrelid IN (
  'contact_lists'::regclass,
  'contacts'::regclass,
  'list_memberships'::regclass,
  'suppression_history'::regclass
);
```

---

## Performance Tips

### Optimize Queries

```typescript
// Use cached metadata instead of full query
const metadata = await listService.getCachedListMetadata(listId);
// vs
const list = await listService.getList(listId);

// Check suppression cache before DB
const check = await suppressionService.isContactSuppressed(email);
// Uses Redis cache (24h TTL)

// Batch operations
await contactService.bulkImportContacts(listId, contacts);
// vs loop of single inserts
```

### Reduce MailJet API Calls

```typescript
// Sync once, cache for 1 hour
await listService.syncListFromMailjet(listId);

// Then use cached metadata
const metadata = await listService.getCachedListMetadata(listId);

// Only re-sync when needed (stale data)
if (!metadata || !metadata.lastSyncedAt ||
    (Date.now() - metadata.lastSyncedAt.getTime()) > 3600000) {
  await listService.syncListFromMailjet(listId);
}
```

### Optimize AI Calls

```typescript
// Run agents in parallel when possible
const [healthResult, optimizationResult] = await Promise.all([
  healthAgent.analyzeListHealth(metrics),
  optimizationAgent.generateSuppressionPlan(context)
]);

// Use lower temperature for deterministic results
// (already configured in agents)
```

---

**Last Updated**: 2025-10-02
**Version**: 1.0
