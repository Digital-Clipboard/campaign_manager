import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BulkOperationsService, BulkCampaignUpdate, BulkTaskUpdate, BulkApprovalUpdate } from '@/services/bulk/bulk-operations.service';
import { logger } from '@/utils/logger';

const bulk: FastifyPluginAsync = async (fastify) => {
  const bulkService = new BulkOperationsService();

  // POST /bulk/campaigns/update - Bulk update campaigns
  fastify.post('/campaigns/update', {
    schema: {
      summary: 'Bulk update campaigns',
      description: 'Update multiple campaigns with the same changes',
      body: Type.Object({
        campaignIds: Type.Array(Type.String()),
        updates: Type.Object({
          status: Type.Optional(Type.String()),
          priority: Type.Optional(Type.String()),
          budget: Type.Optional(Type.Number()),
          endDate: Type.Optional(Type.String()),
          assigneeEmail: Type.Optional(Type.String()),
          tags: Type.Optional(Type.Array(Type.String()))
        }),
        notifyTeam: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { campaignIds, updates, notifyTeam = true } = request.body as any;
      const updatedBy = request.user as string || 'system';

      // Convert string dates to Date objects
      const processedUpdates: BulkCampaignUpdate = {
        ...updates,
        endDate: updates.endDate ? new Date(updates.endDate) : undefined
      };

      const result = await bulkService.bulkUpdateCampaigns(
        campaignIds,
        processedUpdates,
        updatedBy,
        notifyTeam
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk update campaigns', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk update campaigns'
      });
    }
  });

  // POST /bulk/campaigns/delete - Bulk delete campaigns
  fastify.post('/campaigns/delete', {
    schema: {
      summary: 'Bulk delete campaigns',
      description: 'Delete multiple campaigns',
      body: Type.Object({
        campaignIds: Type.Array(Type.String()),
        notifyTeam: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { campaignIds, notifyTeam = true } = request.body as any;
      const deletedBy = request.user as string || 'system';

      const result = await bulkService.bulkDeleteCampaigns(campaignIds, deletedBy, notifyTeam);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk delete campaigns', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk delete campaigns'
      });
    }
  });

  // POST /bulk/tasks/update - Bulk update tasks
  fastify.post('/tasks/update', {
    schema: {
      summary: 'Bulk update tasks',
      description: 'Update multiple tasks with the same changes',
      body: Type.Object({
        taskIds: Type.Array(Type.String()),
        updates: Type.Object({
          status: Type.Optional(Type.String()),
          priority: Type.Optional(Type.String()),
          assigneeEmail: Type.Optional(Type.String()),
          dueDate: Type.Optional(Type.String()),
          estimatedHours: Type.Optional(Type.Number()),
          tags: Type.Optional(Type.Array(Type.String()))
        }),
        notifyAssignees: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { taskIds, updates, notifyAssignees = true } = request.body as any;
      const updatedBy = request.user as string || 'system';

      // Convert string dates to Date objects
      const processedUpdates: BulkTaskUpdate = {
        ...updates,
        dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined
      };

      const result = await bulkService.bulkUpdateTasks(
        taskIds,
        processedUpdates,
        updatedBy,
        notifyAssignees
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk update tasks', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk update tasks'
      });
    }
  });

  // POST /bulk/tasks/delete - Bulk delete tasks
  fastify.post('/tasks/delete', {
    schema: {
      summary: 'Bulk delete tasks',
      description: 'Delete multiple tasks',
      body: Type.Object({
        taskIds: Type.Array(Type.String()),
        notifyAssignees: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { taskIds, notifyAssignees = true } = request.body as any;
      const deletedBy = request.user as string || 'system';

      const result = await bulkService.bulkDeleteTasks(taskIds, deletedBy, notifyAssignees);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk delete tasks', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk delete tasks'
      });
    }
  });

  // POST /bulk/approvals/update - Bulk update approvals
  fastify.post('/approvals/update', {
    schema: {
      summary: 'Bulk update approvals',
      description: 'Update multiple approvals with the same changes',
      body: Type.Object({
        approvalIds: Type.Array(Type.String()),
        updates: Type.Object({
          status: Type.Optional(Type.String()),
          urgency: Type.Optional(Type.String()),
          approverEmail: Type.Optional(Type.String()),
          dueDate: Type.Optional(Type.String())
        }),
        notifyApprovers: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { approvalIds, updates, notifyApprovers = true } = request.body as any;
      const updatedBy = request.user as string || 'system';

      // Convert string dates to Date objects
      const processedUpdates: BulkApprovalUpdate = {
        ...updates,
        dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined
      };

      const result = await bulkService.bulkUpdateApprovals(
        approvalIds,
        processedUpdates,
        updatedBy,
        notifyApprovers
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk update approvals', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk update approvals'
      });
    }
  });

  // POST /bulk/status-change - Bulk status change
  fastify.post('/status-change', {
    schema: {
      summary: 'Bulk status change',
      description: 'Change status for multiple items of the same type',
      body: Type.Object({
        entityType: Type.Union([
          Type.Literal('campaign'),
          Type.Literal('task'),
          Type.Literal('approval')
        ]),
        entityIds: Type.Array(Type.String()),
        newStatus: Type.String(),
        reason: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType, entityIds, newStatus, reason } = request.body as any;
      const updatedBy = request.user as string || 'system';

      const result = await bulkService.bulkChangeStatus(
        entityType,
        entityIds,
        newStatus,
        updatedBy,
        reason
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk change status', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk change status'
      });
    }
  });

  // POST /bulk/assign - Bulk assignment
  fastify.post('/assign', {
    schema: {
      summary: 'Bulk assignment',
      description: 'Assign multiple items to a single person',
      body: Type.Object({
        entityType: Type.Union([
          Type.Literal('campaign'),
          Type.Literal('task'),
          Type.Literal('approval')
        ]),
        entityIds: Type.Array(Type.String()),
        assigneeEmail: Type.String(),
        notifyAssignee: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType, entityIds, assigneeEmail, notifyAssignee = true } = request.body as any;
      const assignedBy = request.user as string || 'system';

      const result = await bulkService.bulkAssignItems(
        entityType,
        entityIds,
        assigneeEmail,
        assignedBy,
        notifyAssignee
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk assign items', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk assign items'
      });
    }
  });

  // POST /bulk/tags/add - Bulk add tags
  fastify.post('/tags/add', {
    schema: {
      summary: 'Bulk add tags',
      description: 'Add tags to multiple items',
      body: Type.Object({
        entityType: Type.Union([
          Type.Literal('campaign'),
          Type.Literal('task')
        ]),
        entityIds: Type.Array(Type.String()),
        tagsToAdd: Type.Array(Type.String())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType, entityIds, tagsToAdd } = request.body as any;
      const updatedBy = request.user as string || 'system';

      const result = await bulkService.bulkAddTags(entityType, entityIds, tagsToAdd, updatedBy);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk add tags', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk add tags'
      });
    }
  });

  // POST /bulk/tags/remove - Bulk remove tags
  fastify.post('/tags/remove', {
    schema: {
      summary: 'Bulk remove tags',
      description: 'Remove tags from multiple items',
      body: Type.Object({
        entityType: Type.Union([
          Type.Literal('campaign'),
          Type.Literal('task')
        ]),
        entityIds: Type.Array(Type.String()),
        tagsToRemove: Type.Array(Type.String())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            success: Type.Number(),
            failed: Type.Number(),
            total: Type.Number(),
            errors: Type.Array(Type.Object({
              id: Type.String(),
              error: Type.String()
            })),
            successIds: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { entityType, entityIds, tagsToRemove } = request.body as any;
      const updatedBy = request.user as string || 'system';

      const result = await bulkService.bulkRemoveTags(entityType, entityIds, tagsToRemove, updatedBy);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to bulk remove tags', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to bulk remove tags'
      });
    }
  });
};

export default bulk;