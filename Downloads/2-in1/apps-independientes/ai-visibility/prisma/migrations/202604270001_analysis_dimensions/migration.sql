-- AlterTable
ALTER TABLE "run"
ADD COLUMN "surface" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "analysis_mode" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "capture_method" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "country" TEXT,
ADD COLUMN "language" TEXT;

-- Backfill from existing data patterns
UPDATE "run"
SET "analysis_mode" = CASE
  WHEN LOWER("provider") = 'openai' THEN 'chatgpt'
  WHEN LOWER("provider") = 'google' AND LOWER("model") LIKE '%gemini%' THEN 'gemini'
  WHEN LOWER("provider") = 'google' AND LOWER("model") LIKE '%overview%' THEN 'ai_overview'
  WHEN LOWER("provider") = 'google' AND LOWER("model") LIKE '%ai mode%' THEN 'ai_mode'
  ELSE 'other'
END
WHERE "analysis_mode" = 'other';

UPDATE "run"
SET "surface" = CASE
  WHEN "analysis_mode" = 'chatgpt' THEN 'chatgpt'
  WHEN "analysis_mode" = 'gemini' THEN 'gemini'
  WHEN "analysis_mode" IN ('ai_mode', 'ai_overview') THEN 'google_search'
  ELSE 'other'
END
WHERE "surface" = 'other';

CREATE INDEX "run_project_id_analysis_mode_executed_at_idx" ON "run"("project_id", "analysis_mode", "executed_at");
CREATE INDEX "run_project_id_provider_surface_executed_at_idx" ON "run"("project_id", "provider", "surface", "executed_at");
