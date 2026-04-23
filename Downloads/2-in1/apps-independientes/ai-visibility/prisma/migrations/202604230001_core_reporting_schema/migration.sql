-- Create enums
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "TagType" AS ENUM ('TOPIC', 'INTENT', 'MARKET', 'CAMPAIGN', 'CUSTOM');
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "RunTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'IMPORT', 'API');
CREATE TYPE "RunSource" AS ENUM ('UI', 'API', 'BACKFILL', 'IMPORT_FILE');
CREATE TYPE "BrandMentionType" AS ENUM ('OWN_BRAND', 'COMPETITOR');
CREATE TYPE "SnapshotGranularity" AS ENUM ('DAY', 'WEEK', 'MONTH', 'CUSTOM');
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'JSON', 'XLSX');

-- Create tables
CREATE TABLE "user" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_alias" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_alias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competitor" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "category" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "competitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tag" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TagType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompt" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "title" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "objective" TEXT,
  "language" TEXT NOT NULL DEFAULT 'es',
  "status" "PromptStatus" NOT NULL DEFAULT 'ACTIVE',
  "scheduleCron" TEXT,
  "scheduleTimezone" TEXT,
  "isScheduleActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "prompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompt_tag" (
  "promptId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prompt_tag_pkey" PRIMARY KEY ("promptId", "tagId")
);

CREATE TABLE "run" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "triggeredByUserId" TEXT,
  "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
  "triggerType" "RunTriggerType" NOT NULL DEFAULT 'MANUAL',
  "source" "RunSource" NOT NULL DEFAULT 'UI',
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "environment" TEXT,
  "importBatchKey" TEXT,
  "externalRef" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "response" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 1,
  "rawText" TEXT NOT NULL,
  "normalizedText" TEXT,
  "tokenIn" INTEGER,
  "tokenOut" INTEGER,
  "latencyMs" INTEGER,
  "isError" BOOLEAN NOT NULL DEFAULT false,
  "errorType" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "response_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "response_brand_mention" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "competitorId" TEXT,
  "brandAliasId" TEXT,
  "mentionType" "BrandMentionType" NOT NULL,
  "mentionText" TEXT NOT NULL,
  "mentionCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "response_brand_mention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "citation" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceDomain" TEXT NOT NULL,
  "title" TEXT,
  "snippet" TEXT,
  "position" INTEGER,
  "confidence" DECIMAL(5,4),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "citation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kpi_snapshot" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "promptId" TEXT,
  "competitorId" TEXT,
  "model" TEXT,
  "sourceDomain" TEXT,
  "granularity" "SnapshotGranularity" NOT NULL DEFAULT 'CUSTOM',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metricsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "export_job" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "format" "ExportFormat" NOT NULL,
  "filtersJson" JSONB NOT NULL,
  "resultUrl" TEXT,
  "errorMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "export_job_pkey" PRIMARY KEY ("id")
);

-- Uniques
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");
CREATE UNIQUE INDEX "brand_alias_projectId_normalizedAlias_key" ON "brand_alias"("projectId", "normalizedAlias");
CREATE UNIQUE INDEX "competitor_projectId_name_key" ON "competitor"("projectId", "name");
CREATE UNIQUE INDEX "tag_projectId_type_name_key" ON "tag"("projectId", "type", "name");
CREATE UNIQUE INDEX "response_runId_ordinal_key" ON "response"("runId", "ordinal");

