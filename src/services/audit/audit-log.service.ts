import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

export interface AuditLogEntry {
  id?: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userEmail: string;
  timestamp: Date;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  userEmail?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditSummary {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Record<string, number>;
  mostActiveUsers: Array<{ userEmail: string; count: number }>;
  mostModifiedEntities: Array<{ entityType: string; entityId: string; count: number }>;
  timelineData: Array<{ date: string; count: number }>;
}

export class AuditLogService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Core Audit Logging
  async logAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      const auditEntry = await this.prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId,
          userEmail: entry.userEmail,
          oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
          newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          sessionId: entry.sessionId,
          timestamp: new Date()
        }
      });

      logger.info('Audit log entry created', {
        id: auditEntry.id,
        entityType: entry.entityType,
        action: entry.action,
        userId: entry.userId
      });

      return auditEntry.id;
    } catch (error) {
      logger.error('Failed to create audit log entry', { entry, error });
      throw error;
    }
  }

  // Campaign Audit Methods
  async logCampaignCreate(
    campaignId: string,
    campaignData: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'campaign',
      entityId: campaignId,
      action: 'create',
      userId,
      userEmail,
      newValues: campaignData,
      metadata
    });
  }

  async logCampaignUpdate(
    campaignId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'campaign',
      entityId: campaignId,
      action: 'update',
      userId,
      userEmail,
      oldValues,
      newValues,
      metadata
    });
  }

  async logCampaignDelete(
    campaignId: string,
    campaignData: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'campaign',
      entityId: campaignId,
      action: 'delete',
      userId,
      userEmail,
      oldValues: campaignData,
      metadata
    });
  }

  async logCampaignStatusChange(
    campaignId: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    userEmail: string,
    reason?: string
  ): Promise<string> {
    return this.logAction({
      entityType: 'campaign',
      entityId: campaignId,
      action: 'status_change',
      userId,
      userEmail,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: { reason }
    });
  }

  // Task Audit Methods
  async logTaskCreate(
    taskId: string,
    taskData: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'task',
      entityId: taskId,
      action: 'create',
      userId,
      userEmail,
      newValues: taskData,
      metadata
    });
  }

  async logTaskUpdate(
    taskId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'task',
      entityId: taskId,
      action: 'update',
      userId,
      userEmail,
      oldValues,
      newValues,
      metadata
    });
  }

  async logTaskAssignment(
    taskId: string,
    oldAssigneeEmail: string | null,
    newAssigneeEmail: string,
    userId: string,
    userEmail: string
  ): Promise<string> {
    return this.logAction({
      entityType: 'task',
      entityId: taskId,
      action: 'assign',
      userId,
      userEmail,
      oldValues: { assigneeEmail: oldAssigneeEmail },
      newValues: { assigneeEmail: newAssigneeEmail }
    });
  }

  async logTaskCompletion(
    taskId: string,
    userId: string,
    userEmail: string,
    actualHours?: number
  ): Promise<string> {
    return this.logAction({
      entityType: 'task',
      entityId: taskId,
      action: 'complete',
      userId,
      userEmail,
      newValues: { status: 'completed', completedAt: new Date() },
      metadata: { actualHours }
    });
  }

  // Approval Audit Methods
  async logApprovalRequest(
    approvalId: string,
    approvalData: Record<string, any>,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'approval',
      entityId: approvalId,
      action: 'request',
      userId,
      userEmail,
      newValues: approvalData,
      metadata
    });
  }

  async logApprovalDecision(
    approvalId: string,
    decision: 'approved' | 'rejected',
    userId: string,
    userEmail: string,
    comments?: string
  ): Promise<string> {
    return this.logAction({
      entityType: 'approval',
      entityId: approvalId,
      action: decision,
      userId,
      userEmail,
      newValues: { status: decision, decidedAt: new Date() },
      metadata: { comments }
    });
  }

  // Bulk Operations Audit
  async logBulkOperation(
    entityType: string,
    entityIds: string[],
    operation: string,
    userId: string,
    userEmail: string,
    results: { success: number; failed: number; errors: any[] }
  ): Promise<string> {
    return this.logAction({
      entityType: 'bulk_operation',
      entityId: `bulk_${Date.now()}`,
      action: operation,
      userId,
      userEmail,
      newValues: { entityType, entityIds, results },
      metadata: {
        bulkOperation: true,
        affectedCount: entityIds.length,
        successCount: results.success,
        failedCount: results.failed
      }
    });
  }

  // System Audit Methods
  async logSystemEvent(
    event: string,
    userId: string,
    userEmail: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logAction({
      entityType: 'system',
      entityId: 'system',
      action: event,
      userId,
      userEmail,
      metadata
    });
  }

  async logLoginAttempt(
    userEmail: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.logAction({
      entityType: 'auth',
      entityId: userEmail,
      action: success ? 'login_success' : 'login_failure',
      userId: success ? userEmail : 'anonymous',
      userEmail,
      ipAddress,
      userAgent,
      metadata: { success }
    });
  }

  async logLogout(
    userId: string,
    userEmail: string,
    sessionId?: string
  ): Promise<string> {
    return this.logAction({
      entityType: 'auth',
      entityId: userId,
      action: 'logout',
      userId,
      userEmail,
      sessionId
    });
  }

  // Query Methods
  async getAuditLogs(query: AuditQuery): Promise<{
    entries: AuditLogEntry[];
    total: number;
    page: number;
    pages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.userEmail) where.userEmail = { contains: query.userEmail, mode: 'insensitive' };

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = query.startDate;
      if (query.endDate) where.timestamp.lte = query.endDate;
    }

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.auditLog.count({ where })
    ]);

    const formattedEntries: AuditLogEntry[] = entries.map(entry => ({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      userEmail: entry.userEmail,
      timestamp: entry.timestamp,
      oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : undefined,
      newValues: entry.newValues ? JSON.parse(entry.newValues) : undefined,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
      ipAddress: entry.ipAddress || undefined,
      userAgent: entry.userAgent || undefined,
      sessionId: entry.sessionId || undefined
    }));

    return {
      entries: formattedEntries,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  async getAuditTrail(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const entries = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId
      },
      orderBy: { timestamp: 'asc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      userEmail: entry.userEmail,
      timestamp: entry.timestamp,
      oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : undefined,
      newValues: entry.newValues ? JSON.parse(entry.newValues) : undefined,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
      ipAddress: entry.ipAddress || undefined,
      userAgent: entry.userAgent || undefined,
      sessionId: entry.sessionId || undefined
    }));
  }

  async getUserActivity(userEmail: string, days: number = 30): Promise<AuditLogEntry[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.getAuditLogs({
      userEmail,
      startDate,
      limit: 1000
    }).then(result => result.entries);
  }

  // Analytics and Reporting
  async generateAuditSummary(days: number = 30): Promise<AuditSummary> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalActions,
      actionsByType,
      actionsByUser,
      timelineData
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: { timestamp: { gte: startDate } }
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        where: { timestamp: { gte: startDate } }
      }),
      this.prisma.auditLog.groupBy({
        by: ['userEmail'],
        _count: { userEmail: true },
        where: { timestamp: { gte: startDate } },
        orderBy: { _count: { userEmail: 'desc' } },
        take: 10
      }),
      this.getTimelineData(startDate)
    ]);

    const actionsByTypeMap: Record<string, number> = {};
    actionsByType.forEach(item => {
      actionsByTypeMap[item.action] = item._count.action;
    });

    const actionsByUserMap: Record<string, number> = {};
    const mostActiveUsers = actionsByUser.map(item => ({
      userEmail: item.userEmail,
      count: item._count.userEmail
    }));

    actionsByUser.forEach(item => {
      actionsByUserMap[item.userEmail] = item._count.userEmail;
    });

    // Get most modified entities
    const mostModifiedEntities = await this.getMostModifiedEntities(startDate);

    return {
      totalActions,
      actionsByType: actionsByTypeMap,
      actionsByUser: actionsByUserMap,
      mostActiveUsers,
      mostModifiedEntities,
      timelineData
    };
  }

  private async getTimelineData(startDate: Date): Promise<Array<{ date: string; count: number }>> {
    // This would be more sophisticated in a real implementation
    const timeline: Array<{ date: string; count: number }> = [];
    const days = Math.ceil((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const count = await this.prisma.auditLog.count({
        where: {
          timestamp: {
            gte: date,
            lt: nextDate
          }
        }
      });

      timeline.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    return timeline;
  }

  private async getMostModifiedEntities(startDate: Date): Promise<Array<{
    entityType: string;
    entityId: string;
    count: number;
  }>> {
    const results = await this.prisma.auditLog.groupBy({
      by: ['entityType', 'entityId'],
      _count: { id: true },
      where: {
        timestamp: { gte: startDate },
        entityType: { not: 'system' } // Exclude system events
      },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });

    return results.map(item => ({
      entityType: item.entityType,
      entityId: item.entityId,
      count: item._count.id
    }));
  }

  // Data Retention and Cleanup
  async cleanupOldLogs(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    logger.info('Starting audit log cleanup', { cutoffDate, olderThanDays });

    const deleteResult = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    });

    logger.info('Audit log cleanup completed', { deletedCount: deleteResult.count });

    return deleteResult.count;
  }

  async archiveOldLogs(olderThanDays: number = 90): Promise<{
    archived: number;
    deleted: number;
  }> {
    // This would typically export to external storage before deletion
    // For now, we'll just delete
    const deleted = await this.cleanupOldLogs(olderThanDays);

    return {
      archived: 0, // Would be actual archived count
      deleted
    };
  }

  // Export functionality
  async exportAuditLogs(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const result = await this.getAuditLogs({ ...query, limit: 10000 });

    if (format === 'csv') {
      return this.convertToCSV(result.entries);
    }

    return JSON.stringify(result.entries, null, 2);
  }

  private convertToCSV(entries: AuditLogEntry[]): string {
    if (entries.length === 0) return '';

    const headers = [
      'timestamp',
      'entityType',
      'entityId',
      'action',
      'userId',
      'userEmail',
      'ipAddress',
      'userAgent'
    ];

    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.timestamp.toISOString(),
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.userId,
        entry.userEmail,
        entry.ipAddress || '',
        entry.userAgent || ''
      ];

      csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
  }
}