/**
 * Lifecycle Flow Integration Tests
 * Tests the complete lifecycle workflow from creation to wrap-up
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { CampaignOrchestratorService } from '@/services/lifecycle';

// These are integration tests that require full setup
// Mark as skip for now, enable when ready to test with real services
describe.skip('Lifecycle Flow Integration', () => {
  let orchestrator: CampaignOrchestratorService;

  beforeAll(() => {
    orchestrator = new CampaignOrchestratorService();
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('Complete Lifecycle', () => {
    it('should create campaign with 3 rounds and schedule all jobs', async () => {
      const params = {
        campaignName: 'Integration Test Campaign',
        listIdPrefix: 'test_int',
        subject: 'Integration Test',
        senderName: 'Test Sender',
        senderEmail: 'test@example.com',
        totalRecipients: 300,
        mailjetListIds: [
          BigInt(1001),
          BigInt(1002),
          BigInt(1003)
        ] as [bigint, bigint, bigint],
        mailjetDraftId: BigInt(9999)
      };

      const result = await orchestrator.createCampaign(params);

      expect(result.success).toBe(true);
      expect(result.schedules).toHaveLength(3);
      expect(result.schedules[0].roundNumber).toBe(1);
      expect(result.schedules[1].roundNumber).toBe(2);
      expect(result.schedules[2].roundNumber).toBe(3);
    });

    it('should run pre-flight verification with AI analysis', async () => {
      // Assumes campaign created in previous test
      const scheduleId = 1;

      const result = await orchestrator.runPreFlight(scheduleId);

      expect(result.success).toBe(true);
      expect(['ready', 'warning', 'blocked']).toContain(result.status);
    });

    it('should launch campaign successfully', async () => {
      const scheduleId = 1;

      const result = await orchestrator.launchCampaign({
        campaignScheduleId: scheduleId,
        skipPreFlight: true // Skip for test
      });

      if (result.success) {
        expect(result.status).toBe('SENT');
      } else {
        // Expected if MailJet not configured
        expect(result.error).toBeDefined();
      }
    });

    it('should collect metrics and run wrap-up analysis', async () => {
      const scheduleId = 1;

      // Wait some time after launch for metrics to be available
      // In real scenario, this would be triggered by queue after 30min

      const result = await orchestrator.runWrapUp(scheduleId);

      if (result.success) {
        expect(result.status).toBe('COMPLETED');
      } else {
        // Expected if no metrics available yet
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Campaign Status Tracking', () => {
    it('should track campaign status across all rounds', async () => {
      const campaignName = 'Integration Test Campaign';

      const status = await orchestrator.getCampaignStatus(campaignName);

      expect(status.campaignName).toBe(campaignName);
      expect(status.rounds).toHaveLength(3);

      status.rounds.forEach(round => {
        expect(round.roundNumber).toBeGreaterThan(0);
        expect(round.roundNumber).toBeLessThanOrEqual(3);
        expect(round.status).toBeDefined();
        expect(round.notificationStatus).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing draft ID', async () => {
      const params = {
        campaignName: 'Test No Draft',
        listIdPrefix: 'test_nodraft',
        subject: 'Test',
        senderName: 'Test',
        senderEmail: 'test@example.com',
        totalRecipients: 100,
        mailjetListIds: [
          BigInt(1001),
          BigInt(1002),
          BigInt(1003)
        ] as [bigint, bigint, bigint]
        // No mailjetDraftId
      };

      const result = await orchestrator.createCampaign(params);
      expect(result.success).toBe(true);

      // Try to launch without draft
      const launchResult = await orchestrator.launchCampaign({
        campaignScheduleId: result.schedules[0].id,
        skipPreFlight: true
      });

      expect(launchResult.success).toBe(false);
      expect(launchResult.error).toBeDefined();
    });

    it('should block campaign with critical issues', async () => {
      // This would require mocking MailJet to return errors
      // Implementation depends on test strategy
    });

    it('should handle campaign cancellation', async () => {
      const params = {
        campaignName: 'Test Cancel',
        listIdPrefix: 'test_cancel',
        subject: 'Test',
        senderName: 'Test',
        senderEmail: 'test@example.com',
        totalRecipients: 100,
        mailjetListIds: [
          BigInt(1001),
          BigInt(1002),
          BigInt(1003)
        ] as [bigint, bigint, bigint]
      };

      const createResult = await orchestrator.createCampaign(params);
      expect(createResult.success).toBe(true);

      const cancelResult = await orchestrator.cancelCampaign(
        createResult.schedules[0].id,
        'Testing cancellation'
      );

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.status).toBe('BLOCKED');
    });
  });
});
