import { TaskService } from '../../../src/services/task/task.service';
import { CreateTaskRequest } from '../../../src/types';

// Mock dependencies
const mockPrisma = {
  campaign: {
    findUnique: jest.fn(),
  },
  task: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  teamMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  timeline: {
    findUnique: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
} as any;

const mockCache = {
  getTask: jest.fn(),
  setTask: jest.fn(),
  invalidateTask: jest.fn(),
  invalidateCampaign: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
} as any;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    taskService = new TaskService(mockPrisma, mockCache);
  });

  describe('createTask', () => {
    const createRequest: CreateTaskRequest = {
      campaignId: 'campaign-1',
      title: 'Test Task',
      description: 'Test task description',
      dueDate: new Date('2024-12-31'),
      priority: 'high',
      estimatedHours: 8,
      tags: ['design', 'content']
    };

    const mockCampaign = {
      id: 'campaign-1',
      status: 'planning'
    };

    const mockCreatedTask = {
      id: 'task-1',
      campaignId: 'campaign-1',
      title: 'Test Task',
      description: 'Test task description',
      dueDate: new Date('2024-12-31'),
      priority: 'high',
      status: 'pending',
      estimatedHours: 8,
      actualHours: 0,
      tags: ['design', 'content'],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: null,
      campaign: {
        id: 'campaign-1',
        name: 'Test Campaign',
        type: 'email_blast',
        status: 'planning'
      },
      comments: [],
      attachments: []
    };

    it('should create a task successfully', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrisma.task.create.mockResolvedValue(mockCreatedTask);

      const result = await taskService.createTask(createRequest, 'user-1');

      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        select: { id: true, status: true }
      });

      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campaignId: 'campaign-1',
          title: 'Test Task',
          description: 'Test task description',
          dueDate: createRequest.dueDate,
          priority: 'high',
          status: 'pending',
          estimatedHours: 8,
          actualHours: 0,
          tags: ['design', 'content'],
          createdBy: 'user-1',
          updatedBy: 'user-1'
        }),
        include: expect.any(Object)
      });

      expect(mockCache.invalidateTask).toHaveBeenCalledWith('task-1');
      expect(mockCache.invalidateCampaign).toHaveBeenCalledWith('campaign-1');
      expect(result).toEqual(mockCreatedTask);
    });

    it('should throw error if campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(taskService.createTask(createRequest, 'user-1'))
        .rejects.toThrow('Campaign not found');
    });

    it('should auto-assign if requested', async () => {
      const requestWithAutoAssign = {
        ...createRequest,
        autoAssign: true
      };

      const mockTeamMember = {
        id: 'member-1',
        name: 'John Doe',
        isActive: true,
        maxConcurrent: 5,
        tasks: []
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrisma.teamMember.findMany.mockResolvedValue([mockTeamMember]);
      mockPrisma.task.create.mockResolvedValue({
        ...mockCreatedTask,
        assigneeId: 'member-1',
        status: 'assigned'
      });

      const result = await taskService.createTask(requestWithAutoAssign, 'user-1');

      expect(mockPrisma.teamMember.findMany).toHaveBeenCalled();
      expect(result.status).toBeDefined();
    });
  });

  describe('getTask', () => {
    const mockTask = {
      id: 'task-1',
      title: 'Test Task',
      status: 'pending',
      assignee: null,
      campaign: {
        id: 'campaign-1',
        name: 'Test Campaign'
      },
      comments: [],
      attachments: []
    };

    it('should return task from cache if available', async () => {
      mockCache.getTask.mockResolvedValue(mockTask);

      const result = await taskService.getTask('task-1');

      expect(mockCache.getTask).toHaveBeenCalledWith('task-1');
      expect(mockPrisma.task.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCache.getTask.mockResolvedValue(null);
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await taskService.getTask('task-1');

      expect(mockCache.getTask).toHaveBeenCalledWith('task-1');
      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: expect.any(Object)
      });
      expect(mockCache.setTask).toHaveBeenCalledWith(mockTask);
      expect(result).toEqual(mockTask);
    });

    it('should return null if task not found', async () => {
      mockCache.getTask.mockResolvedValue(null);
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const result = await taskService.getTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('assignTask', () => {
    const mockTask = {
      id: 'task-1',
      campaignId: 'campaign-1',
      title: 'Test Task',
      status: 'pending',
      assigneeId: null
    };

    const mockAssignee = {
      id: 'member-1',
      name: 'John Doe',
      isActive: true,
      maxConcurrent: 5
    };

    it('should assign task successfully', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(mockAssignee);
      mockPrisma.task.count.mockResolvedValue(2); // Current task count
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);
      mockPrisma.task.update.mockResolvedValue({
        ...mockTask,
        assigneeId: 'member-1',
        status: 'assigned'
      });

      const result = await taskService.assignTask('task-1', 'member-1', 'user-1');

      expect(mockPrisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        select: expect.objectContaining({
          id: true,
          name: true,
          isActive: true,
          maxConcurrent: true
        })
      });

      expect(mockPrisma.task.count).toHaveBeenCalledWith({
        where: {
          assigneeId: 'member-1',
          status: { in: ['assigned', 'in_progress'] }
        }
      });

      expect(result.assigneeId).toBeDefined();
    });

    it('should throw error if assignee not found', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(taskService.assignTask('task-1', 'nonexistent', 'user-1'))
        .rejects.toThrow('Assignee not found or inactive');
    });

    it('should warn if assignee is at capacity', async () => {
      const atCapacityAssignee = { ...mockAssignee, maxConcurrent: 2 };
      mockPrisma.teamMember.findUnique.mockResolvedValue(atCapacityAssignee);
      mockPrisma.task.count.mockResolvedValue(2); // At capacity
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);
      mockPrisma.task.update.mockResolvedValue({
        ...mockTask,
        assigneeId: 'member-1',
        status: 'assigned'
      });

      const result = await taskService.assignTask('task-1', 'member-1', 'user-1');

      // Should still assign but log warning
      expect(result.assigneeId).toBeDefined();
    });
  });

  describe('findBestAssignee', () => {
    const taskData: CreateTaskRequest = {
      campaignId: 'campaign-1',
      title: 'Test Task',
      dueDate: new Date('2024-12-31'),
      priority: 'high',
      tags: ['design'],
      estimatedHours: 8
    };

    it('should return best assignee based on availability', async () => {
      const teamMembers = [
        {
          id: 'member-1',
          name: 'John Doe',
          isActive: true,
          maxConcurrent: 5,
          tasks: [{ id: 'task-1' }] // 1 current task
        },
        {
          id: 'member-2',
          name: 'Jane Smith',
          isActive: true,
          maxConcurrent: 3,
          tasks: [] // 0 current tasks - better availability
        }
      ];

      mockPrisma.teamMember.findMany.mockResolvedValue(teamMembers);

      const result = await taskService.findBestAssignee(taskData);

      expect(result).toBeDefined();
      expect(result?.assigneeId).toBe('member-2'); // Should pick the one with better availability
      expect(result?.confidence).toBeGreaterThan(0.3);
    });

    it('should return null if no suitable assignee found', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([]);

      const result = await taskService.findBestAssignee(taskData);

      expect(result).toBeNull();
    });
  });
});