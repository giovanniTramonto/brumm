-- Add new columns first
ALTER TABLE "DocumentTemplate" ADD COLUMN "fileName" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "s3Key" TEXT;
ALTER TABLE "MemberDocument" ADD COLUMN "fileName" TEXT;
ALTER TABLE "MemberDocument" ADD COLUMN "s3Key" TEXT;
ALTER TABLE "Document" ADD COLUMN "fileName" TEXT;
ALTER TABLE "Document" ADD COLUMN "s3Key" TEXT;

-- Preserve data: copy driveFileName → fileName (DocumentTemplate)
UPDATE "DocumentTemplate" SET "fileName" = "driveFileName" WHERE "driveFileName" IS NOT NULL;

-- Preserve data: copy filename → fileName (MemberDocument)
UPDATE "MemberDocument" SET "fileName" = "filename" WHERE "filename" IS NOT NULL;

-- Drop old columns (driveFileId data intentionally discarded — Drive IDs are Drive-specific)
ALTER TABLE "DocumentTemplate" DROP COLUMN "driveFileId";
ALTER TABLE "DocumentTemplate" DROP COLUMN "driveFileName";
ALTER TABLE "MemberDocument" DROP COLUMN "driveFileId";
ALTER TABLE "MemberDocument" DROP COLUMN "filename";
ALTER TABLE "Document" DROP COLUMN "driveFileId";
