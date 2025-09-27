import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '@/api/server';
import { TemplateService } from '@/services/templates/template.service';
import { CampaignService } from '@/services/campaign.service';

// Mock services
vi.mock('@/services/templates/template.service');
vi.mock('@/services/campaign.service');

const mockTemplateService = {
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  createTemplateFromCampaign: vi.fn(),
  applyTemplate: vi.fn(),
  cloneCampaign: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  shareTemplate: vi.fn(),
  getTemplateCategories: vi.fn()
};

const mockCampaignService = {
  getCampaign: vi.fn()
};

describe('Templates API Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    (TemplateService as any).mockImplementation(() => mockTemplateService);
    (CampaignService as any).mockImplementation(() => mockCampaignService);

    server = await buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.resetAllMocks();
  });

  describe('GET /api/v1/templates', () => {
    it('should list templates with default pagination', async () => {
      const mockTemplates = {
        templates: [
          {
            id: 'template-1',
            name: 'Marketing Template',
            category: 'marketing',
            type: 'email',
            isPublic: true,
            usageCount: 5
          }
        ],
        total: 1,
        page: 1,
        pages: 1
      };

      mockTemplateService.listTemplates.mockResolvedValue(mockTemplates);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockTemplates
      });

      expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20 }
      );
    });

    it('should list templates with filters', async () => {
      mockTemplateService.listTemplates.mockResolvedValue({
        templates: [],
        total: 0,
        page: 1,
        pages: 0
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates?category=marketing&type=email&isPublic=true&search=campaign&page=2&limit=10'
      });

      expect(response.statusCode).toBe(200);
      expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(
        {
          category: 'marketing',
          type: 'email',
          isPublic: true,
          search: 'campaign'
        },
        { page: 2, limit: 10 }
      );
    });

    it('should handle service errors', async () => {
      mockTemplateService.listTemplates.mockRejectedValue(new Error('Database error'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates'
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Failed to list templates'
      });
    });
  });

  describe('GET /api/v1/templates/:id', () => {
    it('should get template by ID', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Test Template',
        category: 'marketing',
        type: 'email',
        usageCount: 3
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates/template-1'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockTemplate
      });

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should return 404 for non-existent template', async () => {
      mockTemplateService.getTemplate.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates/nonexistent'
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Template not found'
      });
    });
  });

  describe('POST /api/v1/templates', () => {
    it('should create new template', async () => {
      const templateData = {
        name: 'New Template',
        description: 'Template description',
        category: 'marketing',
        type: 'email',
        isPublic: false,
        templateData: {
          name: 'Campaign Template',
          objectives: ['Increase awareness'],
          budget: 10000
        }
      };

      const mockCreatedTemplate = {
        id: 'template-1',
        ...templateData,
        createdBy: 'system',
        usageCount: 0
      };

      mockTemplateService.createTemplate.mockResolvedValue(mockCreatedTemplate);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/templates',
        payload: templateData
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockCreatedTemplate
      });

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith({
        ...templateData,
        createdBy: 'system'
      });
    });

    it('should handle creation errors', async () => {
      mockTemplateService.createTemplate.mockRejectedValue(new Error('Validation error'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/templates',
        payload: {
          name: 'Test Template',
          category: 'marketing',
          type: 'email',
          templateData: {}
        }
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Failed to create template'
      });
    });
  });

  describe('POST /api/v1/templates/from-campaign/:campaignId', () => {
    it('should create template from existing campaign', async () => {
      const campaignId = 'campaign-1';
      const templateConfig = {
        name: 'Template from Campaign',
        description: 'Generated template',
        category: 'marketing',
        isPublic: false,
        includeApprovals: true,
        includeTasks: true,
        includeMetadata: true
      };

      const mockCampaign = {
        id: campaignId,
        name: 'Original Campaign'
      };

      const mockCreatedTemplate = {
        id: 'template-1',
        name: templateConfig.name,
        category: templateConfig.category,
        type: 'campaign',
        usageCount: 0
      };

      mockCampaignService.getCampaign.mockResolvedValue(mockCampaign);
      mockTemplateService.createTemplateFromCampaign.mockResolvedValue(mockCreatedTemplate);

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/templates/from-campaign/${campaignId}`,
        payload: templateConfig
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: {
          id: 'template-1',
          name: templateConfig.name,
          category: templateConfig.category,
          type: 'campaign',
          usageCount: 0
        }
      });

      expect(mockCampaignService.getCampaign).toHaveBeenCalledWith(campaignId);
      expect(mockTemplateService.createTemplateFromCampaign).toHaveBeenCalledWith(
        campaignId,
        expect.objectContaining({
          name: templateConfig.name,
          category: templateConfig.category,
          createdBy: 'system'
        }),
        {
          includeApprovals: true,
          includeTasks: true,
          includeMetadata: true
        }
      );
    });

    it('should return 404 for non-existent campaign', async () => {
      mockCampaignService.getCampaign.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/templates/from-campaign/nonexistent',
        payload: {
          name: 'Template',
          category: 'marketing'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Campaign not found'
      });
    });
  });

  describe('POST /api/v1/templates/:id/apply', () => {
    it('should apply template to create new campaign', async () => {
      const templateId = 'template-1';
      const options = {
        name: 'New Campaign from Template',
        description: 'Applied from template',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T00:00:00.000Z',
        budget: 15000,
        assigneeEmails: ['assignee@example.com'],
        approverEmails: ['approver@example.com'],
        customizations: { customKey: 'customValue' },
        applyTasks: true,
        applyApprovals: true,
        taskDaysOffset: 7
      };

      const mockTemplate = {
        id: templateId,
        name: 'Template'
      };

      const mockResult = {
        campaign: {
          id: 'campaign-1',
          name: options.name,
          status: 'draft',
          createdAt: new Date()
        },
        tasksCreated: 3,
        approvalsCreated: 2
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.applyTemplate.mockResolvedValue(mockResult);

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/templates/${templateId}/apply`,
        payload: options
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockResult
      });

      expect(mockTemplateService.applyTemplate).toHaveBeenCalledWith(
        templateId,
        expect.objectContaining({
          name: options.name,
          startDate: new Date(options.startDate),
          endDate: new Date(options.endDate),
          budget: options.budget,
          createdBy: 'system',
          taskDaysOffset: 7
        })
      );
    });

    it('should return 404 for non-existent template', async () => {
      mockTemplateService.getTemplate.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/templates/nonexistent/apply',
        payload: {
          name: 'New Campaign'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Template not found'
      });
    });
  });

  describe('POST /api/v1/templates/campaigns/:id/clone', () => {
    it('should clone existing campaign', async () => {
      const campaignId = 'campaign-1';
      const options = {
        name: 'Cloned Campaign',
        description: 'Cloned from original',
        startDate: '2024-02-01T00:00:00.000Z',
        endDate: '2024-12-31T00:00:00.000Z',
        budget: 8000,
        assigneeEmails: ['new-assignee@example.com'],
        approverEmails: ['new-approver@example.com'],
        cloneTasks: true,
        cloneApprovals: true,
        resetStatus: true,
        taskDaysOffset: 14
      };

      const mockCampaign = {
        id: campaignId,
        name: 'Original Campaign'
      };

      const mockResult = {
        campaign: {
          id: 'campaign-2',
          name: options.name,
          status: 'draft',
          createdAt: new Date()
        },
        tasksCloned: 5,
        approvalsCloned: 2
      };

      mockCampaignService.getCampaign.mockResolvedValue(mockCampaign);
      mockTemplateService.cloneCampaign.mockResolvedValue(mockResult);

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/templates/campaigns/${campaignId}/clone`,
        payload: options
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockResult
      });

      expect(mockTemplateService.cloneCampaign).toHaveBeenCalledWith(
        campaignId,
        expect.objectContaining({
          name: options.name,
          startDate: new Date(options.startDate),
          endDate: new Date(options.endDate),
          createdBy: 'system',
          taskDaysOffset: 14
        })
      );
    });

    it('should return 404 for non-existent campaign', async () => {
      mockCampaignService.getCampaign.mockResolvedValue(null);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/templates/campaigns/nonexistent/clone',
        payload: {
          name: 'Cloned Campaign'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Campaign not found'
      });
    });
  });

  describe('PUT /api/v1/templates/:id', () => {
    it('should update existing template', async () => {
      const templateId = 'template-1';
      const updates = {
        name: 'Updated Template',
        description: 'Updated description',
        isPublic: true
      };

      const mockExistingTemplate = {
        id: templateId,
        name: 'Old Template'
      };

      const mockUpdatedTemplate = {
        id: templateId,
        name: 'Updated Template',
        category: 'marketing',
        updatedAt: new Date()
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockExistingTemplate);
      mockTemplateService.updateTemplate.mockResolvedValue(mockUpdatedTemplate);

      const response = await server.inject({
        method: 'PUT',
        url: `/api/v1/templates/${templateId}`,
        payload: updates
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: {
          id: templateId,
          name: 'Updated Template',
          category: 'marketing',
          updatedAt: mockUpdatedTemplate.updatedAt.toISOString()
        }
      });

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(templateId, updates);
    });

    it('should return 404 for non-existent template', async () => {
      mockTemplateService.getTemplate.mockResolvedValue(null);

      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/templates/nonexistent',
        payload: {
          name: 'Updated Template'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Template not found'
      });
    });
  });

  describe('DELETE /api/v1/templates/:id', () => {
    it('should delete existing template', async () => {
      const templateId = 'template-1';

      const mockTemplate = {
        id: templateId,
        name: 'Template to Delete'
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.deleteTemplate.mockResolvedValue(true);

      const response = await server.inject({
        method: 'DELETE',
        url: `/api/v1/templates/${templateId}`
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        message: 'Template deleted successfully'
      });

      expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith(templateId);
    });

    it('should return 404 for non-existent template', async () => {
      mockTemplateService.getTemplate.mockResolvedValue(null);

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/templates/nonexistent'
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Template not found'
      });
    });
  });

  describe('POST /api/v1/templates/:id/share', () => {
    it('should share template publicly', async () => {
      const templateId = 'template-1';

      const mockTemplate = {
        id: templateId,
        name: 'Template to Share'
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.shareTemplate.mockResolvedValue(true);

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/templates/${templateId}/share`
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        message: 'Template shared publicly'
      });

      expect(mockTemplateService.shareTemplate).toHaveBeenCalledWith(templateId);
    });
  });

  describe('GET /api/v1/templates/categories', () => {
    it('should get template categories with counts', async () => {
      const mockCategories = [
        { category: 'marketing', count: 15 },
        { category: 'sales', count: 8 },
        { category: 'support', count: 3 }
      ];

      mockTemplateService.getTemplateCategories.mockResolvedValue(mockCategories);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates/categories'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: mockCategories
      });

      expect(mockTemplateService.getTemplateCategories).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockTemplateService.getTemplateCategories.mockRejectedValue(new Error('Database error'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/templates/categories'
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Failed to get template categories'
      });
    });
  });
});