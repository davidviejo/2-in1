ALTER TABLE "tag"
ADD COLUMN "description" TEXT,
ADD COLUMN "normalizedName" TEXT;

UPDATE "tag"
SET "normalizedName" = lower(trim(regexp_replace("name", '\\s+', ' ', 'g')))
WHERE "normalizedName" IS NULL;

ALTER TABLE "tag"
ALTER COLUMN "normalizedName" SET NOT NULL;

DROP INDEX IF EXISTS "tag_projectId_type_name_key";
DROP INDEX IF EXISTS "tag_projectId_type_idx";

ALTER TABLE "tag" DROP COLUMN IF EXISTS "type";

CREATE UNIQUE INDEX "tag_projectId_normalizedName_key" ON "tag"("projectId", "normalizedName");
CREATE INDEX "tag_projectId_normalizedName_idx" ON "tag"("projectId", "normalizedName");

DROP INDEX IF EXISTS "prompt_tag_tagId_idx";
CREATE INDEX "prompt_tag_tagId_promptId_idx" ON "prompt_tag"("tagId", "promptId");

DROP TYPE IF EXISTS "TagType";
