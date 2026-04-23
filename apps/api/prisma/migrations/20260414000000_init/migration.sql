-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'QR_READY', 'ERROR');

-- CreateEnum
CREATE TYPE "WhatsAppEventKind" AS ENUM ('WEBHOOK_MESSAGE', 'WEBHOOK_STATUS', 'OUTBOUND_SEND', 'WEBHOOK_CHALLENGE', 'WEBHOOK_SIMULATOR');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'RESEARCHING', 'READY', 'CONTACTED', 'REPLIED', 'OPTED_OUT', 'CONVERTED', 'INVALID');

-- CreateEnum
CREATE TYPE "ProspectTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProspectTaskType" AS ENUM ('RESEARCH', 'ENRICHMENT');

-- CreateEnum
CREATE TYPE "ProspectTaskEventType" AS ENUM ('ENQUEUED', 'STARTED', 'COMPLETED', 'FAILED', 'SKIPPED', 'REQUEUED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentConversationStatus" AS ENUM ('OPEN', 'HANDOFF_REQUIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'AGENT', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "JourneyExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JourneyExecutionLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "JourneyExecutionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AudienceKind" AS ENUM ('DYNAMIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CampaignDelayUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');

-- CreateEnum
CREATE TYPE "SequenceRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SequenceRunStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SENT', 'FAILED', 'SKIPPED', 'QUEUED');

-- CreateEnum
CREATE TYPE "StageRuleRunStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "StageRuleRunStepStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "featureFlags" JSONB,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT,
    "whatsAppAccountId" TEXT,
    "whatsAppInboundStageId" TEXT,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "classificationCriteria" TEXT,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "contactId" TEXT,
    "assigneeId" TEXT,
    "customFields" JSONB,
    "position" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardActivity" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "channel" TEXT,
    "templateName" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CardActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageMessageTemplate" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "tags" TEXT[],
    "companyId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "position" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "industry" TEXT,
    "tenantId" TEXT NOT NULL,
    "website" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AudienceKind" NOT NULL DEFAULT 'DYNAMIC',
    "filters" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceContact" (
    "id" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "messageTemplate" TEXT,
    "launchAt" TIMESTAMP(3),
    "audienceId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "delayAmount" INTEGER NOT NULL DEFAULT 0,
    "delayUnit" "CampaignDelayUnit" NOT NULL DEFAULT 'HOURS',
    "messageTemplate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "audienceId" TEXT,
    "contactId" TEXT NOT NULL,
    "cardId" TEXT,
    "status" "SequenceRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggerSource" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "delayAmount" INTEGER NOT NULL DEFAULT 0,
    "delayUnit" "CampaignDelayUnit" NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "status" "SequenceRunStepStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalMessageId" TEXT,
    "deliveryMode" TEXT,
    "deliveryError" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadLetterReason" TEXT,
    "deadLetteredAt" TIMESTAMP(3),
    "manualRequeueCount" INTEGER NOT NULL DEFAULT 0,
    "manuallyRequeuedAt" TIMESTAMP(3),

    CONSTRAINT "SequenceRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stageId" TEXT,
    "knowledgeBaseId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profile" JSONB,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cardId" TEXT,
    "contactId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "status" "AgentConversationStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "whatsAppMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyExecution" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "triggerPayload" JSONB,
    "contactId" TEXT,
    "cardId" TEXT,
    "status" "JourneyExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyExecutionJob" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeLabel" TEXT,
    "nodeKind" TEXT NOT NULL,
    "actionType" TEXT,
    "delayInSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "JourneyExecutionJobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyExecutionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyExecutionLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "level" "JourneyExecutionLogLevel" NOT NULL DEFAULT 'INFO',
    "nodeId" TEXT,
    "nodeLabel" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "submitButtonLabel" TEXT,
    "successTitle" TEXT,
    "successMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL,
    "stageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "cardId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "summary" TEXT,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "wabaId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessToken" TEXT,
    "phoneNumber" TEXT,
    "status" "WhatsAppStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "provider" TEXT NOT NULL DEFAULT 'meta_cloud',
    "instanceName" TEXT,
    "apiKey" TEXT,
    "webhookUrl" TEXT,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "contactId" TEXT,
    "kind" "WhatsAppEventKind" NOT NULL,
    "status" "MessageStatus",
    "externalId" TEXT,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "MessageDirection" NOT NULL DEFAULT 'INBOUND',
    "externalId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "optedOutAt" TIMESTAMP(3),
    "optedOutReason" TEXT,
    "convertedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" "ProspectTaskStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT,
    "result" JSONB,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" "ProspectTaskStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT,
    "result" JSONB,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectTaskEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prospectId" TEXT,
    "taskType" "ProspectTaskType" NOT NULL,
    "eventType" "ProspectTaskEventType" NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRule" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRuleStep" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "messageTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageRuleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRuleRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "StageRuleRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggerSource" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRuleRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleStepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "StageRuleRunStepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageRuleRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaWebhookMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metaFormId" TEXT,
    "pageId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "pageAccessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaWebhookMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaLeadIngestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metaLeadId" TEXT NOT NULL,
    "cardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaLeadIngestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_campaignId_key" ON "Pipeline"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_whatsAppAccountId_key" ON "Pipeline"("whatsAppAccountId");

-- CreateIndex
CREATE INDEX "Pipeline_tenantId_whatsAppAccountId_idx" ON "Pipeline"("tenantId", "whatsAppAccountId");

-- CreateIndex
CREATE INDEX "StageMessageTemplate_stageId_idx" ON "StageMessageTemplate"("stageId");

-- CreateIndex
CREATE INDEX "StageMessageTemplate_tenantId_stageId_idx" ON "StageMessageTemplate"("tenantId", "stageId");

-- CreateIndex
CREATE INDEX "Audience_tenantId_updatedAt_idx" ON "Audience"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "AudienceContact_tenantId_audienceId_idx" ON "AudienceContact"("tenantId", "audienceId");

-- CreateIndex
CREATE INDEX "AudienceContact_tenantId_contactId_idx" ON "AudienceContact"("tenantId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceContact_audienceId_contactId_key" ON "AudienceContact"("audienceId", "contactId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_updatedAt_idx" ON "Campaign"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CampaignStep_campaignId_order_idx" ON "CampaignStep"("campaignId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStep_campaignId_order_key" ON "CampaignStep"("campaignId", "order");

-- CreateIndex
CREATE INDEX "SequenceRun_tenantId_status_nextRunAt_idx" ON "SequenceRun"("tenantId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "SequenceRun_campaignId_contactId_createdAt_idx" ON "SequenceRun"("campaignId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "SequenceRunStep_tenantId_status_scheduledFor_idx" ON "SequenceRunStep"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SequenceRunStep_runId_scheduledFor_idx" ON "SequenceRunStep"("runId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceRunStep_runId_order_key" ON "SequenceRunStep"("runId", "order");

-- CreateIndex
CREATE INDEX "AgentConversation_tenantId_contactId_idx" ON "AgentConversation"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "AgentConversation_tenantId_agentId_idx" ON "AgentConversation"("tenantId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMessage_whatsAppMessageId_key" ON "AgentMessage"("whatsAppMessageId");

-- CreateIndex
CREATE INDEX "JourneyExecution_tenantId_journeyId_createdAt_idx" ON "JourneyExecution"("tenantId", "journeyId", "createdAt");

-- CreateIndex
CREATE INDEX "JourneyExecutionJob_status_scheduledFor_idx" ON "JourneyExecutionJob"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "JourneyExecutionJob_executionId_createdAt_idx" ON "JourneyExecutionJob"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "JourneyExecutionJob_tenantId_status_scheduledFor_idx" ON "JourneyExecutionJob"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyExecutionJob_executionId_nodeId_key" ON "JourneyExecutionJob"("executionId", "nodeId");

-- CreateIndex
CREATE INDEX "JourneyExecutionLog_executionId_createdAt_idx" ON "JourneyExecutionLog"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadForm_tenantId_stageId_idx" ON "LeadForm"("tenantId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadForm_tenantId_slug_key" ON "LeadForm"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "LeadFormSubmission_tenantId_formId_idx" ON "LeadFormSubmission"("tenantId", "formId");

-- CreateIndex
CREATE INDEX "LeadFormSubmission_tenantId_createdAt_idx" ON "LeadFormSubmission"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppEvent_tenantId_createdAt_idx" ON "WhatsAppEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppEvent_tenantId_kind_createdAt_idx" ON "WhatsAppEvent"("tenantId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppEvent_tenantId_externalId_idx" ON "WhatsAppEvent"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_status_updatedAt_idx" ON "Prospect"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_source_updatedAt_idx" ON "Prospect"("tenantId", "source", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_email_idx" ON "Prospect"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_phone_idx" ON "Prospect"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "ResearchTask_tenantId_status_createdAt_idx" ON "ResearchTask"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchTask_prospectId_createdAt_idx" ON "ResearchTask"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "EnrichmentTask_tenantId_status_createdAt_idx" ON "EnrichmentTask"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EnrichmentTask_prospectId_createdAt_idx" ON "EnrichmentTask"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectTaskEvent_tenantId_createdAt_idx" ON "ProspectTaskEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectTaskEvent_tenantId_prospectId_createdAt_idx" ON "ProspectTaskEvent"("tenantId", "prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectTaskEvent_tenantId_taskType_eventType_createdAt_idx" ON "ProspectTaskEvent"("tenantId", "taskType", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StageRule_stageId_key" ON "StageRule"("stageId");

-- CreateIndex
CREATE INDEX "StageRule_tenantId_stageId_idx" ON "StageRule"("tenantId", "stageId");

-- CreateIndex
CREATE INDEX "StageRuleStep_ruleId_order_idx" ON "StageRuleStep"("ruleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StageRuleStep_ruleId_order_key" ON "StageRuleStep"("ruleId", "order");

-- CreateIndex
CREATE INDEX "StageRuleRun_tenantId_status_idx" ON "StageRuleRun"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StageRuleRun_cardId_status_idx" ON "StageRuleRun"("cardId", "status");

-- CreateIndex
CREATE INDEX "StageRuleRunStep_tenantId_status_scheduledFor_idx" ON "StageRuleRunStep"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "StageRuleRunStep_runId_order_key" ON "StageRuleRunStep"("runId", "order");

-- CreateIndex
CREATE INDEX "MetaWebhookMapping_tenantId_idx" ON "MetaWebhookMapping"("tenantId");

-- CreateIndex
CREATE INDEX "MetaWebhookMapping_pageId_idx" ON "MetaWebhookMapping"("pageId");

-- CreateIndex
CREATE INDEX "MetaWebhookMapping_metaFormId_idx" ON "MetaWebhookMapping"("metaFormId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaWebhookMapping_pageId_metaFormId_key" ON "MetaWebhookMapping"("pageId", "metaFormId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaWebhookMapping_verifyToken_key" ON "MetaWebhookMapping"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadIngestion_metaLeadId_key" ON "MetaLeadIngestion"("metaLeadId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_whatsAppAccountId_fkey" FOREIGN KEY ("whatsAppAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_whatsAppInboundStageId_fkey" FOREIGN KEY ("whatsAppInboundStageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardActivity" ADD CONSTRAINT "CardActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardActivity" ADD CONSTRAINT "CardActivity_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMessageTemplate" ADD CONSTRAINT "StageMessageTemplate_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMessageTemplate" ADD CONSTRAINT "StageMessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceContact" ADD CONSTRAINT "AudienceContact_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceContact" ADD CONSTRAINT "AudienceContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceContact" ADD CONSTRAINT "AudienceContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRun" ADD CONSTRAINT "SequenceRun_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRun" ADD CONSTRAINT "SequenceRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRun" ADD CONSTRAINT "SequenceRun_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRun" ADD CONSTRAINT "SequenceRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRun" ADD CONSTRAINT "SequenceRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceRunStep" ADD CONSTRAINT "SequenceRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SequenceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_whatsAppMessageId_fkey" FOREIGN KEY ("whatsAppMessageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyExecution" ADD CONSTRAINT "JourneyExecution_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyExecution" ADD CONSTRAINT "JourneyExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyExecutionJob" ADD CONSTRAINT "JourneyExecutionJob_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "JourneyExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyExecutionLog" ADD CONSTRAINT "JourneyExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "JourneyExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadForm" ADD CONSTRAINT "LeadForm_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadForm" ADD CONSTRAINT "LeadForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppEvent" ADD CONSTRAINT "WhatsAppEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppEvent" ADD CONSTRAINT "WhatsAppEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppEvent" ADD CONSTRAINT "WhatsAppEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedContactId_fkey" FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTask" ADD CONSTRAINT "ResearchTask_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTask" ADD CONSTRAINT "ResearchTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentTask" ADD CONSTRAINT "EnrichmentTask_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentTask" ADD CONSTRAINT "EnrichmentTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectTaskEvent" ADD CONSTRAINT "ProspectTaskEvent_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectTaskEvent" ADD CONSTRAINT "ProspectTaskEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRule" ADD CONSTRAINT "StageRule_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRule" ADD CONSTRAINT "StageRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleStep" ADD CONSTRAINT "StageRuleStep_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "StageMessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleStep" ADD CONSTRAINT "StageRuleStep_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "StageRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleRun" ADD CONSTRAINT "StageRuleRun_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleRun" ADD CONSTRAINT "StageRuleRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "StageRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleRun" ADD CONSTRAINT "StageRuleRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleRunStep" ADD CONSTRAINT "StageRuleRunStep_ruleStepId_fkey" FOREIGN KEY ("ruleStepId") REFERENCES "StageRuleStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRuleRunStep" ADD CONSTRAINT "StageRuleRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StageRuleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaWebhookMapping" ADD CONSTRAINT "MetaWebhookMapping_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaWebhookMapping" ADD CONSTRAINT "MetaWebhookMapping_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaWebhookMapping" ADD CONSTRAINT "MetaWebhookMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadIngestion" ADD CONSTRAINT "MetaLeadIngestion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

