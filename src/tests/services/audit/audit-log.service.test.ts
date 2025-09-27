import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuditLogService, AuditLogEntry } from '@/services/audit/audit-log.service';

// Mock Prisma
vi.mock('@prisma/client');

const mockPrisma = {
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    deleteMany: vi.fn()
  }
};

describe('AuditLogService', () => {
  let auditService: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    (PrismaClient as any).mockImplementation(() => mockPrisma);
    auditService = new AuditLogService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('logAction', () => {
    it('should create audit log entry', async () => {
      const entry = {
        entityType: 'campaign',
        entityId: 'campaign-1',
        action: 'create',
        userId: 'user1',
        userEmail: 'user1@example.com',
        newValues: { name: 'New Campaign', status: 'draft' },
        metadata: { source: 'web' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        sessionId: 'session-123'
      };

      const mockCreatedEntry = {
        id: 'audit-1',
        ...entry,
        timestamp: new Date()
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockCreatedEntry);

      const result = await auditService.logAction(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'create',
          userId: 'user1',
          userEmail: 'user1@example.com',
          oldValues: null,
          newValues: JSON.stringify({ name: 'New Campaign', status: 'draft' }),
          metadata: JSON.stringify({ source: 'web' }),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          sessionId: 'session-123',
          timestamp: expect.any(Date)
        }
      });

      expect(result).toBe('audit-1');
    });

    it('should handle minimal audit entry', async () => {
      const entry = {
        entityType: 'task',
        entityId: 'task-1',
        action: 'update',
        userId: 'user2',
        userEmail: 'user2@example.com'
      };

      const mockCreatedEntry = {
        id: 'audit-2',
        ...entry,
        timestamp: new Date()
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockCreatedEntry);

      await auditService.logAction(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'task',
          entityId: 'task-1',
          action: 'update',
          userId: 'user2',
          userEmail: 'user2@example.com',
          oldValues: null,
          newValues: null,
          metadata: null,
          ipAddress: undefined,
          userAgent: undefined,
          sessionId: undefined,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle database errors', async () => {
      const entry = {
        entityType: 'campaign',
        entityId: 'campaign-1',
        action: 'create',
        userId: 'user1',
        userEmail: 'user1@example.com'
      };

      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      await expect(auditService.logAction(entry)).rejects.toThrow('Database error');
    });
  });

  describe('Campaign audit methods', () => {
    it('should log campaign creation', async () => {
      const campaignData = {
        name: 'New Campaign',
        description: 'Campaign description',
        status: 'draft'
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await auditService.logCampaignCreate(
        'campaign-1',
        campaignData,
        'user1',
        'user1@example.com',
        { source: 'api' }
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'create',
          userId: 'user1',
          userEmail: 'user1@example.com',
          newValues: JSON.stringify(campaignData),
          metadata: JSON.stringify({ source: 'api' })
        })
      });

      expect(result).toBe('audit-1');
    });

    it('should log campaign update', async () => {
      const oldValues = { status: 'draft', priority: 'medium' };
      const newValues = { status: 'active', priority: 'high' };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      await auditService.logCampaignUpdate(
        'campaign-1',
        oldValues,
        newValues,
        'user1',
        'user1@example.com'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'campaign',
          action: 'update',
          oldValues: JSON.stringify(oldValues),
          newValues: JSON.stringify(newValues)
        })
      });
    });

    it('should log campaign status change', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-3' });

      await auditService.logCampaignStatusChange(
        'campaign-1',
        'draft',
        'active',
        'user1',
        'user1@example.com',
        'Ready for launch'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'status_change',
          oldValues: JSON.stringify({ status: 'draft' }),
          newValues: JSON.stringify({ status: 'active' }),
          metadata: JSON.stringify({ reason: 'Ready for launch' })
        })
      });
    });

    it('should log campaign deletion', async () => {
      const campaignData = { name: 'Deleted Campaign', status: 'active' };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-4' });

      await auditService.logCampaignDelete(
        'campaign-1',
        campaignData,
        'user1',
        'user1@example.com'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'delete',
          oldValues: JSON.stringify(campaignData)
        })
      });
    });
  });

  describe('Task audit methods', () => {
    it('should log task assignment', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-5' });

      await auditService.logTaskAssignment(
        'task-1',
        'old@example.com',
        'new@example.com',
        'manager1',
        'manager1@example.com'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'task',
          action: 'assign',
          oldValues: JSON.stringify({ assigneeEmail: 'old@example.com' }),
          newValues: JSON.stringify({ assigneeEmail: 'new@example.com' })
        })
      });
    });

    it('should log task completion', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-6' });

      await auditService.logTaskCompletion(
        'task-1',
        'user1',
        'user1@example.com',
        8
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'complete',
          newValues: JSON.stringify({
            status: 'completed',
            completedAt: expect.any(Date)
          }),
          metadata: JSON.stringify({ actualHours: 8 })
        })
      });
    });
  });

  describe('Approval audit methods', () => {
    it('should log approval request', async () => {
      const approvalData = {
        stage: 'Review',
        approverEmail: 'approver@example.com',
        urgency: 'normal'
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-7' });

      await auditService.logApprovalRequest(
        'approval-1',
        approvalData,
        'user1',
        'user1@example.com'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'approval',
          action: 'request',
          newValues: JSON.stringify(approvalData)
        })
      });
    });

    it('should log approval decision', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-8' });

      await auditService.logApprovalDecision(
        'approval-1',
        'approved',
        'approver1',
        'approver1@example.com',
        'Looks good to proceed'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'approved',
          newValues: JSON.stringify({
            status: 'approved',
            decidedAt: expect.any(Date)
          }),
          metadata: JSON.stringify({ comments: 'Looks good to proceed' })
        })
      });
    });
  });

  describe('System audit methods', () => {
    it('should log system events', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-9' });

      await auditService.logSystemEvent(
        'system_maintenance',
        'admin1',
        'admin1@example.com',
        { duration: '2 hours', type: 'database_upgrade' }
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'system',
          entityId: 'system',
          action: 'system_maintenance',
          metadata: JSON.stringify({ duration: '2 hours', type: 'database_upgrade' })
        })
      });
    });

    it('should log login attempts', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-10' });

      await auditService.logLoginAttempt(
        'user1@example.com',
        true,
        '192.168.1.1',
        'Mozilla/5.0...'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'auth',
          entityId: 'user1@example.com',
          action: 'login_success',
          userId: 'user1@example.com',
          userEmail: 'user1@example.com',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          metadata: JSON.stringify({ success: true })
        })
      });
    });

    it('should log failed login attempts', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-11' });

      await auditService.logLoginAttempt(
        'hacker@evil.com',
        false,
        '192.168.1.100'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'login_failure',
          userId: 'anonymous',
          userEmail: 'hacker@evil.com',
          metadata: JSON.stringify({ success: false })
        })
      });
    });

    it('should log logout events', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-12' });

      await auditService.logLogout(
        'user1',
        'user1@example.com',
        'session-123'
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'auth',
          action: 'logout',
          sessionId: 'session-123'
        })
      });
    });
  });

  describe('logBulkOperation', () => {
    it('should log bulk operations with results', async () => {
      const results = {
        success: 8,
        failed: 2,
        errors: ['Error 1', 'Error 2']
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-13' });

      await auditService.logBulkOperation(
        'campaign',
        ['c1', 'c2', 'c3'],
        'bulk_update',
        'user1',
        'user1@example.com',
        results
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'bulk_operation',
          action: 'bulk_update',
          newValues: JSON.stringify({
            entityType: 'campaign',
            entityIds: ['c1', 'c2', 'c3'],
            results
          }),
          metadata: JSON.stringify({
            bulkOperation: true,
            affectedCount: 3,
            successCount: 8,
            failedCount: 2
          })
        })
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const query = {
        entityType: 'campaign',
        action: 'update',
        userEmail: 'user1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        page: 1,
        limit: 20
      };

      const mockEntries = [
        {
          id: 'audit-1',
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'update',
          userId: 'user1',
          userEmail: 'user1@example.com',
          timestamp: new Date(),
          oldValues: '{"status":"draft"}',
          newValues: '{"status":"active"}',
          metadata: '{"source":"web"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          sessionId: 'session-123'
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await auditService.getAuditLogs(query);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'campaign',
          action: 'update',
          userEmail: { contains: 'user1', mode: 'insensitive' },
          timestamp: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31')
          }
        },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 20
      });

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);

      // Check that JSON fields are parsed
      expect(result.entries[0].oldValues).toEqual({ status: 'draft' });
      expect(result.entries[0].newValues).toEqual({ status: 'active' });
      expect(result.entries[0].metadata).toEqual({ source: 'web' });
    });

    it('should handle pagination correctly', async () => {
      const query = { page: 2, limit: 10 };

      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      const result = await auditService.getAuditLogs(query);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        skip: 10, // (page - 1) * limit
        take: 10
      });

      expect(result.page).toBe(2);
      expect(result.pages).toBe(3); // Math.ceil(25 / 10)
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail for specific entity', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'create',
          userId: 'user1',
          userEmail: 'user1@example.com',
          timestamp: new Date('2024-01-01'),
          oldValues: null,
          newValues: '{"name":"Campaign 1"}',
          metadata: null,
          ipAddress: null,
          userAgent: null,
          sessionId: null
        },
        {
          id: 'audit-2',
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'update',
          userId: 'user2',
          userEmail: 'user2@example.com',
          timestamp: new Date('2024-01-02'),
          oldValues: '{"status":"draft"}',
          newValues: '{"status":"active"}',
          metadata: null,
          ipAddress: null,
          userAgent: null,
          sessionId: null
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);

      const result = await auditService.getAuditTrail('campaign', 'campaign-1');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'campaign',
          entityId: 'campaign-1'
        },
        orderBy: { timestamp: 'asc' }
      });

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('create');
      expect(result[1].action).toBe('update');
    });
  });

  describe('getUserActivity', () => {
    it('should retrieve user activity for specified period', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          entityType: 'campaign',
          action: 'create',
          userEmail: 'user1@example.com',
          timestamp: new Date()
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await auditService.getUserActivity('user1@example.com', 7);

      expect(result).toHaveLength(1);
      expect(result[0].userEmail).toBe('user1@example.com');
    });
  });

  describe('generateAuditSummary', () => {
    it('should generate comprehensive audit summary', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.groupBy
        .mockResolvedValueOnce([
          { action: 'create', _count: { action: 30 } },
          { action: 'update', _count: { action: 50 } },
          { action: 'delete', _count: { action: 20 } }
        ])
        .mockResolvedValueOnce([
          { userEmail: 'user1@example.com', _count: { userEmail: 40 } },
          { userEmail: 'user2@example.com', _count: { userEmail: 35 } },
          { userEmail: 'user3@example.com', _count: { userEmail: 25 } }
        ])
        .mockResolvedValueOnce([
          { entityType: 'campaign', entityId: 'campaign-1', _count: { id: 15 } },
          { entityType: 'task', entityId: 'task-1', _count: { id: 12 } }
        ]);

      // Mock timeline data
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(100) // overall count
        .mockResolvedValue(10); // daily counts

      const result = await auditService.generateAuditSummary(30);

      expect(result.totalActions).toBe(100);
      expect(result.actionsByType).toEqual({
        create: 30,
        update: 50,
        delete: 20
      });
      expect(result.mostActiveUsers).toHaveLength(3);
      expect(result.mostActiveUsers[0]).toEqual({
        userEmail: 'user1@example.com',
        count: 40
      });
      expect(result.mostModifiedEntities).toHaveLength(2);
      expect(result.timelineData).toBeDefined();
    });
  });

  describe('data retention', () => {
    it('should cleanup old audit logs', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 150 });

      const result = await auditService.cleanupOldLogs(365);

      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: expect.any(Date) }
        }
      });

      expect(result).toBe(150);
    });

    it('should archive old logs', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 100 });

      const result = await auditService.archiveOldLogs(90);

      expect(result).toEqual({
        archived: 0,
        deleted: 100
      });
    });
  });

  describe('export functionality', () => {
    it('should export audit logs as JSON', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          entityType: 'campaign',
          action: 'create',
          timestamp: new Date('2024-01-01')
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await auditService.exportAuditLogs({}, 'json');

      expect(result).toBe(JSON.stringify(mockEntries, null, 2));
    });

    it('should export audit logs as CSV', async () => {
      const mockEntries = [
        {
          id: 'audit-1',
          entityType: 'campaign',
          entityId: 'campaign-1',
          action: 'create',
          userId: 'user1',
          userEmail: 'user1@example.com',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockEntries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await auditService.exportAuditLogs({}, 'csv');

      expect(result).toContain('timestamp,entityType,entityId,action,userId,userEmail,ipAddress,userAgent');
      expect(result).toContain('"2024-01-01T00:00:00.000Z","campaign","campaign-1","create","user1","user1@example.com","192.168.1.1","Mozilla/5.0"');
    });

    it('should handle empty export', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await auditService.exportAuditLogs({}, 'csv');

      expect(result).toBe('');
    });
  });
});