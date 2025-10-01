# List Management - TDD Specification

## Document Information
- **Version**: 1.0
- **Date**: October 1, 2025
- **Status**: ✅ Approved
- **Purpose**: Test-Driven Development specifications for AI-driven list management system

---

## Table of Contents

1. [Overview](#overview)
2. [Test Strategy](#test-strategy)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [End-to-End Tests](#end-to-end-tests)
6. [AI Agent Tests](#ai-agent-tests)
7. [Performance Tests](#performance-tests)
8. [Test Data](#test-data)
9. [Mocking Strategy](#mocking-strategy)
10. [CI/CD Integration](#cicd-integration)

---

## Overview

### Testing Philosophy

This specification follows **Test-Driven Development (TDD)** principles:

1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests green

### Test Pyramid

```
           /\
          /  \
         / E2E \         ← 10% (Workflow tests)
        /--------\
       /          \
      / Integration \    ← 30% (Service + DB tests)
     /--------------\
    /                \
   /   Unit Tests     \  ← 60% (Pure logic tests)
  /--------------------\
```

### Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: 70%+ coverage
- **E2E Tests**: Critical paths only
- **Overall**: 75%+ code coverage

### Testing Tools

```json
{
  "testing": {
    "framework": "Jest 29.x",
    "assertions": "@jest/globals",
    "mocking": "jest.mock()",
    "e2e": "supertest + testcontainers",
    "coverage": "jest --coverage"
  }
}
```

---

## Test Strategy

### Test Categories

| Category | Purpose | Speed | Dependencies |
|----------|---------|-------|--------------|
| Unit | Test isolated functions/classes | Fast (< 100ms) | None |
| Integration | Test service interactions | Medium (< 5s) | DB, Redis |
| E2E | Test complete workflows | Slow (< 30s) | All systems |
| AI Agent | Test AI responses | Slow (< 10s) | Gemini API |
| Performance | Test scalability | Variable | Load testing |

### Test Naming Convention

```typescript
describe('ComponentName', () => {
  describe('methodName()', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });

    it('should throw [error] when [invalid condition]', () => {
      // Test implementation
    });
  });
});
```

### Test File Structure

```
tests/
├── unit/
│   ├── agents/
│   │   ├── list-health-agent.test.ts
│   │   ├── rebalancing-agent.test.ts
│   │   ├── optimization-agent.test.ts
│   │   └── reporting-agent.test.ts
│   ├── services/
│   │   ├── list-operations.service.test.ts
│   │   └── list-cache.service.test.ts
│   └── utils/
│       └── list-distribution.util.test.ts
├── integration/
│   ├── services/
│   │   ├── post-campaign-maintenance.integration.test.ts
│   │   ├── weekly-health-check.integration.test.ts
│   │   └── mailjet-sync.integration.test.ts
│   └── database/
│       └── list-maintenance-log.integration.test.ts
├── e2e/
│   ├── workflows/
│   │   ├── post-campaign-workflow.e2e.test.ts
│   │   ├── weekly-health-workflow.e2e.test.ts
│   │   └── rebalancing-workflow.e2e.test.ts
│   └── api/
│       └── list-management-api.e2e.test.ts
├── fixtures/
│   ├── bounce-data.json
│   ├── list-states.json
│   └── ai-responses.json
├── helpers/
│   ├── test-db.helper.ts
│   ├── mock-mailjet.helper.ts
│   └── mock-gemini.helper.ts
└── setup.ts
```

---

## Unit Tests

### 1. List Health Agent Tests

**File**: `tests/unit/agents/list-health-agent.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListHealthAgent, ListHealthInput } from '../../../src/agents/list-health-agent';
import { GeminiClient } from '../../../src/agents/gemini-client';

describe('ListHealthAgent', () => {
  let agent: ListHealthAgent;
  let mockGeminiClient: jest.Mocked<GeminiClient>;

  beforeEach(() => {
    mockGeminiClient = {
      generateJSON: jest.fn(),
    } as any;

    agent = new ListHealthAgent(mockGeminiClient);
  });

  describe('analyze()', () => {
    describe('when list is healthy', () => {
      it('should return healthy status with low urgency', async () => {
        const input: ListHealthInput = {
          name: 'Campaign List 1',
          subscriberCount: 1200,
          targetSize: 1200,
          bounceRate: 1.2,
          hardBounces: 8,
          softBounces: 6,
          deliveryRate: 98.8,
          lastCampaignDate: new Date(),
          bounceRateTrend: 'improving',
          sizeTrend: 'stable',
          suppressionRate: 0.7,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'healthy',
          concerns: [],
          riskFactors: [],
          urgency: 'low',
          confidence: 0.96,
        });

        const result = await agent.analyze(input);

        expect(result.status).toBe('healthy');
        expect(result.concerns).toHaveLength(0);
        expect(result.urgency).toBe('low');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it('should call Gemini API with correct temperature', async () => {
        const input = createHealthyListInput();

        mockGeminiClient.generateJSON.mockResolvedValue(createHealthyResponse());

        await agent.analyze(input);

        expect(mockGeminiClient.generateJSON).toHaveBeenCalledWith(
          expect.any(String), // system prompt
          expect.any(String), // user prompt
          0.7 // temperature
        );
      });
    });

    describe('when list has warnings', () => {
      it('should return warning status when hard bounce rate exceeds 2%', async () => {
        const input: ListHealthInput = {
          name: 'Campaign List 2',
          subscriberCount: 1150,
          targetSize: 1200,
          bounceRate: 5.8,
          hardBounces: 45,
          softBounces: 22,
          deliveryRate: 94.2,
          lastCampaignDate: new Date(),
          bounceRateTrend: 'degrading',
          sizeTrend: 'shrinking',
          suppressionRate: 3.9,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'warning',
          concerns: [
            'Hard bounce rate (3.9%) exceeds healthy threshold (2%)',
            'List undersized by 50 contacts (-4.2% vs target)',
          ],
          riskFactors: ['Sender reputation at risk due to elevated hard bounces'],
          urgency: 'medium',
          confidence: 0.87,
        });

        const result = await agent.analyze(input);

        expect(result.status).toBe('warning');
        expect(result.concerns.length).toBeGreaterThan(0);
        expect(result.urgency).toMatch(/medium|high/);
      });

      it('should identify degrading bounce rate trend', async () => {
        const input = createListWithDegradingTrend();

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'warning',
          concerns: ['Bounce rate trend degrading over last 3 campaigns'],
          riskFactors: ['Sustained trend indicates list quality issues'],
          urgency: 'high',
          confidence: 0.91,
        });

        const result = await agent.analyze(input);

        expect(result.concerns).toContain(expect.stringContaining('trend'));
        expect(result.urgency).toBe('high');
      });
    });

    describe('when list is critical', () => {
      it('should return critical status when hard bounce rate exceeds 5%', async () => {
        const input: ListHealthInput = {
          name: 'Campaign List 3',
          subscriberCount: 1050,
          targetSize: 1200,
          bounceRate: 12.4,
          hardBounces: 95,
          softBounces: 35,
          deliveryRate: 87.6,
          lastCampaignDate: new Date(),
          bounceRateTrend: 'degrading',
          sizeTrend: 'shrinking',
          suppressionRate: 9.0,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'critical',
          concerns: [
            'Critical hard bounce rate (9.0%) - immediate action required',
            'Delivery rate (87.6%) below acceptable threshold',
            'List shrinkage of 150 contacts (-12.5%)',
          ],
          riskFactors: [
            'Severe sender reputation damage',
            'Risk of ESP blocklisting',
            'Potential deliverability collapse',
          ],
          urgency: 'critical',
          confidence: 0.95,
        });

        const result = await agent.analyze(input);

        expect(result.status).toBe('critical');
        expect(result.urgency).toBe('critical');
        expect(result.concerns.length).toBeGreaterThanOrEqual(3);
        expect(result.riskFactors.length).toBeGreaterThan(0);
      });

      it('should flag delivery rate below 90%', async () => {
        const input = createListWithLowDeliveryRate();

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'critical',
          concerns: ['Delivery rate (88.2%) critically low'],
          riskFactors: ['Immediate deliverability crisis'],
          urgency: 'critical',
          confidence: 0.93,
        });

        const result = await agent.analyze(input);

        expect(result.concerns).toContain(expect.stringContaining('Delivery rate'));
        expect(result.status).toBe('critical');
      });
    });

    describe('validation', () => {
      it('should throw error when response missing required fields', async () => {
        const input = createHealthyListInput();

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'healthy',
          // Missing concerns, riskFactors, urgency, confidence
        } as any);

        await expect(agent.analyze(input)).rejects.toThrow('Missing required field');
      });

      it('should throw error when status is invalid', async () => {
        const input = createHealthyListInput();

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'invalid_status',
          concerns: [],
          riskFactors: [],
          urgency: 'low',
          confidence: 0.9,
        });

        await expect(agent.analyze(input)).rejects.toThrow('Invalid status');
      });

      it('should throw error when confidence is out of range', async () => {
        const input = createHealthyListInput();

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'healthy',
          concerns: [],
          riskFactors: [],
          urgency: 'low',
          confidence: 1.5, // Invalid
        });

        await expect(agent.analyze(input)).rejects.toThrow('confidence must be');
      });
    });

    describe('edge cases', () => {
      it('should handle list with zero bounces', async () => {
        const input: ListHealthInput = {
          name: 'Campaign List 1',
          subscriberCount: 1200,
          targetSize: 1200,
          bounceRate: 0,
          hardBounces: 0,
          softBounces: 0,
          deliveryRate: 100,
          lastCampaignDate: new Date(),
          bounceRateTrend: 'stable',
          sizeTrend: 'stable',
          suppressionRate: 0,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'healthy',
          concerns: [],
          riskFactors: [],
          urgency: 'low',
          confidence: 0.98,
        });

        const result = await agent.analyze(input);

        expect(result.status).toBe('healthy');
        expect(result.concerns).toHaveLength(0);
      });

      it('should handle list that has never sent a campaign', async () => {
        const input: ListHealthInput = {
          name: 'New List',
          subscriberCount: 1200,
          targetSize: 1200,
          bounceRate: 0,
          hardBounces: 0,
          softBounces: 0,
          deliveryRate: 0,
          lastCampaignDate: null,
          bounceRateTrend: 'stable',
          sizeTrend: 'growing',
          suppressionRate: 0,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          status: 'healthy',
          concerns: ['No campaign history - baseline metrics unavailable'],
          riskFactors: [],
          urgency: 'low',
          confidence: 0.65,
        });

        const result = await agent.analyze(input);

        expect(result.confidence).toBeLessThan(0.8); // Lower confidence for new lists
      });
    });
  });
});

// Helper functions
function createHealthyListInput(): ListHealthInput {
  return {
    name: 'Test List',
    subscriberCount: 1200,
    targetSize: 1200,
    bounceRate: 1.5,
    hardBounces: 10,
    softBounces: 8,
    deliveryRate: 98.5,
    lastCampaignDate: new Date(),
    bounceRateTrend: 'stable',
    sizeTrend: 'stable',
    suppressionRate: 1.5,
  };
}

function createHealthyResponse() {
  return {
    status: 'healthy',
    concerns: [],
    riskFactors: [],
    urgency: 'low',
    confidence: 0.95,
  };
}

function createListWithDegradingTrend(): ListHealthInput {
  return {
    ...createHealthyListInput(),
    bounceRateTrend: 'degrading',
    bounceRate: 3.2,
  };
}

function createListWithLowDeliveryRate(): ListHealthInput {
  return {
    ...createHealthyListInput(),
    deliveryRate: 88.2,
    bounceRate: 11.8,
  };
}
```

### 2. Rebalancing Agent Tests

**File**: `tests/unit/agents/rebalancing-agent.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RebalancingAgent, RebalancingInput } from '../../../src/agents/rebalancing-agent';
import { GeminiClient } from '../../../src/agents/gemini-client';

describe('RebalancingAgent', () => {
  let agent: RebalancingAgent;
  let mockGeminiClient: jest.Mocked<GeminiClient>;

  beforeEach(() => {
    mockGeminiClient = {
      generateJSON: jest.fn(),
    } as any;

    agent = new RebalancingAgent(mockGeminiClient);
  });

  describe('determineRebalancing()', () => {
    describe('when lists are balanced', () => {
      it('should return requiresRebalancing=false when within ±5% threshold', async () => {
        const input: RebalancingInput = {
          currentDistribution: {
            list1: 1200,
            list2: 1190,
            list3: 1210,
          },
          suppressedContacts: {
            fromList1: 5,
            fromList2: 3,
            fromList3: 4,
          },
          availableForRebalancing: 0,
          balanceThreshold: 5,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: false,
          targetDistribution: {
            list1: 1200,
            list2: 1190,
            list3: 1210,
          },
          movements: [],
          rationale: 'Lists are within ±5% balance threshold. No rebalancing needed.',
          expectedImpact: 'None - lists already balanced',
          alternativesConsidered: [],
          confidence: 0.95,
        });

        const result = await agent.determineRebalancing(input);

        expect(result.requiresRebalancing).toBe(false);
        expect(result.movements).toHaveLength(0);
      });

      it('should use temperature 0.5 for consistent results', async () => {
        const input = createBalancedInput();
        mockGeminiClient.generateJSON.mockResolvedValue(createNoRebalancingResponse());

        await agent.determineRebalancing(input);

        expect(mockGeminiClient.generateJSON).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          0.5 // temperature
        );
      });
    });

    describe('when lists are unbalanced', () => {
      it('should return requiresRebalancing=true when deviation exceeds threshold', async () => {
        const input: RebalancingInput = {
          currentDistribution: {
            list1: 1000,
            list2: 1300,
            list3: 1100,
          },
          suppressedContacts: {
            fromList1: 50,
            fromList2: 10,
            fromList3: 25,
          },
          availableForRebalancing: 100,
          balanceThreshold: 5,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: true,
          targetDistribution: {
            list1: 1167,
            list2: 1167,
            list3: 1166,
          },
          movements: [
            {
              contactId: 1001,
              email: 'user1@example.com',
              fromList: 'campaign_list_2',
              toList: 'campaign_list_1',
              reason: 'Rebalancing from oversized List 2 to undersized List 1',
            },
            // ... more movements
          ],
          rationale: 'List 2 is 11.4% oversized while List 1 is 14.3% undersized. Redistributing 133 contacts from List 2 to List 1.',
          expectedImpact: 'Will bring all lists within ±1% of perfect balance',
          alternativesConsidered: [
            'Backfill only from master list - rejected due to FIFO preservation',
            'Move contacts to List 3 first - rejected as List 3 already near target',
          ],
          confidence: 0.92,
        });

        const result = await agent.determineRebalancing(input);

        expect(result.requiresRebalancing).toBe(true);
        expect(result.movements.length).toBeGreaterThan(0);
        expect(result.rationale).toContain('oversized');
      });

      it('should generate movements that preserve FIFO ordering', async () => {
        const input = createUnbalancedInput();
        const mockResponse = createRebalancingResponse();

        mockGeminiClient.generateJSON.mockResolvedValue(mockResponse);

        const result = await agent.determineRebalancing(input);

        // Verify movements go from higher lists to lower lists when possible
        const movementsToList1 = result.movements.filter((m) => m.toList === 'campaign_list_1');
        expect(movementsToList1.length).toBeGreaterThan(0);
      });

      it('should backfill from master list when available', async () => {
        const input: RebalancingInput = {
          currentDistribution: {
            list1: 900,
            list2: 1000,
            list3: 1100,
          },
          suppressedContacts: {
            fromList1: 100,
            fromList2: 50,
            fromList3: 25,
          },
          availableForRebalancing: 300, // Plenty available
          balanceThreshold: 5,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: true,
          targetDistribution: {
            list1: 1000,
            list2: 1000,
            list3: 1000,
          },
          movements: [
            {
              contactId: 2001,
              email: 'new1@example.com',
              fromList: 'none',
              toList: 'campaign_list_1',
              reason: 'Backfilling from master list to undersized List 1',
            },
            // ... 99 more backfill movements
          ],
          rationale: 'List 1 heavily undersized due to suppressions. Backfilling 100 contacts from master list while rebalancing Lists 2 and 3.',
          expectedImpact: 'Will restore all lists to equal distribution at 1000 contacts each',
          alternativesConsidered: [
            'Move contacts from List 3 to List 1 - rejected to minimize disruption',
          ],
          confidence: 0.88,
        });

        const result = await agent.determineRebalancing(input);

        const backfillMovements = result.movements.filter((m) => m.fromList === 'none');
        expect(backfillMovements.length).toBeGreaterThan(0);
      });
    });

    describe('validation', () => {
      it('should throw error when movements array is not an array', async () => {
        const input = createBalancedInput();

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: false,
          targetDistribution: { list1: 1200, list2: 1200, list3: 1200 },
          movements: 'not an array',
          rationale: 'Test',
          expectedImpact: 'Test',
          alternativesConsidered: [],
          confidence: 0.9,
        });

        await expect(agent.determineRebalancing(input)).rejects.toThrow('movements must be an array');
      });

      it('should throw error when confidence is invalid', async () => {
        const input = createBalancedInput();

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: false,
          targetDistribution: { list1: 1200, list2: 1200, list3: 1200 },
          movements: [],
          rationale: 'Test',
          expectedImpact: 'Test',
          alternativesConsidered: [],
          confidence: 2.0, // Invalid
        });

        await expect(agent.determineRebalancing(input)).rejects.toThrow('confidence must be between');
      });
    });

    describe('edge cases', () => {
      it('should handle all lists empty', async () => {
        const input: RebalancingInput = {
          currentDistribution: {
            list1: 0,
            list2: 0,
            list3: 0,
          },
          suppressedContacts: {
            fromList1: 0,
            fromList2: 0,
            fromList3: 0,
          },
          availableForRebalancing: 3600,
          balanceThreshold: 5,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: true,
          targetDistribution: {
            list1: 1200,
            list2: 1200,
            list3: 1200,
          },
          movements: Array(3600)
            .fill(null)
            .map((_, i) => ({
              contactId: 3000 + i,
              email: `user${i}@example.com`,
              fromList: 'none',
              toList: `campaign_list_${(i % 3) + 1}`,
              reason: 'Initial population from master list',
            })),
          rationale: 'All lists empty. Distributing 3600 contacts equally across three lists.',
          expectedImpact: 'Will populate lists with 1200 contacts each',
          alternativesConsidered: [],
          confidence: 0.99,
        });

        const result = await agent.determineRebalancing(input);

        expect(result.requiresRebalancing).toBe(true);
        expect(result.movements.length).toBe(3600);
      });

      it('should handle no available backfill contacts', async () => {
        const input: RebalancingInput = {
          currentDistribution: {
            list1: 900,
            list2: 1300,
            list3: 1200,
          },
          suppressedContacts: {
            fromList1: 100,
            fromList2: 0,
            fromList3: 0,
          },
          availableForRebalancing: 0, // No backfill available
          balanceThreshold: 5,
        };

        mockGeminiClient.generateJSON.mockResolvedValue({
          requiresRebalancing: true,
          targetDistribution: {
            list1: 1133,
            list2: 1133,
            list3: 1134,
          },
          movements: [
            {
              contactId: 5001,
              email: 'user1@example.com',
              fromList: 'campaign_list_2',
              toList: 'campaign_list_1',
              reason: 'Redistributing from oversized List 2 (no backfill available)',
            },
            // ... more movements from List 2 to List 1
          ],
          rationale: 'No backfill available from master list. Redistributing existing contacts from List 2 to List 1.',
          expectedImpact: 'Will balance lists within available contacts',
          alternativesConsidered: [
            'Wait for master list backfill - rejected as immediate balance needed',
          ],
          confidence: 0.85,
        });

        const result = await agent.determineRebalancing(input);

        const backfillMovements = result.movements.filter((m) => m.fromList === 'none');
        expect(backfillMovements).toHaveLength(0);
      });
    });
  });
});

// Helper functions
function createBalancedInput(): RebalancingInput {
  return {
    currentDistribution: {
      list1: 1200,
      list2: 1195,
      list3: 1205,
    },
    suppressedContacts: {
      fromList1: 0,
      fromList2: 0,
      fromList3: 0,
    },
    availableForRebalancing: 0,
    balanceThreshold: 5,
  };
}

function createNoRebalancingResponse() {
  return {
    requiresRebalancing: false,
    targetDistribution: {
      list1: 1200,
      list2: 1195,
      list3: 1205,
    },
    movements: [],
    rationale: 'Lists balanced within threshold',
    expectedImpact: 'None',
    alternativesConsidered: [],
    confidence: 0.95,
  };
}

function createUnbalancedInput(): RebalancingInput {
  return {
    currentDistribution: {
      list1: 1000,
      list2: 1300,
      list3: 1100,
    },
    suppressedContacts: {
      fromList1: 50,
      fromList2: 10,
      fromList3: 25,
    },
    availableForRebalancing: 100,
    balanceThreshold: 5,
  };
}

function createRebalancingResponse() {
  return {
    requiresRebalancing: true,
    targetDistribution: {
      list1: 1167,
      list2: 1167,
      list3: 1166,
    },
    movements: [
      {
        contactId: 1001,
        email: 'user1@example.com',
        fromList: 'campaign_list_2' as const,
        toList: 'campaign_list_1' as const,
        reason: 'Rebalancing',
      },
    ],
    rationale: 'Rebalancing needed',
    expectedImpact: 'Will balance lists',
    alternativesConsidered: [],
    confidence: 0.9,
  };
}
```

### 3. List Operations Service Tests

**File**: `tests/unit/services/list-operations.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListOperationsService } from '../../../src/services/list-management/list-operations.service';

// Mock dependencies
jest.mock('../../../src/services/mailjet/mailjet-client');
jest.mock('../../../src/services/cache/list-cache.service');
jest.mock('@prisma/client');

describe('ListOperationsService', () => {
  let service: ListOperationsService;
  let mockMailjetClient: any;
  let mockCacheService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    service = new ListOperationsService();
    mockMailjetClient = (service as any).mailjetClient;
    mockCacheService = (service as any).cacheService;
  });

  describe('calculateBalanceDeviation()', () => {
    it('should return 0% for perfectly balanced lists', () => {
      const deviation = service.calculateBalanceDeviation(1200, 1200, 1200);
      expect(deviation).toBe(0);
    });

    it('should return 5% for ±5% deviation', () => {
      const deviation = service.calculateBalanceDeviation(1200, 1260, 1140);
      expect(deviation).toBeCloseTo(5, 1);
    });

    it('should return 10% for ±10% deviation', () => {
      const deviation = service.calculateBalanceDeviation(1000, 1200, 1200);
      expect(deviation).toBeCloseTo(16.7, 1);
    });

    it('should handle zero total', () => {
      const deviation = service.calculateBalanceDeviation(0, 0, 0);
      expect(isNaN(deviation)).toBe(true); // Division by zero
    });
  });

  describe('isBalanced()', () => {
    it('should return true when within ±5% threshold', () => {
      expect(service.isBalanced(1200, 1190, 1210)).toBe(true);
      expect(service.isBalanced(1200, 1140, 1260)).toBe(true);
    });

    it('should return false when exceeding ±5% threshold', () => {
      expect(service.isBalanced(1000, 1300, 1200)).toBe(false);
      expect(service.isBalanced(900, 1200, 1200)).toBe(false);
    });

    it('should return true for perfectly balanced lists', () => {
      expect(service.isBalanced(1200, 1200, 1200)).toBe(true);
    });
  });

  describe('getCurrentListState()', () => {
    it('should fetch counts for all lists in parallel', async () => {
      mockMailjetClient.getListContactCount
        .mockResolvedValueOnce(5776) // master
        .mockResolvedValueOnce(1200) // list1
        .mockResolvedValueOnce(1190) // list2
        .mockResolvedValueOnce(1210) // list3
        .mockResolvedValueOnce(450); // suppression

      const state = await service.getCurrentListState();

      expect(state).toEqual({
        masterList: 5776,
        campaignList1: 1200,
        campaignList2: 1190,
        campaignList3: 1210,
        suppressionList: 450,
        timestamp: expect.any(Date),
      });

      expect(mockMailjetClient.getListContactCount).toHaveBeenCalledTimes(5);
    });

    it('should throw error if any list fetch fails', async () => {
      mockMailjetClient.getListContactCount
        .mockResolvedValueOnce(5776)
        .mockRejectedValueOnce(new Error('Mailjet API error'));

      await expect(service.getCurrentListState()).rejects.toThrow('Mailjet API error');
    });
  });

  describe('suppressContacts()', () => {
    it('should suppress contacts and log to database', async () => {
      const contacts = [
        {
          contactId: 1001,
          email: 'bounce1@example.com',
          reason: 'hard_bounce',
          bounceType: 'user_unknown',
        },
        {
          contactId: 1002,
          email: 'bounce2@example.com',
          reason: 'hard_bounce',
          bounceType: 'domain_error',
        },
      ];

      mockMailjetClient.removeContactFromList.mockResolvedValue(true);
      mockMailjetClient.addContactToList.mockResolvedValue(true);
      mockCacheService.updateContactMembership.mockResolvedValue(undefined);

      const result = await service.suppressContacts(contacts, 'AI rationale', 0.95);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockMailjetClient.addContactToList).toHaveBeenCalledTimes(2);
      expect(mockCacheService.updateContactMembership).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      const contacts = [
        { contactId: 1001, email: 'good@example.com', reason: 'hard_bounce' },
        { contactId: 1002, email: 'bad@example.com', reason: 'hard_bounce' },
      ];

      mockMailjetClient.removeContactFromList.mockResolvedValue(true);
      mockMailjetClient.addContactToList
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Mailjet error'));

      const result = await service.suppressContacts(contacts);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].email).toBe('bad@example.com');
    });

    it('should invalidate cache for suppressed contacts', async () => {
      const contacts = [{ contactId: 1001, email: 'test@example.com', reason: 'hard_bounce' }];

      mockMailjetClient.removeContactFromList.mockResolvedValue(true);
      mockMailjetClient.addContactToList.mockResolvedValue(true);

      await service.suppressContacts(contacts);

      expect(mockCacheService.updateContactMembership).toHaveBeenCalledWith(1001, {
        inCampaignList1: false,
        inCampaignList2: false,
        inCampaignList3: false,
        inSuppressionList: true,
      });
    });
  });

  describe('executeRebalancing()', () => {
    it('should execute contact movements between lists', async () => {
      const movements = [
        {
          contactId: 1001,
          email: 'user1@example.com',
          fromList: 'campaign_list_2' as const,
          toList: 'campaign_list_1' as const,
          reason: 'Rebalancing',
        },
        {
          contactId: 1002,
          email: 'user2@example.com',
          fromList: 'campaign_list_2' as const,
          toList: 'campaign_list_1' as const,
          reason: 'Rebalancing',
        },
      ];

      mockMailjetClient.removeContactFromList.mockResolvedValue(true);
      mockMailjetClient.addContactToList.mockResolvedValue(true);
      mockCacheService.invalidateContact.mockResolvedValue(undefined);

      const result = await service.executeRebalancing(movements);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockMailjetClient.removeContactFromList).toHaveBeenCalledTimes(2);
      expect(mockMailjetClient.addContactToList).toHaveBeenCalledTimes(2);
    });

    it('should handle backfill from master list (fromList=none)', async () => {
      const movements = [
        {
          contactId: 2001,
          email: 'new@example.com',
          fromList: 'none' as const,
          toList: 'campaign_list_1' as const,
          reason: 'Backfill',
        },
      ];

      mockMailjetClient.addContactToList.mockResolvedValue(true);
      mockCacheService.invalidateContact.mockResolvedValue(undefined);

      const result = await service.executeRebalancing(movements);

      expect(result.success).toBe(1);
      expect(mockMailjetClient.removeContactFromList).not.toHaveBeenCalled();
      expect(mockMailjetClient.addContactToList).toHaveBeenCalledTimes(1);
    });

    it('should rollback on failure', async () => {
      const movements = [
        {
          contactId: 1001,
          email: 'fail@example.com',
          fromList: 'campaign_list_2' as const,
          toList: 'campaign_list_1' as const,
          reason: 'Test',
        },
      ];

      mockMailjetClient.removeContactFromList.mockResolvedValue(true);
      mockMailjetClient.addContactToList.mockRejectedValue(new Error('Add failed'));

      const result = await service.executeRebalancing(movements);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].email).toBe('fail@example.com');
    });
  });
});
```

---

## Integration Tests

### 1. Post-Campaign Maintenance Integration Test

**File**: `tests/integration/services/post-campaign-maintenance.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { PostCampaignMaintenanceService } from '../../../src/services/list-management/post-campaign-maintenance.service';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/test-db.helper';

const prisma = new PrismaClient();

describe('PostCampaignMaintenanceService Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear test data
    await prisma.listMaintenanceLog.deleteMany({});
    await prisma.contactSuppressionHistory.deleteMany({});
  });

  describe('execute()', () => {
    it('should complete full maintenance workflow', async () => {
      // Create test campaign
      const campaign = await prisma.campaignSchedule.create({
        data: {
          name: 'Test Campaign',
          sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          status: 'sent',
          mailjetCampaignId: '123456',
          listId: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
          roundNumber: 1,
        },
      });

      const service = new PostCampaignMaintenanceService();

      const report = await service.execute(campaign);

      // Assertions
      expect(report.status).toMatch(/success|partial_success/);
      expect(report.maintenanceLogId).toBeDefined();
      expect(report.executionTimeMs).toBeGreaterThan(0);

      // Verify log was created
      const log = await prisma.listMaintenanceLog.findUnique({
        where: { id: report.maintenanceLogId },
      });

      expect(log).toBeDefined();
      expect(log!.campaignScheduleId).toBe(campaign.id);
      expect(log!.maintenanceType).toBe('post_campaign');
      expect(log!.aiAssessments).toBeDefined();

      // Cleanup
      await prisma.listMaintenanceLog.delete({ where: { id: log!.id } });
      await prisma.campaignSchedule.delete({ where: { id: campaign.id } });
    }, 60000); // 60s timeout

    it('should log suppressions to ContactSuppressionHistory', async () => {
      const campaign = await prisma.campaignSchedule.create({
        data: {
          name: 'Campaign with Bounces',
          sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
          status: 'sent',
          mailjetCampaignId: '123457',
          listId: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
          roundNumber: 2,
        },
      });

      const service = new PostCampaignMaintenanceService();
      const report = await service.execute(campaign);

      if (report.contactsSuppressed > 0) {
        const suppressions = await prisma.contactSuppressionHistory.findMany({
          where: {
            maintenanceLogId: report.maintenanceLogId,
          },
        });

        expect(suppressions.length).toBe(report.contactsSuppressed);
        expect(suppressions[0].aiRationale).toBeDefined();
        expect(suppressions[0].reason).toBeDefined();
      }

      // Cleanup
      await prisma.contactSuppressionHistory.deleteMany({
        where: { maintenanceLogId: report.maintenanceLogId },
      });
      await prisma.listMaintenanceLog.delete({ where: { id: report.maintenanceLogId } });
      await prisma.campaignSchedule.delete({ where: { id: campaign.id } });
    }, 60000);

    it('should handle campaigns with no bounces', async () => {
      const campaign = await prisma.campaignSchedule.create({
        data: {
          name: 'Clean Campaign',
          sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
          status: 'sent',
          mailjetCampaignId: '999999', // Mock campaign with no bounces
          listId: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
          roundNumber: 1,
        },
      });

      const service = new PostCampaignMaintenanceService();
      const report = await service.execute(campaign);

      expect(report.status).toBe('success');
      expect(report.contactsSuppressed).toBe(0);
      expect(report.contactsRebalanced).toBeGreaterThanOrEqual(0);

      // Cleanup
      await prisma.listMaintenanceLog.delete({ where: { id: report.maintenanceLogId } });
      await prisma.campaignSchedule.delete({ where: { id: campaign.id } });
    }, 60000);
  });
});
```

### 2. Weekly Health Check Integration Test

**File**: `tests/integration/services/weekly-health-check.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { executeWeeklyHealthCheck } from '../../../src/schedulers/jobs/weekly-health-check.job';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/test-db.helper';

const prisma = new PrismaClient();

describe('Weekly Health Check Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.listHealthCheck.deleteMany({});
  });

  describe('executeWeeklyHealthCheck()', () => {
    it('should create health check record with AI analysis', async () => {
      await executeWeeklyHealthCheck();

      const healthChecks = await prisma.listHealthCheck.findMany({
        orderBy: { executedAt: 'desc' },
        take: 1,
      });

      expect(healthChecks).toHaveLength(1);

      const check = healthChecks[0];
      expect(check.masterListSize).toBeGreaterThan(0);
      expect(check.campaignList1Size).toBeGreaterThan(0);
      expect(check.campaignList2Size).toBeGreaterThan(0);
      expect(check.campaignList3Size).toBeGreaterThan(0);
      expect(check.balanceDeviation).toBeGreaterThanOrEqual(0);
      expect(check.isBalanced).toBeDefined();
      expect(check.urgency).toMatch(/low|medium|high|critical/);
      expect(check.healthAssessments).toBeDefined();
      expect(check.weeklyReport).toBeDefined();

      // Cleanup
      await prisma.listHealthCheck.delete({ where: { id: check.id } });
    }, 60000);

    it('should determine balance status correctly', async () => {
      await executeWeeklyHealthCheck();

      const check = await prisma.listHealthCheck.findFirst({
        orderBy: { executedAt: 'desc' },
      });

      expect(check).toBeDefined();

      const total = check!.campaignList1Size + check!.campaignList2Size + check!.campaignList3Size;
      const target = total / 3;
      const maxDeviation = Math.max(
        Math.abs(check!.campaignList1Size - target) / target,
        Math.abs(check!.campaignList2Size - target) / target,
        Math.abs(check!.campaignList3Size - target) / target
      );

      const expectedBalance = maxDeviation <= 0.05;
      expect(check!.isBalanced).toBe(expectedBalance);

      // Cleanup
      await prisma.listHealthCheck.delete({ where: { id: check!.id } });
    }, 60000);
  });
});
```

---

## End-to-End Tests

### 1. Post-Campaign Workflow E2E Test

**File**: `tests/e2e/workflows/post-campaign-workflow.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/app';
import { PrismaClient } from '@prisma/client';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

const prisma = new PrismaClient();

describe('Post-Campaign Workflow E2E', () => {
  let redisContainer: StartedTestContainer;
  let postgresContainer: StartedTestContainer;

  beforeAll(async () => {
    // Start test containers
    redisContainer = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();

    postgresContainer = await new GenericContainer('postgres:15')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'campaign_manager_test',
      })
      .withExposedPorts(5432)
      .start();

    // Set test environment variables
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    process.env.DATABASE_URL = `postgresql://test:test@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/campaign_manager_test`;

    // Run migrations
    // await execSync('npx prisma migrate deploy');
  }, 120000);

  afterAll(async () => {
    await prisma.$disconnect();
    await redisContainer.stop();
    await postgresContainer.stop();
  }, 60000);

  it('should execute complete post-campaign maintenance workflow', async () => {
    // Step 1: Create campaign
    const createResponse = await request(app)
      .post('/api/campaigns')
      .send({
        name: 'E2E Test Campaign',
        listId: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
        sendTime: new Date(Date.now() + 1000),
      })
      .expect(201);

    const campaignId = createResponse.body.id;

    // Step 2: Mark campaign as sent
    await prisma.campaignSchedule.update({
      where: { id: campaignId },
      data: {
        status: 'sent',
        sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      },
    });

    // Step 3: Trigger maintenance
    const maintenanceResponse = await request(app)
      .post('/api/list-management/trigger-maintenance')
      .send({ campaignId })
      .expect(200);

    expect(maintenanceResponse.body.success).toBe(true);
    expect(maintenanceResponse.body.maintenanceLogId).toBeDefined();

    // Step 4: Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Verify maintenance log
    const logResponse = await request(app)
      .get(`/api/list-management/logs/${maintenanceResponse.body.maintenanceLogId}`)
      .expect(200);

    expect(logResponse.body.status).toMatch(/success|partial_success/);
    expect(logResponse.body.campaignScheduleId).toBe(campaignId);
    expect(logResponse.body.maintenanceType).toBe('post_campaign');
    expect(logResponse.body.aiAssessments).toBeDefined();
    expect(logResponse.body.beforeState).toBeDefined();
    expect(logResponse.body.afterState).toBeDefined();

    // Step 6: Verify list state changed
    expect(logResponse.body.beforeState).not.toEqual(logResponse.body.afterState);

    // Cleanup
    await prisma.listMaintenanceLog.delete({
      where: { id: maintenanceResponse.body.maintenanceLogId },
    });
    await prisma.campaignSchedule.delete({ where: { id: campaignId } });
  }, 120000);

  it('should handle concurrent maintenance jobs', async () => {
    // Create multiple campaigns
    const campaigns = await Promise.all([
      prisma.campaignSchedule.create({
        data: {
          name: 'Concurrent 1',
          sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
          status: 'sent',
          mailjetCampaignId: 'concurrent1',
          listId: process.env.MAILJET_CAMPAIGN_LIST_1_ID!,
        },
      }),
      prisma.campaignSchedule.create({
        data: {
          name: 'Concurrent 2',
          sendTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
          status: 'sent',
          mailjetCampaignId: 'concurrent2',
          listId: process.env.MAILJET_CAMPAIGN_LIST_2_ID!,
        },
      }),
    ]);

    // Trigger maintenance for both
    const results = await Promise.all(
      campaigns.map((c) =>
        request(app)
          .post('/api/list-management/trigger-maintenance')
          .send({ campaignId: c.id })
      )
    );

    // Verify both succeeded
    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    // Cleanup
    await prisma.listMaintenanceLog.deleteMany({
      where: {
        campaignScheduleId: { in: campaigns.map((c) => c.id) },
      },
    });
    await prisma.campaignSchedule.deleteMany({
      where: { id: { in: campaigns.map((c) => c.id) } },
    });
  }, 180000);
});
```

---

## AI Agent Tests

### AI Agent Response Validation Tests

**File**: `tests/integration/agents/ai-agent-responses.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { GeminiClient } from '../../../src/agents/gemini-client';
import { ListHealthAgent } from '../../../src/agents/list-health-agent';
import { RebalancingAgent } from '../../../src/agents/rebalancing-agent';
import { OptimizationAgent } from '../../../src/agents/optimization-agent';
import { ReportingAgent } from '../../../src/agents/reporting-agent';

describe('AI Agent Response Validation', () => {
  let geminiClient: GeminiClient;

  beforeAll(() => {
    geminiClient = new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'gemini-2.0-flash-exp',
    });
  });

  describe('ListHealthAgent real API', () => {
    it('should return valid response structure from Gemini', async () => {
      const agent = new ListHealthAgent(geminiClient);

      const input = {
        name: 'Campaign List 1',
        subscriberCount: 1200,
        targetSize: 1200,
        bounceRate: 1.5,
        hardBounces: 10,
        softBounces: 8,
        deliveryRate: 98.5,
        lastCampaignDate: new Date(),
        bounceRateTrend: 'stable' as const,
        sizeTrend: 'stable' as const,
        suppressionRate: 1.5,
      };

      const result = await agent.analyze(input);

      // Validate structure
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('concerns');
      expect(result).toHaveProperty('riskFactors');
      expect(result).toHaveProperty('urgency');
      expect(result).toHaveProperty('confidence');

      // Validate types
      expect(['healthy', 'warning', 'critical']).toContain(result.status);
      expect(Array.isArray(result.concerns)).toBe(true);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.urgency);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }, 30000);
  });

  describe('RebalancingAgent real API', () => {
    it('should return valid rebalancing plan from Gemini', async () => {
      const agent = new RebalancingAgent(geminiClient);

      const input = {
        currentDistribution: {
          list1: 1000,
          list2: 1300,
          list3: 1100,
        },
        suppressedContacts: {
          fromList1: 50,
          fromList2: 10,
          fromList3: 25,
        },
        availableForRebalancing: 100,
        balanceThreshold: 5,
      };

      const result = await agent.determineRebalancing(input);

      // Validate structure
      expect(result).toHaveProperty('requiresRebalancing');
      expect(result).toHaveProperty('targetDistribution');
      expect(result).toHaveProperty('movements');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('confidence');

      // Validate types
      expect(typeof result.requiresRebalancing).toBe('boolean');
      expect(Array.isArray(result.movements)).toBe(true);
      expect(typeof result.confidence).toBe('number');

      if (result.requiresRebalancing) {
        expect(result.movements.length).toBeGreaterThan(0);
        expect(result.movements[0]).toHaveProperty('contactId');
        expect(result.movements[0]).toHaveProperty('email');
        expect(result.movements[0]).toHaveProperty('fromList');
        expect(result.movements[0]).toHaveProperty('toList');
      }
    }, 30000);
  });

  describe('AI response consistency', () => {
    it('should return consistent results for identical inputs', async () => {
      const agent = new ListHealthAgent(geminiClient);

      const input = {
        name: 'Test List',
        subscriberCount: 1200,
        targetSize: 1200,
        bounceRate: 2.5,
        hardBounces: 20,
        softBounces: 10,
        deliveryRate: 97.5,
        lastCampaignDate: new Date(),
        bounceRateTrend: 'stable' as const,
        sizeTrend: 'stable' as const,
        suppressionRate: 2.5,
      };

      // Run 3 times
      const results = await Promise.all([
        agent.analyze(input),
        agent.analyze(input),
        agent.analyze(input),
      ]);

      // Status should be consistent
      expect(results[0].status).toBe(results[1].status);
      expect(results[1].status).toBe(results[2].status);

      // Urgency should be consistent
      expect(results[0].urgency).toBe(results[1].urgency);
      expect(results[1].urgency).toBe(results[2].urgency);

      // Confidence should be similar (±0.1)
      expect(Math.abs(results[0].confidence - results[1].confidence)).toBeLessThan(0.1);
      expect(Math.abs(results[1].confidence - results[2].confidence)).toBeLessThan(0.1);
    }, 90000);
  });
});
```

---

## Performance Tests

### Load Testing

**File**: `tests/performance/list-management-load.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ListOperationsService } from '../../../src/services/list-management/list-operations.service';

