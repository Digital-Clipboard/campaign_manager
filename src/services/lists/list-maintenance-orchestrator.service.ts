/**
 * List Maintenance Orchestrator Service
 * Coordinates post-campaign list cleanup and optimization
 */

import { MaintenanceAction } from '@prisma/client';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';
import { ListManagementService } from './list-management.service';
import { ContactService } from './contact.service';
import { SuppressionService } from './suppression.service';
import { OptimizationAgent, RebalancingAgent } from './agents';
import { MailjetAgentClient } from '@/integrations/mcp-clients/mailjet-agent-client';

export interface PostCampaignMaintenanceParams {
  campaignScheduleId: number;
  listId: string;
  campaignName: string;
  roundNumber: number;
}

export interface MaintenanceResult {
  success: boolean;
  maintenanceLogId: number;
  contactsSuppressed: number;
  contactsRebalanced: number;
  summary: string;
  error?: string;
}

export class ListMaintenanceOrchestrator {
  private listService: ListManagementService;
  private contactService: ContactService;
  private suppressionService: SuppressionService;
  private optimizationAgent: OptimizationAgent;
  private rebalancingAgent: RebalancingAgent;
  private mailjetClient: MailjetAgentClient;

  constructor() {
    this.listService = new ListManagementService();
    this.contactService = new ContactService();
    this.suppressionService = new SuppressionService();
    this.optimizationAgent = new OptimizationAgent();
    this.rebalancingAgent = new RebalancingAgent();
    this.mailjetClient = new MailjetAgentClient();
  }

