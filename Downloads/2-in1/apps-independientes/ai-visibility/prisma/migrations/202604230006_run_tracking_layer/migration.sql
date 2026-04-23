-- AlterTable
ALTER TABLE "run"
ADD COLUMN "parser_version" TEXT,
ADD COLUMN "raw_request_metadata" JSONB,
ADD COLUMN "error_message" TEXT;
