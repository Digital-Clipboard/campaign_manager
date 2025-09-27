import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BulkOperationsService } from '@/services/bulk/bulk-operations.service';
import { NotificationService } from '@/services/notification.service';
import { CampaignService } from '@/services/campaign.service';
import { TaskService } from '@/services/task.service';
import { ApprovalService } from '@/services/approval.service';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('@/services/notification.service');
vi.mock('@/services/campaign.service');
vi.mock('@/services/task.service');
vi.mock('@/services/approval.service');

const mockPrisma = {
  campaign: {
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn()
  },
  task: {
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn()
  },
  approval: {
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn()
  }
};

const mockNotificationService = {
  createNotification: vi.fn()
};

const mockCampaignService = {
  getCampaign: vi.fn()
};

const mockTaskService = {
  getTask: vi.fn()
};

const mockApprovalService = {
  getApproval: vi.fn()
};

describe('BulkOperationsService', () => {
  let bulkService: BulkOperationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    (PrismaClient as any).mockImplementation(() => mockPrisma);
    (NotificationService as any).mockImplementation(() => mockNotificationService);
    (CampaignService as any).mockImplementation(() => mockCampaignService);
    (TaskService as any).mockImplementation(() => mockTaskService);
    (ApprovalService as any).mockImplementation(() => mockApprovalService);

    bulkService = new BulkOperationsService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('bulkUpdateCampaigns', () => {
    it('should successfully update multiple campaigns', async () => {
      const campaignIds = ['campaign-1', 'campaign-2', 'campaign-3'];
      const updates = {
        status: 'active',
        priority: 'high',
        budget: 10000
      };
      const updatedBy = 'user1';

      const mockCampaigns = campaignIds.map((id, index) => ({
        id,
        name: `Campaign ${index + 1}`,
        assigneeEmail: `assignee${index + 1}@example.com`
      }));

      mockCampaignService.getCampaign
        .mockResolvedValueOnce(mockCampaigns[0])
        .mockResolvedValueOnce(mockCampaigns[1])
        .mockResolvedValueOnce(mockCampaigns[2]);

      mockPrisma.campaign.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      mockNotificationService.createNotification
        .mockResolvedValue({})
        .mockResolvedValue({})
        .mockResolvedValue({});

      const result = await bulkService.bulkUpdateCampaigns(
        campaignIds,
        updates,
        updatedBy,
        true
      );

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.successIds).toEqual(campaignIds);

      expect(mockCampaignService.getCampaign).toHaveBeenCalledTimes(3);
      expect(mockPrisma.campaign.update).toHaveBeenCalledTimes(3);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle failures gracefully', async () => {
      const campaignIds = ['campaign-1', 'campaign-2', 'nonexistent'];
      const updates = { status: 'active' };
      const updatedBy = 'user1';

      mockCampaignService.getCampaign
        .mockResolvedValueOnce({ id: 'campaign-1', name: 'Campaign 1' })
        .mockResolvedValueOnce({ id: 'campaign-2', name: 'Campaign 2' })
        .mockResolvedValueOnce(null); // Campaign not found

      mockPrisma.campaign.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkUpdateCampaigns(
        campaignIds,
        updates,
        updatedBy,
        false
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        id: 'nonexistent',
        error: 'Campaign not found'
      });
      expect(result.successIds).toEqual(['campaign-1', 'campaign-2']);
    });

    it('should handle database errors', async () => {
      const campaignIds = ['campaign-1'];
      const updates = { status: 'active' };
      const updatedBy = 'user1';

      mockCampaignService.getCampaign.mockResolvedValue({
        id: 'campaign-1',
        name: 'Campaign 1'
      });

      mockPrisma.campaign.update.mockRejectedValue(new Error('Database connection failed'));

      const result = await bulkService.bulkUpdateCampaigns(
        campaignIds,
        updates,
        updatedBy,
        false
      );

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual({
        id: 'campaign-1',
        error: 'Database connection failed'
      });
    });
  });

  describe('bulkDeleteCampaigns', () => {
    it('should successfully delete multiple campaigns', async () => {
      const campaignIds = ['campaign-1', 'campaign-2'];
      const deletedBy = 'user1';

      const mockCampaigns = [
        { id: 'campaign-1', name: 'Campaign 1', assigneeEmail: 'user1@example.com' },
        { id: 'campaign-2', name: 'Campaign 2', assigneeEmail: 'user2@example.com' }
      ];

      mockCampaignService.getCampaign
        .mockResolvedValueOnce(mockCampaigns[0])
        .mockResolvedValueOnce(mockCampaigns[1]);

      mockPrisma.task.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.approval.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.campaign.delete
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkDeleteCampaigns(campaignIds, deletedBy, true);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(campaignIds);

      expect(mockPrisma.task.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.approval.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.campaign.delete).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulkUpdateTasks', () => {
    it('should successfully update multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2'];
      const updates = {
        status: 'in_progress',
        priority: 'high',
        assigneeEmail: 'newassignee@example.com'
      };
      const updatedBy = 'user1';

      const mockTasks = [
        { id: 'task-1', title: 'Task 1', assigneeEmail: 'old1@example.com' },
        { id: 'task-2', title: 'Task 2', assigneeEmail: 'old2@example.com' }
      ];

      mockTaskService.getTask
        .mockResolvedValueOnce(mockTasks[0])
        .mockResolvedValueOnce(mockTasks[1]);

      mockPrisma.task.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkUpdateTasks(taskIds, updates, updatedBy, true);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(taskIds);

      expect(mockTaskService.getTask).toHaveBeenCalledTimes(2);
      expect(mockPrisma.task.update).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulkChangeStatus', () => {
    it('should change status for multiple campaigns', async () => {
      const entityIds = ['campaign-1', 'campaign-2'];
      const newStatus = 'completed';
      const updatedBy = 'user1';

      mockPrisma.campaign.findUnique
        .mockResolvedValueOnce({ id: 'campaign-1', name: 'Campaign 1' })
        .mockResolvedValueOnce({ id: 'campaign-2', name: 'Campaign 2' });

      mockPrisma.campaign.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkChangeStatus(
        'campaign',
        entityIds,
        newStatus,
        updatedBy,
        'Project completed'
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(entityIds);

      expect(mockPrisma.campaign.update).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid entity type', async () => {
      const entityIds = ['item-1'];

      await expect(
        bulkService.bulkChangeStatus('invalid' as any, entityIds, 'active', 'user1')
      ).rejects.toThrow('Invalid entity type: invalid');
    });
  });

  describe('bulkAssignItems', () => {
    it('should assign multiple tasks to new assignee', async () => {
      const taskIds = ['task-1', 'task-2'];
      const assigneeEmail = 'newassignee@example.com';
      const assignedBy = 'user1';

      mockPrisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-1', title: 'Task 1' })
        .mockResolvedValueOnce({ id: 'task-2', title: 'Task 2' });

      mockPrisma.task.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkAssignItems(
        'task',
        taskIds,
        assigneeEmail,
        assignedBy,
        true
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(taskIds);

      expect(mockPrisma.task.update).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulkAddTags', () => {
    it('should add tags to multiple campaigns', async () => {
      const campaignIds = ['campaign-1', 'campaign-2'];
      const tagsToAdd = ['urgent', 'priority'];
      const updatedBy = 'user1';

      const mockCampaigns = [
        { id: 'campaign-1', tags: ['existing'] },
        { id: 'campaign-2', tags: [] }
      ];

      mockPrisma.campaign.findUnique
        .mockResolvedValueOnce(mockCampaigns[0])
        .mockResolvedValueOnce(mockCampaigns[1]);

      mockPrisma.campaign.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkAddTags(
        'campaign',
        campaignIds,
        tagsToAdd,
        updatedBy
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(campaignIds);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          tags: ['existing', 'urgent', 'priority'],
          updatedAt: expect.any(Date)
        }
      });

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-2' },
        data: {
          tags: ['urgent', 'priority'],
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should avoid duplicate tags', async () => {
      const campaignIds = ['campaign-1'];
      const tagsToAdd = ['urgent', 'existing'];
      const updatedBy = 'user1';

      const mockCampaign = { id: 'campaign-1', tags: ['existing', 'other'] };

      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrisma.campaign.update.mockResolvedValue({});

      await bulkService.bulkAddTags('campaign', campaignIds, tagsToAdd, updatedBy);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          tags: ['existing', 'other', 'urgent'],
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('bulkRemoveTags', () => {
    it('should remove tags from multiple campaigns', async () => {
      const campaignIds = ['campaign-1', 'campaign-2'];
      const tagsToRemove = ['old', 'deprecated'];
      const updatedBy = 'user1';

      const mockCampaigns = [
        { id: 'campaign-1', tags: ['old', 'current', 'deprecated'] },
        { id: 'campaign-2', tags: ['old', 'important'] }
      ];

      mockPrisma.campaign.findUnique
        .mockResolvedValueOnce(mockCampaigns[0])
        .mockResolvedValueOnce(mockCampaigns[1]);

      mockPrisma.campaign.update
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await bulkService.bulkRemoveTags(
        'campaign',
        campaignIds,
        tagsToRemove,
        updatedBy
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.successIds).toEqual(campaignIds);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          tags: ['current'],
          updatedAt: expect.any(Date)
        }
      });

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-2' },
        data: {
          tags: ['important'],
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle mixed success and failure scenarios', async () => {
      const campaignIds = ['campaign-1', 'campaign-2', 'campaign-3'];
      const updates = { status: 'active' };
      const updatedBy = 'user1';

      // First campaign succeeds
      mockCampaignService.getCampaign.mockResolvedValueOnce({
        id: 'campaign-1',
        name: 'Campaign 1'
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({});

      // Second campaign not found
      mockCampaignService.getCampaign.mockResolvedValueOnce(null);

      // Third campaign database error
      mockCampaignService.getCampaign.mockResolvedValueOnce({
        id: 'campaign-3',
        name: 'Campaign 3'
      });
      mockPrisma.campaign.update.mockRejectedValueOnce(new Error('Constraint violation'));

      const result = await bulkService.bulkUpdateCampaigns(
        campaignIds,
        updates,
        updatedBy,
        false
      );

      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(3);
      expect(result.successIds).toEqual(['campaign-1']);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual({
        id: 'campaign-2',
        error: 'Campaign not found'
      });
      expect(result.errors).toContainEqual({
        id: 'campaign-3',
        error: 'Constraint violation'
      });
    });
  });
});