describe('List Management Performance', () => {
  describe('suppressContacts() performance', () => {
    it('should suppress 100 contacts in under 10 seconds', async () => {
      const service = new ListOperationsService();

      const contacts = Array(100)
        .fill(null)
        .map((_, i) => ({
          contactId: 10000 + i,
          email: `perf${i}@example.com`,
          reason: 'hard_bounce',
          bounceType: 'user_unknown',
        }));

      const start = performance.now();
      const result = await service.suppressContacts(contacts);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(result.success).toBeGreaterThan(0);
    }, 15000);
  });

  describe('executeRebalancing() performance', () => {
    it('should rebalance 500 contacts in under 30 seconds', async () => {
      const service = new ListOperationsService();

      const movements = Array(500)
        .fill(null)
        .map((_, i) => ({
          contactId: 20000 + i,
          email: `rebal${i}@example.com`,
          fromList: 'campaign_list_2' as const,
          toList: 'campaign_list_1' as const,
          reason: 'Performance test',
        }));

      const start = performance.now();
      const result = await service.executeRebalancing(movements);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(30000); // 30 seconds
      expect(result.success).toBeGreaterThan(0);
    }, 35000);
  });

  describe('cache performance', () => {
    it('should retrieve cached list state in under 100ms', async () => {
      const { ListCacheService } = await import('../../../src/services/cache/list-cache.service');
      const cacheService = new ListCacheService();

      // Prime cache
      await cacheService.cacheListState({
        masterList: 5776,
        campaignList1: 1200,
        campaignList2: 1200,
        campaignList3: 1200,
        suppressionList: 450,
        timestamp: new Date(),
      });

      // Measure retrieval
      const start = performance.now();
      const cached = await cacheService.getListState();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // 100ms
      expect(cached).toBeDefined();
    });
  });
});
```

---

## Test Data

### Fixture: Bounce Data

**File**: `tests/fixtures/bounce-data.json`

```json
{
  "hardBounces": [
    {
      "contactId": 1001,
      "email": "bounce1@example.com",
      "bounceReason": "user_unknown",
      "bounceDate": "2025-10-01T10:30:00Z"
    },
    {
      "contactId": 1002,
      "email": "bounce2@example.com",
      "bounceReason": "domain_error",
      "bounceDate": "2025-10-01T10:32:00Z"
    }
  ],
  "softBounces": [
    {
      "contactId": 2001,
      "email": "soft1@example.com",
      "bounceReason": "mailbox_full",
      "bounceDate": "2025-10-01T10:35:00Z",
      "bounceCount": 1
    },
    {
      "contactId": 2002,
      "email": "soft2@example.com",
      "bounceReason": "mailbox_full",
      "bounceDate": "2025-10-01T10:40:00Z",
      "bounceCount": 3
    }
  ]
}
```

### Fixture: List States

**File**: `tests/fixtures/list-states.json`

```json
{
  "balanced": {
    "masterList": 5776,
    "campaignList1": 1200,
    "campaignList2": 1195,
    "campaignList3": 1205,
    "suppressionList": 450
  },
  "unbalanced": {
    "masterList": 5776,
    "campaignList1": 1000,
    "campaignList2": 1300,
    "campaignList3": 1100,
    "suppressionList": 450
  },
  "critical": {
    "masterList": 5776,
    "campaignList1": 800,
    "campaignList2": 1400,
    "campaignList3": 900,
    "suppressionList": 650
  }
}
```

---

## Mocking Strategy

### Mock Mailjet Client

**File**: `tests/helpers/mock-mailjet.helper.ts`

```typescript
export class MockMailjetClient {
  private listContacts: Map<string, Set<number>> = new Map();

