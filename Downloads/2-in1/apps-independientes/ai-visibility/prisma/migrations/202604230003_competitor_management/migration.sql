-- Normalize existing domains and backfill required fields
UPDATE "competitor"
SET "domain" = lower(trim("domain"))
WHERE "domain" IS NOT NULL;

UPDATE "competitor"
SET "domain" = CONCAT('unknown-', "id", '.invalid')
WHERE "domain" IS NULL OR "domain" = '';

-- Add competitor aliases and chart color defaults
ALTER TABLE "competitor"
  ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "chartColor" TEXT NOT NULL DEFAULT '#1d4ed8';

-- Enforce required domain and uniqueness per project
ALTER TABLE "competitor"
  ALTER COLUMN "domain" SET NOT NULL;

CREATE UNIQUE INDEX "competitor_projectId_domain_key" ON "competitor"("projectId", "domain");
