-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('SCHEDULED', 'READY', 'LAUNCHING', 'SENT', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NotificationStage" AS ENUM ('PRELAUNCH', 'PREFLIGHT', 'LAUNCH_WARNING', 'LAUNCH_CONFIRMATION', 'WRAPUP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SUCCESS', 'FAILURE', 'RETRYING');

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
ALTER TABLE "lifecycle_campaign_metrics" ADD CONSTRAINT "lifecycle_campaign_metrics_campaignScheduleId_fkey" FOREIGN KEY ("campaignScheduleId") REFERENCES "lifecycle_campaign_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_notification_logs" ADD CONSTRAINT "lifecycle_notification_logs_campaignScheduleId_fkey" FOREIGN KEY ("campaignScheduleId") REFERENCES "lifecycle_campaign_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