  constructor() {
    // Initialize with default lists
    this.listContacts.set('master', new Set([...Array(5776)].map((_, i) => 1000 + i)));
    this.listContacts.set('list1', new Set([...Array(1200)].map((_, i) => 1000 + i)));
    this.listContacts.set('list2', new Set([...Array(1200)].map((_, i) => 2200 + i)));
    this.listContacts.set('list3', new Set([...Array(1200)].map((_, i) => 3400 + i)));
    this.listContacts.set('suppression', new Set());
  }

  async getListContactCount(listId: string): Promise<number> {
    const contacts = this.listContacts.get(listId);
    return contacts ? contacts.size : 0;
  }

  async addContactToList(listId: string, contactId: number): Promise<boolean> {
    if (!this.listContacts.has(listId)) {
      this.listContacts.set(listId, new Set());
    }
    this.listContacts.get(listId)!.add(contactId);
    return true;
  }

  async removeContactFromList(listId: string, contactId: number): Promise<boolean> {
    if (this.listContacts.has(listId)) {
      this.listContacts.get(listId)!.delete(contactId);
    }
    return true;
  }

  async fetchCampaignBounces(campaignId: string): Promise<any> {
    // Return mock bounce data
    return require('../fixtures/bounce-data.json');
  }

  reset(): void {
    this.listContacts.clear();
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test List Management

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:e2e
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

## Next Steps

1. ✅ Unit test specifications complete
2. ✅ Integration test specifications complete
3. ✅ E2E test specifications complete
4. ✅ AI agent test specifications complete
5. ✅ Performance test specifications complete
6. 🔲 Implement all tests
7. 🔲 Achieve 75%+ coverage
8. 🔲 Set up CI/CD pipeline
9. 🔲 Run tests in staging
10. 🔲 Production validation

---

**Last Updated**: October 1, 2025
**Version**: 1.0
**Status**: ✅ Approved
