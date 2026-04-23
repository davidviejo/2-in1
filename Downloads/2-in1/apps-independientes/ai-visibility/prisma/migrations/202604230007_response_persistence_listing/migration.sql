-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "response"
  ADD COLUMN "cleaned_text" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "mention_detected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mention_type" "BrandMentionType",
  ADD COLUMN "sentiment" TEXT,
  ADD COLUMN "status" "ResponseStatus" NOT NULL DEFAULT 'SUCCEEDED';

-- Optional backfill from legacy normalized_text when available
UPDATE "response"
SET "cleaned_text" = "normalized_text"
WHERE "normalized_text" IS NOT NULL AND "cleaned_text" IS NULL;

-- Drop legacy column
ALTER TABLE "response" DROP COLUMN "normalized_text";

-- Index for response list endpoint filters
CREATE INDEX "response_status_created_at_idx" ON "response"("status", "created_at");
CREATE INDEX "response_mention_detected_idx" ON "response"("mention_detected");