  /**
   * Run post-campaign maintenance (T+24h after campaign completion)
   * 1. Fetch bounces from MailJet
   * 2. AI analyzes and recommends suppressions
   * 3. Execute suppressions
   * 4. AI generates rebalancing plan
   * 5. Execute rebalancing
   * 6. Log everything
   */
  async runPostCampaignMaintenance(
    params: PostCampaignMaintenanceParams
  ): Promise<MaintenanceResult> {
    logger.info('[ListMaintenanceOrchestrator] Starting post-campaign maintenance', {
      campaignScheduleId: params.campaignScheduleId,
      listId: params.listId
    });

    const startTime = Date.now();

    try {
      // Create maintenance log entry
      const maintenanceLog = await prisma.listMaintenanceLog.create({
        data: {
          campaignScheduleId: params.campaignScheduleId,
          listId: params.listId,
          maintenanceType: MaintenanceAction.POST_CAMPAIGN_CLEANUP,
          aiRecommendation: 'Processing...',
          aiConfidence: 0,
          status: 'in_progress'
        }
      });

      // Step 1: Fetch bounce data from MailJet
      logger.info('[ListMaintenanceOrchestrator] Fetching bounces from MailJet');

      const list = await this.listService.getList(params.listId);

      if (!list || !list.mailjetListId) {
        throw new Error(`List ${params.listId} not found or has no MailJet ID`);
      }

      // Fetch bounces from last 48 hours
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const mailjetBounces = await this.mailjetClient.getListBounces(
        list.mailjetListId,
        since
      );

      logger.info('[ListMaintenanceOrchestrator] Bounces fetched', {
        count: mailjetBounces.length
      });

      // Step 2: Get contact details for bounced emails
      const bounceData = await Promise.all(
        mailjetBounces.map(async (bounce) => {
          const contact = await this.contactService.getContactByEmail(bounce.email);

          if (!contact) {
            // Create contact if doesn't exist
            const newContact = await this.contactService.createOrGetContact({
              email: bounce.email,
              mailjetContactId: bounce.contactId
            });

            return {
              contactId: newContact.id,
              email: bounce.email,
              bounceType: bounce.bounceType,
              bounceCount: 1,
              lastBounceDate: bounce.bouncedAt,
              firstBounceDate: bounce.bouncedAt
            };
          }

          // Update bounce count
          await this.contactService.recordBounce(contact.id, bounce.bounceType);

          return {
            contactId: contact.id,
            email: contact.email,
            bounceType: bounce.bounceType,
            bounceCount: contact.bounceCount + 1,
            lastBounceDate: bounce.bouncedAt,
            firstBounceDate: contact.lastBounceDate || bounce.bouncedAt
          };
        })
      );

      // Step 3: AI analyzes bounces and recommends suppressions
      if (bounceData.length > 0) {
        logger.info('[ListMaintenanceOrchestrator] Running AI optimization analysis');

        const optimizationPlan = await this.optimizationAgent.generateSuppressionPlan({
          campaignName: params.campaignName,
          listName: list.name,
          bounces: bounceData,
          currentDeliveryRate: list.deliveryRate || 0.95
        });

        logger.info('[ListMaintenanceOrchestrator] Suppression plan generated', {
          recommendedSuppressions: optimizationPlan.recommendedSuppressions,
          confidence: optimizationPlan.confidence
        });

        // Step 4: Execute suppressions
        let suppressedCount = 0;

        if (optimizationPlan.suppressions.length > 0) {
          const suppressionResults = await this.suppressionService.bulkSuppressContacts(
            optimizationPlan.suppressions.map(s => ({
              contactId: s.contactId,
              reason: s.reason,
              suppressedBy: 'ai',
              aiRationale: s.rationale,
              confidence: s.confidence,
              sourceCampaignId: params.campaignScheduleId.toString()
            }))
          );

          suppressedCount = suppressionResults.success;

          logger.info('[ListMaintenanceOrchestrator] Suppressions executed', {
            success: suppressionResults.success,
            failed: suppressionResults.failed
          });
        }

        // Step 5: Update maintenance log with suppression results
        await prisma.listMaintenanceLog.update({
          where: { id: maintenanceLog.id },
          data: {
            contactsSuppressed: suppressedCount,
            suppressionPlan: optimizationPlan as any,
            aiRecommendation: optimizationPlan.summary,
            aiConfidence: optimizationPlan.confidence
          }
        });
      }

      // Step 6: Check if rebalancing is needed
      logger.info('[ListMaintenanceOrchestrator] Checking campaign list balance');

      const campaignLists = await this.listService.getCampaignLists();

      if (campaignLists.round1 && campaignLists.round2 && campaignLists.round3) {
        const totalActive =
          campaignLists.round1.contactCount +
          campaignLists.round2.contactCount +
          campaignLists.round3.contactCount;

        const rebalancingPlan = await this.rebalancingAgent.generateRebalancingPlan({
          lists: [
            {
              listId: campaignLists.round1.id,
              listName: campaignLists.round1.name,
              roundNumber: 1,
              currentContactCount: campaignLists.round1.contactCount
            },
            {
              listId: campaignLists.round2.id,
              listName: campaignLists.round2.name,
              roundNumber: 2,
              currentContactCount: campaignLists.round2.contactCount
            },
            {
              listId: campaignLists.round3.id,
              listName: campaignLists.round3.name,
              roundNumber: 3,
              currentContactCount: campaignLists.round3.contactCount
            }
          ],
          totalContacts: totalActive,
          suppressedCount: 0, // Already removed from counts
          preserveFIFO: true
        });

        logger.info('[ListMaintenanceOrchestrator] Rebalancing plan generated', {
          isBalanced: rebalancingPlan.isBalanced,
          movesCount: rebalancingPlan.moves.length,
          balanceScore: rebalancingPlan.balanceScore
        });

        // Update maintenance log with rebalancing plan
        await prisma.listMaintenanceLog.update({
          where: { id: maintenanceLog.id },
          data: {
            rebalancingPlan: rebalancingPlan as any,
            aiRecommendation: `${maintenanceLog.aiRecommendation || ''}\n\nRebalancing: ${rebalancingPlan.summary}`
          }
        });
      }

      // Step 7: Complete maintenance log
      const completedLog = await prisma.listMaintenanceLog.update({
        where: { id: maintenanceLog.id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      const duration = Date.now() - startTime;

      logger.info('[ListMaintenanceOrchestrator] Maintenance completed', {
        maintenanceLogId: completedLog.id,
        duration: `${duration}ms`,
        contactsSuppressed: completedLog.contactsSuppressed
      });

      return {
        success: true,
        maintenanceLogId: completedLog.id,
        contactsSuppressed: completedLog.contactsSuppressed,
        contactsRebalanced: completedLog.contactsRebalanced,
        summary: completedLog.aiRecommendation
      };
    } catch (error) {
      logger.error('[ListMaintenanceOrchestrator] Maintenance failed', {
        campaignScheduleId: params.campaignScheduleId,
        error
      });

      return {
        success: false,
        maintenanceLogId: 0,
        contactsSuppressed: 0,
        contactsRebalanced: 0,
        summary: 'Maintenance failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get maintenance logs for a campaign
   */
  async getMaintenanceLogs(campaignScheduleId: number) {
    try {
      return await prisma.listMaintenanceLog.findMany({
        where: { campaignScheduleId },
        orderBy: { executedAt: 'desc' }
      });
    } catch (error) {
      logger.error('[ListMaintenanceOrchestrator] Failed to get maintenance logs', { error });
      throw error;
    }
  }

  /**
   * Get maintenance log by ID
   */
  async getMaintenanceLog(id: number) {
    try {
      return await prisma.listMaintenanceLog.findUnique({
        where: { id },
        include: { list: true }
      });
    } catch (error) {
      logger.error('[ListMaintenanceOrchestrator] Failed to get maintenance log', { error });
      throw error;
    }
  }
}