-- Indexes
CREATE INDEX "user_isActive_idx" ON "user"("isActive");
CREATE INDEX "project_ownerUserId_idx" ON "project"("ownerUserId");
CREATE INDEX "project_status_idx" ON "project"("status");
CREATE INDEX "project_deletedAt_idx" ON "project"("deletedAt");
CREATE INDEX "brand_alias_projectId_idx" ON "brand_alias"("projectId");
CREATE INDEX "competitor_projectId_idx" ON "competitor"("projectId");
CREATE INDEX "competitor_projectId_domain_idx" ON "competitor"("projectId", "domain");
CREATE INDEX "competitor_deletedAt_idx" ON "competitor"("deletedAt");
CREATE INDEX "tag_projectId_type_idx" ON "tag"("projectId", "type");
CREATE INDEX "tag_deletedAt_idx" ON "tag"("deletedAt");
CREATE INDEX "prompt_projectId_status_idx" ON "prompt"("projectId", "status");
CREATE INDEX "prompt_projectId_isScheduleActive_idx" ON "prompt"("projectId", "isScheduleActive");
CREATE INDEX "prompt_deletedAt_idx" ON "prompt"("deletedAt");
CREATE INDEX "prompt_tag_tagId_idx" ON "prompt_tag"("tagId");
CREATE INDEX "run_projectId_executedAt_idx" ON "run"("projectId", "executedAt");
CREATE INDEX "run_projectId_model_executedAt_idx" ON "run"("projectId", "model", "executedAt");
CREATE INDEX "run_promptId_executedAt_idx" ON "run"("promptId", "executedAt");
CREATE INDEX "run_triggerType_scheduledFor_idx" ON "run"("triggerType", "scheduledFor");
CREATE INDEX "run_importBatchKey_idx" ON "run"("importBatchKey");
CREATE INDEX "response_createdAt_idx" ON "response"("createdAt");
CREATE INDEX "response_brand_mention_responseId_idx" ON "response_brand_mention"("responseId");
CREATE INDEX "response_brand_mention_projectId_mentionType_idx" ON "response_brand_mention"("projectId", "mentionType");
CREATE INDEX "response_brand_mention_competitorId_idx" ON "response_brand_mention"("competitorId");
CREATE INDEX "response_brand_mention_brandAliasId_idx" ON "response_brand_mention"("brandAliasId");
CREATE INDEX "citation_responseId_idx" ON "citation"("responseId");
CREATE INDEX "citation_sourceDomain_createdAt_idx" ON "citation"("sourceDomain", "createdAt");
CREATE INDEX "citation_publishedAt_idx" ON "citation"("publishedAt");
CREATE INDEX "kpi_snapshot_projectId_periodStart_periodEnd_idx" ON "kpi_snapshot"("projectId", "periodStart", "periodEnd");
CREATE INDEX "kpi_snapshot_projectId_model_periodStart_periodEnd_idx" ON "kpi_snapshot"("projectId", "model", "periodStart", "periodEnd");
CREATE INDEX "kpi_snapshot_projectId_promptId_periodStart_periodEnd_idx" ON "kpi_snapshot"("projectId", "promptId", "periodStart", "periodEnd");
CREATE INDEX "kpi_snapshot_projectId_competitorId_periodStart_periodEnd_idx" ON "kpi_snapshot"("projectId", "competitorId", "periodStart", "periodEnd");
CREATE INDEX "kpi_snapshot_projectId_sourceDomain_periodStart_periodEnd_idx" ON "kpi_snapshot"("projectId", "sourceDomain", "periodStart", "periodEnd");
CREATE INDEX "export_job_projectId_requestedAt_idx" ON "export_job"("projectId", "requestedAt");
CREATE INDEX "export_job_projectId_status_idx" ON "export_job"("projectId", "status");

-- Foreign keys
ALTER TABLE "project" ADD CONSTRAINT "project_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "brand_alias" ADD CONSTRAINT "brand_alias_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competitor" ADD CONSTRAINT "competitor_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tag" ADD CONSTRAINT "tag_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prompt" ADD CONSTRAINT "prompt_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prompt" ADD CONSTRAINT "prompt_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prompt_tag" ADD CONSTRAINT "prompt_tag_promptId_fkey"
  FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prompt_tag" ADD CONSTRAINT "prompt_tag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "run" ADD CONSTRAINT "run_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "run" ADD CONSTRAINT "run_promptId_fkey"
  FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "run" ADD CONSTRAINT "run_triggeredByUserId_fkey"
  FOREIGN KEY ("triggeredByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "response" ADD CONSTRAINT "response_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "response_brand_mention" ADD CONSTRAINT "response_brand_mention_responseId_fkey"
  FOREIGN KEY ("responseId") REFERENCES "response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "response_brand_mention" ADD CONSTRAINT "response_brand_mention_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "response_brand_mention" ADD CONSTRAINT "response_brand_mention_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "response_brand_mention" ADD CONSTRAINT "response_brand_mention_brandAliasId_fkey"
  FOREIGN KEY ("brandAliasId") REFERENCES "brand_alias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "citation" ADD CONSTRAINT "citation_responseId_fkey"
  FOREIGN KEY ("responseId") REFERENCES "response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kpi_snapshot" ADD CONSTRAINT "kpi_snapshot_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_snapshot" ADD CONSTRAINT "kpi_snapshot_promptId_fkey"
  FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_snapshot" ADD CONSTRAINT "kpi_snapshot_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "export_job" ADD CONSTRAINT "export_job_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "export_job" ADD CONSTRAINT "export_job_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
