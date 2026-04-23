ALTER TABLE "prompt"
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "intentClassification" TEXT;

UPDATE "prompt"
SET "country" = 'US'
WHERE "country" IS NULL OR "country" = '';

CREATE INDEX "prompt_projectId_isActive_priority_idx" ON "prompt"("projectId", "isActive", "priority");
