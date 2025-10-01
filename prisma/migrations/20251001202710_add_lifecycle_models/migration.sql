-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('SCHEDULED', 'READY', 'LAUNCHING', 'SENT', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NotificationStage" AS ENUM ('PRELAUNCH', 'PREFLIGHT', 'LAUNCH_WARNING', 'LAUNCH_CONFIRMATION', 'WRAPUP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SUCCESS', 'FAILURE', 'RETRYING');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "targetDate" TIMESTAMP(3) NOT NULL,
    "objectives" TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "budget" DOUBLE PRECISION,
    "stakeholders" TEXT[],
    "metadata" JSONB,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timelines" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "milestones" JSONB NOT NULL,
    "criticalPath" TEXT[],
    "buffer" INTEGER NOT NULL,
    "estimatedHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dependencies" TEXT[],
    "completedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "estimatedHours" INTEGER NOT NULL DEFAULT 1,
    "actualHours" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "milestoneId" TEXT,
    "templateTaskId" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "skills" TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "slackUserId" TEXT,
    "availability" JSONB NOT NULL,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_team_members" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "conditions" TEXT[],
    "decidedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveAt" TIMESTAMP(3),
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "senderId" TEXT,
    "recipientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "recurring" JSONB,
    "participants" TEXT[],
    "location" TEXT,
    "description" TEXT,
    "reminders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSync" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT,
    "performedBy" TEXT NOT NULL,
    "actorId" TEXT,
    "details" JSONB,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_schedules" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "campaignId" TEXT,
    "dayOfWeek" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roundNumber" INTEGER,
    "recipientCount" INTEGER,
    "segment" TEXT,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_access" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "lastAccess" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressed_contacts" (
    "id" TEXT NOT NULL,
    "contact_id" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "suppression_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bounce_count" INTEGER NOT NULL DEFAULT 1,
    "first_bounce_date" TIMESTAMP(3),
    "last_bounce_date" TIMESTAMP(3),
    "source_campaign_id" TEXT,
    "source_batch" TEXT,
    "source_round" INTEGER,
    "mailjet_list_id" BIGINT,
    "mailjet_blocked" BOOLEAN NOT NULL DEFAULT false,
    "mailjet_error_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_permanent" BOOLEAN NOT NULL DEFAULT true,
    "revalidation_eligible_at" TIMESTAMP(3),
    "revalidated_at" TIMESTAMP(3),
    "suppressed_by" TEXT NOT NULL DEFAULT 'system',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppressed_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_campaign_schedules" (
    "id" SERIAL NOT NULL,
    "campaignName" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "listId" BIGINT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "recipientRange" TEXT NOT NULL,
    "mailjetDraftId" BIGINT,
    "mailjetCampaignId" BIGINT,
    "subject" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "notificationStatus" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lifecycle_campaign_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_campaign_metrics" (
    "id" SERIAL NOT NULL,
    "campaignScheduleId" INTEGER NOT NULL,
    "mailjetCampaignId" BIGINT NOT NULL,
    "processed" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "bounced" INTEGER NOT NULL,
    "hardBounces" INTEGER NOT NULL,
    "softBounces" INTEGER NOT NULL,
    "blocked" INTEGER NOT NULL,
    "queued" INTEGER NOT NULL,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DOUBLE PRECISION NOT NULL,
    "bounceRate" DOUBLE PRECISION NOT NULL,
    "hardBounceRate" DOUBLE PRECISION NOT NULL,
    "softBounceRate" DOUBLE PRECISION NOT NULL,
    "openRate" DOUBLE PRECISION,
    "clickRate" DOUBLE PRECISION,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendStartAt" TIMESTAMP(3),
    "sendEndAt" TIMESTAMP(3),

    CONSTRAINT "lifecycle_campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_notification_logs" (
    "id" SERIAL NOT NULL,
    "campaignScheduleId" INTEGER NOT NULL,
    "stage" "NotificationStage" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "slackMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timelines_campaignId_key" ON "timelines"("campaignId");

-- CreateIndex
CREATE INDEX "tasks_campaignId_status_idx" ON "tasks"("campaignId", "status");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_dueDate_idx" ON "tasks"("assigneeId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_milestoneId_idx" ON "tasks"("milestoneId");

-- CreateIndex
CREATE INDEX "tasks_templateTaskId_idx" ON "tasks"("templateTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_team_members_campaignId_memberId_key" ON "campaign_team_members"("campaignId", "memberId");

-- CreateIndex
CREATE INDEX "approvals_status_deadline_idx" ON "approvals"("status", "deadline");

-- CreateIndex
CREATE INDEX "approvals_autoApprove_autoApproveAt_idx" ON "approvals"("autoApprove", "autoApproveAt");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_campaignId_stage_approverId_key" ON "approvals"("campaignId", "stage", "approverId");

-- CreateIndex
CREATE INDEX "notifications_recipientId_sentAt_idx" ON "notifications"("recipientId", "sentAt");

-- CreateIndex
CREATE INDEX "notifications_scheduledFor_sentAt_idx" ON "notifications"("scheduledFor", "sentAt");

-- CreateIndex
CREATE INDEX "notifications_channel_sentAt_idx" ON "notifications"("channel", "sentAt");

-- CreateIndex
CREATE INDEX "comments_taskId_createdAt_idx" ON "comments"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "attachments_taskId_idx" ON "attachments"("taskId");

-- CreateIndex
CREATE INDEX "assets_campaignId_type_idx" ON "assets"("campaignId", "type");

-- CreateIndex
CREATE INDEX "assets_campaignId_isActive_idx" ON "assets"("campaignId", "isActive");

-- CreateIndex
CREATE INDEX "schedules_startDate_endDate_idx" ON "schedules"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "schedules_type_startDate_idx" ON "schedules"("type", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_name_key" ON "integrations"("name");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_performedBy_createdAt_idx" ON "activity_logs"("performedBy", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_type_createdAt_idx" ON "activity_logs"("type", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "campaign_schedules_weekNumber_year_idx" ON "campaign_schedules"("weekNumber", "year");

-- CreateIndex
CREATE INDEX "campaign_schedules_scheduledDate_idx" ON "campaign_schedules"("scheduledDate");

-- CreateIndex
CREATE INDEX "campaign_schedules_status_idx" ON "campaign_schedules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_schedules_weekNumber_year_scheduledDate_time_key" ON "campaign_schedules"("weekNumber", "year", "scheduledDate", "time");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_access_email_key" ON "dashboard_access"("email");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_access_accessToken_key" ON "dashboard_access"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "suppressed_contacts_contact_id_key" ON "suppressed_contacts"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppressed_contacts_email_key" ON "suppressed_contacts"("email");

-- CreateIndex
CREATE INDEX "suppressed_contacts_email_idx" ON "suppressed_contacts"("email");

-- CreateIndex
CREATE INDEX "suppressed_contacts_contact_id_idx" ON "suppressed_contacts"("contact_id");

-- CreateIndex
CREATE INDEX "suppressed_contacts_suppression_type_idx" ON "suppressed_contacts"("suppression_type");

-- CreateIndex
CREATE INDEX "suppressed_contacts_status_idx" ON "suppressed_contacts"("status");

-- CreateIndex
CREATE INDEX "suppressed_contacts_source_batch_idx" ON "suppressed_contacts"("source_batch");

-- CreateIndex
CREATE INDEX "suppressed_contacts_created_at_idx" ON "suppressed_contacts"("created_at");

-- CreateIndex
CREATE INDEX "suppressed_contacts_revalidation_eligible_at_idx" ON "suppressed_contacts"("revalidation_eligible_at");

-- CreateIndex
CREATE INDEX "suppressed_contacts_suppression_type_status_idx" ON "suppressed_contacts"("suppression_type", "status");

-- CreateIndex
CREATE INDEX "suppressed_contacts_source_batch_source_round_idx" ON "suppressed_contacts"("source_batch", "source_round");

-- CreateIndex
CREATE INDEX "lifecycle_campaign_schedules_scheduledDate_roundNumber_idx" ON "lifecycle_campaign_schedules"("scheduledDate", "roundNumber");

-- CreateIndex
CREATE INDEX "lifecycle_campaign_schedules_status_idx" ON "lifecycle_campaign_schedules"("status");

-- CreateIndex
CREATE INDEX "lifecycle_campaign_schedules_mailjetCampaignId_idx" ON "lifecycle_campaign_schedules"("mailjetCampaignId");

-- CreateIndex
CREATE INDEX "lifecycle_campaign_metrics_mailjetCampaignId_idx" ON "lifecycle_campaign_metrics"("mailjetCampaignId");

-- CreateIndex
CREATE INDEX "lifecycle_campaign_metrics_campaignScheduleId_idx" ON "lifecycle_campaign_metrics"("campaignScheduleId");

-- CreateIndex
CREATE INDEX "lifecycle_notification_logs_campaignScheduleId_stage_idx" ON "lifecycle_notification_logs"("campaignScheduleId", "stage");

-- CreateIndex
CREATE INDEX "lifecycle_notification_logs_status_idx" ON "lifecycle_notification_logs"("status");

-- AddForeignKey
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_team_members" ADD CONSTRAINT "campaign_team_members_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_team_members" ADD CONSTRAINT "campaign_team_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_campaign_metrics" ADD CONSTRAINT "lifecycle_campaign_metrics_campaignScheduleId_fkey" FOREIGN KEY ("campaignScheduleId") REFERENCES "lifecycle_campaign_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_notification_logs" ADD CONSTRAINT "lifecycle_notification_logs_campaignScheduleId_fkey" FOREIGN KEY ("campaignScheduleId") REFERENCES "lifecycle_campaign_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
