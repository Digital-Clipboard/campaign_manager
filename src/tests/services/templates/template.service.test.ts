import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TemplateService } from '@/services/templates/template.service';
import { CampaignService } from '@/services/campaign.service';
import { TaskService } from '@/services/task.service';
import { ApprovalService } from '@/services/approval.service';

// Mock Prisma
vi.mock('@prisma/client');
vi.mock('@/services/campaign.service');
vi.mock('@/services/task.service');
vi.mock('@/services/approval.service');

const mockPrisma = {
  campaignTemplate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn()
  },
  campaign: {
    findUnique: vi.fn(),
    create: vi.fn()
  },
  task: {
    findMany: vi.fn(),
    create: vi.fn()
  },
  approval: {
    findMany: vi.fn(),
    create: vi.fn()
  }
};

const mockCampaignService = {
  getCampaign: vi.fn(),
  createCampaign: vi.fn()
};

const mockTaskService = {
  createTask: vi.fn()
};

const mockApprovalService = {
  createApproval: vi.fn()
};

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    (PrismaClient as any).mockImplementation(() => mockPrisma);
    (CampaignService as any).mockImplementation(() => mockCampaignService);
    (TaskService as any).mockImplementation(() => mockTaskService);
    (ApprovalService as any).mockImplementation(() => mockApprovalService);

    templateService = new TemplateService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'Test description',
        category: 'marketing',
        type: 'email',
        isPublic: false,
        createdBy: 'user1',
        templateData: {
          name: 'Campaign Template',
          description: 'Template campaign',
          objectives: ['Increase awareness'],
          budget: 10000
        }
      };

      const mockTemplate = {
        id: 'template-1',
        ...templateData,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };

      mockPrisma.campaignTemplate.create.mockResolvedValue(mockTemplate);

      const result = await templateService.createTemplate(templateData);

      expect(mockPrisma.campaignTemplate.create).toHaveBeenCalledWith({
        data: {
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          type: templateData.type,
          isPublic: templateData.isPublic,
          templateData: JSON.stringify(templateData.templateData),
          createdBy: templateData.createdBy,
          usageCount: 0,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      });

      expect(result).toEqual(mockTemplate);
    });

    it('should throw error on creation failure', async () => {
      const templateData = {
        name: 'Test Template',
        category: 'marketing',
        type: 'email',
        createdBy: 'user1',
        templateData: {}
      };

      mockPrisma.campaignTemplate.create.mockRejectedValue(new Error('Database error'));

      await expect(templateService.createTemplate(templateData)).rejects.toThrow('Database error');
    });
  });

  describe('createTemplateFromCampaign', () => {
    it('should create template from existing campaign', async () => {
      const campaignId = 'campaign-1';
      const templateConfig = {
        name: 'Template from Campaign',
        description: 'Generated template',
        category: 'marketing',
        isPublic: false,
        createdBy: 'user1'
      };

      const mockCampaign = {
        id: campaignId,
        name: 'Original Campaign',
        description: 'Original description',
        objectives: ['objective1'],
        budget: 5000,
        priority: 'high',
        status: 'active',
        metadata: { key: 'value' }
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Task description',
          priority: 'medium',
          dueDate: new Date('2024-12-31'),
          estimatedHours: 8,
          tags: ['tag1']
        }
      ];

      const mockApprovals = [
        {
          id: 'approval-1',
          stage: 'Review',
          urgency: 'normal',
          approverEmail: 'approver@example.com',
          dueDate: new Date('2024-12-25')
        }
      ];

      const mockTemplate = {
        id: 'template-1',
        ...templateConfig,
        type: 'campaign',
        templateData: JSON.stringify({
          name: mockCampaign.name,
          description: mockCampaign.description,
          objectives: mockCampaign.objectives,
          budget: mockCampaign.budget,
          priority: mockCampaign.priority,
          metadata: mockCampaign.metadata,
          tasks: mockTasks.map(task => ({
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate.toISOString(),
            estimatedHours: task.estimatedHours,
            tags: task.tags
          })),
          approvals: mockApprovals.map(approval => ({
            stage: approval.stage,
            urgency: approval.urgency,
            approverEmail: approval.approverEmail,
            dueDate: approval.dueDate?.toISOString()
          }))
        }),
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCampaignService.getCampaign.mockResolvedValue(mockCampaign);
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
      mockPrisma.approval.findMany.mockResolvedValue(mockApprovals);
      mockPrisma.campaignTemplate.create.mockResolvedValue(mockTemplate);

      const result = await templateService.createTemplateFromCampaign(
        campaignId,
        templateConfig
      );

      expect(mockCampaignService.getCampaign).toHaveBeenCalledWith(campaignId);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { campaignId }
      });
      expect(mockPrisma.approval.findMany).toHaveBeenCalledWith({
        where: { campaignId }
      });
      expect(mockPrisma.campaignTemplate.create).toHaveBeenCalled();
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error if campaign not found', async () => {
      const campaignId = 'nonexistent-campaign';
      const templateConfig = {
        name: 'Template',
        category: 'marketing',
        createdBy: 'user1'
      };

      mockCampaignService.getCampaign.mockResolvedValue(null);

      await expect(
        templateService.createTemplateFromCampaign(campaignId, templateConfig)
      ).rejects.toThrow('Campaign not found');
    });
  });

  describe('applyTemplate', () => {
    it('should create campaign from template', async () => {
      const templateId = 'template-1';
      const options = {
        name: 'New Campaign from Template',
        description: 'Applied from template',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        budget: 15000,
        createdBy: 'user1',
        assigneeEmails: ['assignee@example.com'],
        approverEmails: ['approver@example.com'],
        customizations: { customKey: 'customValue' },
        applyTasks: true,
        applyApprovals: true,
        taskDaysOffset: 7
      };

      const mockTemplate = {
        id: templateId,
        name: 'Template',
        templateData: JSON.stringify({
          name: 'Template Campaign',
          description: 'Template description',
          objectives: ['objective1'],
          budget: 10000,
          priority: 'medium',
          tasks: [
            {
              title: 'Template Task',
              description: 'Task from template',
              dueDate: '2024-06-01T00:00:00.000Z',
              priority: 'high',
              estimatedHours: 4,
              tags: ['template']
            }
          ],
          approvals: [
            {
              stage: 'Review',
              urgency: 'normal',
              approverEmail: 'template-approver@example.com',
              dueDate: '2024-05-30T00:00:00.000Z'
            }
          ]
        }),
        usageCount: 0
      };

      const mockCampaign = {
        id: 'campaign-1',
        name: options.name,
        description: options.description,
        status: 'draft'
      };

      const mockTask = {
        id: 'task-1',
        title: 'Template Task',
        campaignId: mockCampaign.id
      };

      const mockApproval = {
        id: 'approval-1',
        stage: 'Review',
        campaignId: mockCampaign.id
      };

      mockPrisma.campaignTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockCampaignService.createCampaign.mockResolvedValue(mockCampaign);
      mockTaskService.createTask.mockResolvedValue(mockTask);
      mockApprovalService.createApproval.mockResolvedValue(mockApproval);
      mockPrisma.campaignTemplate.update.mockResolvedValue({
        ...mockTemplate,
        usageCount: 1
      });

      const result = await templateService.applyTemplate(templateId, options);

      expect(mockPrisma.campaignTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: templateId }
      });
      expect(mockCampaignService.createCampaign).toHaveBeenCalled();
      expect(mockTaskService.createTask).toHaveBeenCalled();
      expect(mockApprovalService.createApproval).toHaveBeenCalled();
      expect(mockPrisma.campaignTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { usageCount: 1 }
      });

      expect(result).toEqual({
        campaign: mockCampaign,
        tasksCreated: 1,
        approvalsCreated: 1
      });
    });

    it('should throw error if template not found', async () => {
      const templateId = 'nonexistent-template';
      const options = {
        name: 'New Campaign',
        createdBy: 'user1'
      };

      mockPrisma.campaignTemplate.findUnique.mockResolvedValue(null);

      await expect(
        templateService.applyTemplate(templateId, options)
      ).rejects.toThrow('Template not found');
    });
  });

  describe('cloneCampaign', () => {
    it('should clone existing campaign', async () => {
      const campaignId = 'campaign-1';
      const options = {
        name: 'Cloned Campaign',
        description: 'Cloned from original',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-12-31'),
        budget: 8000,
        createdBy: 'user1',
        assigneeEmails: ['new-assignee@example.com'],
        approverEmails: ['new-approver@example.com'],
        cloneTasks: true,
        cloneApprovals: true,
        resetStatus: true,
        taskDaysOffset: 14
      };

      const mockOriginalCampaign = {
        id: campaignId,
        name: 'Original Campaign',
        description: 'Original description',
        objectives: ['original objective'],
        budget: 5000,
        priority: 'high',
        status: 'completed',
        metadata: { original: true }
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Original Task',
          description: 'Original task description',
          priority: 'medium',
          dueDate: new Date('2024-01-15'),
          estimatedHours: 6,
          tags: ['original'],
          status: 'completed'
        }
      ];

      const mockApprovals = [
        {
          id: 'approval-1',
          stage: 'Final Review',
          urgency: 'high',
          approverEmail: 'original-approver@example.com',
          dueDate: new Date('2024-01-10'),
          status: 'approved'
        }
      ];

      const mockClonedCampaign = {
        id: 'campaign-2',
        name: options.name,
        description: options.description,
        status: 'draft'
      };

      const mockClonedTask = {
        id: 'task-2',
        title: 'Original Task',
        campaignId: mockClonedCampaign.id,
        status: 'pending'
      };

      const mockClonedApproval = {
        id: 'approval-2',
        stage: 'Final Review',
        campaignId: mockClonedCampaign.id,
        status: 'pending'
      };

      mockCampaignService.getCampaign.mockResolvedValue(mockOriginalCampaign);
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
      mockPrisma.approval.findMany.mockResolvedValue(mockApprovals);
      mockCampaignService.createCampaign.mockResolvedValue(mockClonedCampaign);
      mockTaskService.createTask.mockResolvedValue(mockClonedTask);
      mockApprovalService.createApproval.mockResolvedValue(mockClonedApproval);

      const result = await templateService.cloneCampaign(campaignId, options);

      expect(mockCampaignService.getCampaign).toHaveBeenCalledWith(campaignId);
      expect(mockCampaignService.createCampaign).toHaveBeenCalled();
      expect(mockTaskService.createTask).toHaveBeenCalled();
      expect(mockApprovalService.createApproval).toHaveBeenCalled();

      expect(result).toEqual({
        campaign: mockClonedCampaign,
        tasksCloned: 1,
        approvalsCloned: 1
      });
    });

    it('should throw error if original campaign not found', async () => {
      const campaignId = 'nonexistent-campaign';
      const options = {
        name: 'Cloned Campaign',
        createdBy: 'user1'
      };

      mockCampaignService.getCampaign.mockResolvedValue(null);

      await expect(
        templateService.cloneCampaign(campaignId, options)
      ).rejects.toThrow('Campaign not found');
    });
  });

  describe('getTemplate', () => {
    it('should retrieve template by id', async () => {
      const templateId = 'template-1';
      const mockTemplate = {
        id: templateId,
        name: 'Test Template',
        category: 'marketing',
        templateData: '{"name":"Template Campaign"}',
        usageCount: 5
      };

      mockPrisma.campaignTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplate(templateId);

      expect(mockPrisma.campaignTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: templateId }
      });
      expect(result).toEqual({
        ...mockTemplate,
        templateData: { name: 'Template Campaign' }
      });
    });

    it('should return null if template not found', async () => {
      const templateId = 'nonexistent-template';

      mockPrisma.campaignTemplate.findUnique.mockResolvedValue(null);

      const result = await templateService.getTemplate(templateId);

      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should list templates with filters and pagination', async () => {
      const filters = {
        category: 'marketing',
        isPublic: true,
        search: 'email'
      };
      const pagination = { page: 1, limit: 10 };

      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Email Template',
          category: 'marketing',
          isPublic: true,
          templateData: '{"name":"Email Campaign"}',
          usageCount: 3,
          _count: { campaigns: 5 }
        }
      ];

      mockPrisma.campaignTemplate.findMany.mockResolvedValue(mockTemplates);
      mockPrisma.campaignTemplate.count = vi.fn().mockResolvedValue(1);

      const result = await templateService.listTemplates(filters, pagination);

      expect(mockPrisma.campaignTemplate.findMany).toHaveBeenCalled();
      expect(result).toEqual({
        templates: mockTemplates.map(t => ({
          ...t,
          templateData: { name: 'Email Campaign' }
        })),
        total: 1,
        page: 1,
        pages: 1
      });
    });
  });

  describe('getTemplateCategories', () => {
    it('should return template categories with counts', async () => {
      const mockCategories = [
        { category: 'marketing', _count: { category: 5 } },
        { category: 'sales', _count: { category: 3 } }
      ];

      mockPrisma.campaignTemplate.groupBy.mockResolvedValue(mockCategories);

      const result = await templateService.getTemplateCategories();

      expect(mockPrisma.campaignTemplate.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } }
      });
      expect(result).toEqual([
        { category: 'marketing', count: 5 },
        { category: 'sales', count: 3 }
      ]);
    });
  });
});