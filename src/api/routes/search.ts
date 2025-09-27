import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AdvancedSearchService, SearchFilters, SortOptions } from '@/services/search/advanced-search.service';
import { logger } from '@/utils/logger';

const search: FastifyPluginAsync = async (fastify) => {
  const searchService = new AdvancedSearchService();

  // POST /search/campaigns - Advanced campaign search
  fastify.post('/campaigns', {
    schema: {
      summary: 'Advanced campaign search',
      description: 'Search campaigns with complex filters and sorting',
      body: Type.Object({
        filters: Type.Object({
          query: Type.Optional(Type.String()),
          status: Type.Optional(Type.Array(Type.String())),
          priority: Type.Optional(Type.Array(Type.String())),
          assigneeEmails: Type.Optional(Type.Array(Type.String())),
          tags: Type.Optional(Type.Array(Type.String())),
          createdAfter: Type.Optional(Type.String()),
          createdBefore: Type.Optional(Type.String()),
          budgetMin: Type.Optional(Type.Number()),
          budgetMax: Type.Optional(Type.Number()),
          hasOverdueTasks: Type.Optional(Type.Boolean()),
          hasPendingApprovals: Type.Optional(Type.Boolean()),
          campaignIds: Type.Optional(Type.Array(Type.String())),
          excludeIds: Type.Optional(Type.Array(Type.String()))
        }),
        sort: Type.Optional(Type.Object({
          field: Type.String(),
          direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')])
        })),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            items: Type.Array(Type.Unknown()),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number(),
            facets: Type.Object({
              statuses: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              priorities: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              assignees: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              tags: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              }))
            })
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { filters, sort, page = 1, limit = 20 } = request.body as any;

      // Convert string dates to Date objects
      const processedFilters: SearchFilters = {
        ...filters,
        createdAfter: filters.createdAfter ? new Date(filters.createdAfter) : undefined,
        createdBefore: filters.createdBefore ? new Date(filters.createdBefore) : undefined
      };

      const sortOptions: SortOptions = sort || { field: 'createdAt', direction: 'desc' };

      const result = await searchService.searchCampaigns(processedFilters, sortOptions, page, limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to search campaigns', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to search campaigns'
      });
    }
  });

  // POST /search/tasks - Advanced task search
  fastify.post('/tasks', {
    schema: {
      summary: 'Advanced task search',
      description: 'Search tasks with complex filters and sorting',
      body: Type.Object({
        filters: Type.Object({
          query: Type.Optional(Type.String()),
          status: Type.Optional(Type.Array(Type.String())),
          priority: Type.Optional(Type.Array(Type.String())),
          assigneeEmails: Type.Optional(Type.Array(Type.String())),
          tags: Type.Optional(Type.Array(Type.String())),
          createdAfter: Type.Optional(Type.String()),
          createdBefore: Type.Optional(Type.String()),
          dueAfter: Type.Optional(Type.String()),
          dueBefore: Type.Optional(Type.String()),
          campaignIds: Type.Optional(Type.Array(Type.String())),
          excludeIds: Type.Optional(Type.Array(Type.String()))
        }),
        sort: Type.Optional(Type.Object({
          field: Type.String(),
          direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')])
        })),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            items: Type.Array(Type.Unknown()),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number(),
            facets: Type.Object({
              statuses: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              priorities: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              assignees: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              tags: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              }))
            })
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { filters, sort, page = 1, limit = 20 } = request.body as any;

      // Convert string dates to Date objects
      const processedFilters: SearchFilters = {
        ...filters,
        createdAfter: filters.createdAfter ? new Date(filters.createdAfter) : undefined,
        createdBefore: filters.createdBefore ? new Date(filters.createdBefore) : undefined,
        dueAfter: filters.dueAfter ? new Date(filters.dueAfter) : undefined,
        dueBefore: filters.dueBefore ? new Date(filters.dueBefore) : undefined
      };

      const sortOptions: SortOptions = sort || { field: 'dueDate', direction: 'asc' };

      const result = await searchService.searchTasks(processedFilters, sortOptions, page, limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to search tasks', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to search tasks'
      });
    }
  });

  // POST /search/approvals - Advanced approval search
  fastify.post('/approvals', {
    schema: {
      summary: 'Advanced approval search',
      description: 'Search approvals with complex filters and sorting',
      body: Type.Object({
        filters: Type.Object({
          query: Type.Optional(Type.String()),
          status: Type.Optional(Type.Array(Type.String())),
          assigneeEmails: Type.Optional(Type.Array(Type.String())),
          createdAfter: Type.Optional(Type.String()),
          createdBefore: Type.Optional(Type.String()),
          dueAfter: Type.Optional(Type.String()),
          dueBefore: Type.Optional(Type.String()),
          campaignIds: Type.Optional(Type.Array(Type.String())),
          excludeIds: Type.Optional(Type.Array(Type.String()))
        }),
        sort: Type.Optional(Type.Object({
          field: Type.String(),
          direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')])
        })),
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            items: Type.Array(Type.Unknown()),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number(),
            facets: Type.Object({
              statuses: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              priorities: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              assignees: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              tags: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              }))
            })
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { filters, sort, page = 1, limit = 20 } = request.body as any;

      // Convert string dates to Date objects
      const processedFilters: SearchFilters = {
        ...filters,
        createdAfter: filters.createdAfter ? new Date(filters.createdAfter) : undefined,
        createdBefore: filters.createdBefore ? new Date(filters.createdBefore) : undefined,
        dueAfter: filters.dueAfter ? new Date(filters.dueAfter) : undefined,
        dueBefore: filters.dueBefore ? new Date(filters.dueBefore) : undefined
      };

      const sortOptions: SortOptions = sort || { field: 'dueDate', direction: 'asc' };

      const result = await searchService.searchApprovals(processedFilters, sortOptions, page, limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to search approvals', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to search approvals'
      });
    }
  });

  // GET /search/global - Global search across all entities
  fastify.get('/global', {
    schema: {
      summary: 'Global search',
      description: 'Search across campaigns, tasks, and approvals',
      querystring: Type.Object({
        q: Type.String(),
        types: Type.Optional(Type.String()), // comma-separated: campaign,task,approval
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 10 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            campaigns: Type.Array(Type.Unknown()),
            tasks: Type.Array(Type.Unknown()),
            approvals: Type.Array(Type.Unknown()),
            total: Type.Number()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { q: query, types, limit = 10 } = request.query as any;

      const entityTypes = types ?
        types.split(',').filter((t: string) => ['campaign', 'task', 'approval'].includes(t)) :
        ['campaign', 'task', 'approval'];

      const result = await searchService.globalSearch(query, entityTypes, limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to perform global search', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to perform global search'
      });
    }
  });

  // POST /search/save - Save search for later use
  fastify.post('/save', {
    schema: {
      summary: 'Save search',
      description: 'Save a search configuration for later use',
      body: Type.Object({
        name: Type.String(),
        entityType: Type.Union([
          Type.Literal('campaign'),
          Type.Literal('task'),
          Type.Literal('approval')
        ]),
        filters: Type.Object({
          query: Type.Optional(Type.String()),
          status: Type.Optional(Type.Array(Type.String())),
          priority: Type.Optional(Type.Array(Type.String())),
          assigneeEmails: Type.Optional(Type.Array(Type.String())),
          tags: Type.Optional(Type.Array(Type.String())),
          createdAfter: Type.Optional(Type.String()),
          createdBefore: Type.Optional(Type.String()),
          dueAfter: Type.Optional(Type.String()),
          dueBefore: Type.Optional(Type.String()),
          budgetMin: Type.Optional(Type.Number()),
          budgetMax: Type.Optional(Type.Number()),
          hasOverdueTasks: Type.Optional(Type.Boolean()),
          hasPendingApprovals: Type.Optional(Type.Boolean()),
          campaignIds: Type.Optional(Type.Array(Type.String())),
          excludeIds: Type.Optional(Type.Array(Type.String()))
        }),
        sort: Type.Object({
          field: Type.String(),
          direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')])
        })
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            id: Type.String(),
            name: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { name, entityType, filters, sort } = request.body as any;
      const userId = request.user as string || 'system';

      // Convert string dates to Date objects
      const processedFilters: SearchFilters = {
        ...filters,
        createdAfter: filters.createdAfter ? new Date(filters.createdAfter) : undefined,
        createdBefore: filters.createdBefore ? new Date(filters.createdBefore) : undefined,
        dueAfter: filters.dueAfter ? new Date(filters.dueAfter) : undefined,
        dueBefore: filters.dueBefore ? new Date(filters.dueBefore) : undefined
      };

      const result = await searchService.saveSearch(name, entityType, processedFilters, sort, userId);

      reply.status(201).send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to save search', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to save search'
      });
    }
  });

  // GET /search/saved - Get saved searches
  fastify.get('/saved', {
    schema: {
      summary: 'Get saved searches',
      description: 'Retrieve all saved searches for the current user',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            entityType: Type.String(),
            createdAt: Type.String()
          }))
        })
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user as string || 'system';

      const savedSearches = await searchService.getSavedSearches(userId);

      reply.send({
        success: true,
        data: savedSearches
      });
    } catch (error) {
      logger.error('Failed to get saved searches', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get saved searches'
      });
    }
  });

  // POST /search/saved/:id/execute - Execute saved search
  fastify.post('/saved/:id/execute', {
    schema: {
      summary: 'Execute saved search',
      description: 'Run a previously saved search',
      params: Type.Object({
        id: Type.String()
      }),
      body: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 }))
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            items: Type.Array(Type.Unknown()),
            total: Type.Number(),
            page: Type.Number(),
            pages: Type.Number(),
            facets: Type.Object({
              statuses: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              priorities: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              assignees: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              })),
              tags: Type.Array(Type.Object({
                value: Type.String(),
                count: Type.Number()
              }))
            })
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
      const { page = 1, limit = 20 } = request.body as any;

      const result = await searchService.executeSavedSearch(id, page, limit);

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Saved search not found') {
        return reply.status(404).send({
          success: false,
          error: 'Saved search not found'
        });
      }

      logger.error('Failed to execute saved search', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to execute saved search'
      });
    }
  });
};

export default search;