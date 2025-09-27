import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TemplateService } from '@/services/templates/template.service';
import { CampaignService } from '@/services/campaign/campaign.service';
import { logger } from '@/utils/logger';

const templates: FastifyPluginAsync = async (fastify) => {
  const prisma = (fastify as any).prisma;
  const cache = (fastify as any).cache;
  const templateService = new TemplateService(prisma, cache);
  const campaignService = new CampaignService(prisma, cache);

  // GET /templates - List all templates
  fastify.get('/', {
    schema: {
      summary: 'List all campaign templates',
      description: 'Retrieve all campaign templates with optional filtering',
      querystring: Type.Object({
        category: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        isPublic: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            templates: Type.Array(Type.Object({
              id: Type.String(),
              name: Type.String(),
              description: Type.Optional(Type.String()),
              category: Type.String(),
              type: Type.String(),
              isPublic: Type.Boolean(),
              templateData: Type.Unknown(),
              createdBy: Type.String(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
              usageCount: Type.Number(),
              _count: Type.Optional(Type.Object({
                campaigns: Type.Number()
              }))
            })),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { category, type, isPublic, search, page = 1, limit = 20 } = request.query as any;

      const filters: any = {};
      if (category) filters.category = category;
      if (type) filters.type = type;
      if (isPublic !== undefined) filters.isPublic = isPublic;
      if (search) filters.search = search;

      const result = await templateService.listTemplates(filters, limit, (page - 1) * limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to list templates', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to list templates'
      });
    }
  });

  // GET /templates/:id - Get template by ID
  fastify.get('/:id', {
    schema: {
      summary: 'Get template by ID',
      description: 'Retrieve a specific campaign template',
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            id: Type.String(),
            name: Type.String(),
            description: Type.Optional(Type.String()),
            category: Type.String(),
            type: Type.String(),
            isPublic: Type.Boolean(),
            templateData: Type.Unknown(),
            createdBy: Type.String(),
            createdAt: Type.String(),
            updatedAt: Type.String(),
            usageCount: Type.Number()
          })
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const template = await templateService.getTemplate(id);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      reply.send({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Failed to get template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get template'
      });
    }
  });

  // POST /templates - Create new template
  fastify.post('/', {
    schema: {
      summary: 'Create new template',
      description: 'Create a new campaign template',
      body: Type.Object({
        name: Type.String(),
        description: Type.Optional(Type.String()),
        category: Type.String(),
        type: Type.String(),
        isPublic: Type.Optional(Type.Boolean()),
        templateData: Type.Object({
          name: Type.String(),
          description: Type.Optional(Type.String()),
          objectives: Type.Optional(Type.Array(Type.String())),
          budget: Type.Optional(Type.Number()),
          startDate: Type.Optional(Type.String()),
          endDate: Type.Optional(Type.String()),
          priority: Type.Optional(Type.String()),
          status: Type.Optional(Type.String()),
          metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          tasks: Type.Optional(Type.Array(Type.Object({
            title: Type.String(),
            description: Type.Optional(Type.String()),
            dueDate: Type.String(),
            priority: Type.String(),
            estimatedHours: Type.Optional(Type.Number()),
            tags: Type.Optional(Type.Array(Type.String())),
            dependencies: Type.Optional(Type.Array(Type.String()))
          }))),
          approvals: Type.Optional(Type.Array(Type.Object({
            stage: Type.String(),
            approverEmail: Type.String(),
            urgency: Type.String(),
            dueDate: Type.Optional(Type.String()),
            autoApprove: Type.Optional(Type.Boolean()),
            escalationEmails: Type.Optional(Type.Array(Type.String()))
          })))
        })
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            id: Type.String(),
            name: Type.String(),
            description: Type.Optional(Type.String()),
            category: Type.String(),
            type: Type.String(),
            isPublic: Type.Boolean(),
            templateData: Type.Unknown(),
            createdBy: Type.String(),
            createdAt: Type.String(),
            updatedAt: Type.String(),
            usageCount: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const templateData = request.body as any;
      const createdBy = request.user?.id || 'system'; // Assuming user context

      const template = await templateService.createTemplate({
        ...templateData,
        createdBy
      });

      reply.status(201).send({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Failed to create template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create template'
      });
    }
  });

  // POST /templates/from-campaign/:campaignId - Create template from campaign
  fastify.post('/from-campaign/:campaignId', {
    schema: {
      summary: 'Create template from campaign',
      description: 'Create a new template based on an existing campaign',
      params: Type.Object({
        campaignId: Type.String()
      }),
      body: Type.Object({
        name: Type.String(),
        description: Type.Optional(Type.String()),
        category: Type.String(),
        isPublic: Type.Optional(Type.Boolean()),
        includeApprovals: Type.Optional(Type.Boolean()),
        includeTasks: Type.Optional(Type.Boolean()),
        includeMetadata: Type.Optional(Type.Boolean())
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            id: Type.String(),
            name: Type.String(),
            category: Type.String(),
            type: Type.String(),
            usageCount: Type.Number()
          })
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { campaignId } = request.params as { campaignId: string };
      const options = request.body as any;
      const createdBy = request.user?.id || 'system';

      // Check if campaign exists
      const campaign = await campaignService.getCampaign(campaignId);
      if (!campaign) {
        return reply.status(404).send({
          success: false,
          error: 'Campaign not found'
        });
      }

      const template = await templateService.createTemplateFromCampaign(
        campaignId,
        {
          name: options.name,
          description: options.description,
          category: options.category,
          isPublic: options.isPublic || false,
          createdBy
        },
        {
          includeApprovals: options.includeApprovals,
          includeTasks: options.includeTasks,
          includeMetadata: options.includeMetadata
        }
      );

      reply.status(201).send({
        success: true,
        data: {
          id: template.id,
          name: template.name,
          category: template.category,
          type: template.type,
          usageCount: template.usageCount
        }
      });
    } catch (error) {
      logger.error('Failed to create template from campaign', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create template from campaign'
      });
    }
  });

  // POST /templates/:id/apply - Apply template to create new campaign
  fastify.post('/:id/apply', {
    schema: {
      summary: 'Apply template to create campaign',
      description: 'Create a new campaign based on a template',
      params: Type.Object({
        id: Type.String()
      }),
      body: Type.Object({
        name: Type.String(),
        description: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        budget: Type.Optional(Type.Number()),
        assigneeEmails: Type.Optional(Type.Array(Type.String())),
        approverEmails: Type.Optional(Type.Array(Type.String())),
        customizations: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        applyTasks: Type.Optional(Type.Boolean()),
        applyApprovals: Type.Optional(Type.Boolean()),
        taskDaysOffset: Type.Optional(Type.Number())
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            campaign: Type.Object({
              id: Type.String(),
              name: Type.String(),
              status: Type.String(),
              createdAt: Type.String()
            }),
            tasksCreated: Type.Number(),
            approvalsCreated: Type.Number()
          })
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const options = request.body as any;
      const createdBy = request.user?.id || 'system';

      const template = await templateService.getTemplate(id);
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      const result = await templateService.applyTemplate(id, {
        name: options.name,
        description: options.description,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
        budget: options.budget,
        createdBy,
        assigneeEmails: options.assigneeEmails || [],
        approverEmails: options.approverEmails || [],
        customizations: options.customizations || {},
        applyTasks: options.applyTasks !== false,
        applyApprovals: options.applyApprovals !== false,
        taskDaysOffset: options.taskDaysOffset || 0
      });

      reply.status(201).send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to apply template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to apply template'
      });
    }
  });

  // POST /campaigns/:id/clone - Clone existing campaign
  fastify.post('/campaigns/:id/clone', {
    schema: {
      summary: 'Clone existing campaign',
      description: 'Create a copy of an existing campaign with modifications',
      params: Type.Object({
        id: Type.String()
      }),
      body: Type.Object({
        name: Type.String(),
        description: Type.Optional(Type.String()),
        startDate: Type.Optional(Type.String()),
        endDate: Type.Optional(Type.String()),
        budget: Type.Optional(Type.Number()),
        assigneeEmails: Type.Optional(Type.Array(Type.String())),
        approverEmails: Type.Optional(Type.Array(Type.String())),
        cloneTasks: Type.Optional(Type.Boolean()),
        cloneApprovals: Type.Optional(Type.Boolean()),
        resetStatus: Type.Optional(Type.Boolean()),
        taskDaysOffset: Type.Optional(Type.Number())
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            campaign: Type.Object({
              id: Type.String(),
              name: Type.String(),
              status: Type.String(),
              createdAt: Type.String()
            }),
            tasksCloned: Type.Number(),
            approvalsCloned: Type.Number()
          })
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const options = request.body as any;
      const createdBy = request.user?.id || 'system';

      // Check if campaign exists
      const campaign = await campaignService.getCampaign(id);
      if (!campaign) {
        return reply.status(404).send({
          success: false,
          error: 'Campaign not found'
        });
      }

      const result = await templateService.cloneCampaign(id, {
        name: options.name,
        description: options.description,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
        budget: options.budget,
        createdBy,
        assigneeEmails: options.assigneeEmails || [],
        approverEmails: options.approverEmails || [],
        cloneTasks: options.cloneTasks !== false,
        cloneApprovals: options.cloneApprovals !== false,
        resetStatus: options.resetStatus !== false,
        taskDaysOffset: options.taskDaysOffset || 0
      });

      reply.status(201).send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to clone campaign', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to clone campaign'
      });
    }
  });

  // PUT /templates/:id - Update template
  fastify.put('/:id', {
    schema: {
      summary: 'Update template',
      description: 'Update an existing campaign template',
      params: Type.Object({
        id: Type.String()
      }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        isPublic: Type.Optional(Type.Boolean()),
        templateData: Type.Optional(Type.Unknown())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            id: Type.String(),
            name: Type.String(),
            category: Type.String(),
            updatedAt: Type.String()
          })
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = request.body as any;

      const template = await templateService.getTemplate(id);
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      const updatedTemplate = await templateService.updateTemplate(id, updates);

      reply.send({
        success: true,
        data: {
          id: updatedTemplate.id,
          name: updatedTemplate.name,
          category: updatedTemplate.category,
          updatedAt: updatedTemplate.updatedAt
        }
      });
    } catch (error) {
      logger.error('Failed to update template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to update template'
      });
    }
  });

  // DELETE /templates/:id - Delete template
  fastify.delete('/:id', {
    schema: {
      summary: 'Delete template',
      description: 'Delete a campaign template',
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const template = await templateService.getTemplate(id);
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      await templateService.deleteTemplate(id);

      reply.send({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to delete template'
      });
    }
  });

  // POST /templates/:id/share - Share template publicly
  fastify.post('/:id/share', {
    schema: {
      summary: 'Share template publicly',
      description: 'Make a template publicly available for all users',
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const template = await templateService.getTemplate(id);
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      await templateService.shareTemplate(id);

      reply.send({
        success: true,
        message: 'Template shared publicly'
      });
    } catch (error) {
      logger.error('Failed to share template', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to share template'
      });
    }
  });

  // GET /templates/categories - Get template categories
  fastify.get('/categories', {
    schema: {
      summary: 'Get template categories',
      description: 'Retrieve all available template categories with counts',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            category: Type.String(),
            count: Type.Number()
          }))
        })
      }
    }
  }, async (request, reply) => {
    try {
      const categories = await templateService.getTemplateCategories();

      reply.send({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Failed to get template categories', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get template categories'
      });
    }
  });
};

export default templates;