-- Migration: Flatten ClubDatabase, ClubFileStorage, UserEmail into Club
-- Run this against the production DB BEFORE deploying the new code.
-- Safe to run multiple times (idempotent).

-- 1. Add new columns to Club (if not already present)
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "adminEmail"       TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "encryptedDsn"     TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "encryptedS3Config" TEXT;

-- 2. Copy admin email from UserEmail (primary email of SUPERUSER per club)
UPDATE "Club" c
SET "adminEmail" = (
  SELECT ue.email
  FROM "UserEmail" ue
  JOIN "User" u ON u.id = ue."userId"
  WHERE u."clubId" = c.id
    AND u.role = 'SUPERUSER'
    AND ue."isPrimary" = true
  LIMIT 1
)
WHERE "adminEmail" IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserEmail');

-- Fallback: non-primary email if no primary was set
UPDATE "Club" c
SET "adminEmail" = (
  SELECT ue.email
  FROM "UserEmail" ue
  JOIN "User" u ON u.id = ue."userId"
  WHERE u."clubId" = c.id
    AND u.role = 'SUPERUSER'
  LIMIT 1
)
WHERE "adminEmail" IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserEmail');

-- 3. Copy encryptedDsn from ClubDatabase
UPDATE "Club" c
SET "encryptedDsn" = (
  SELECT cd."encryptedDsn"
  FROM "ClubDatabase" cd
  WHERE cd."clubId" = c.id
    AND cd."encryptedDsn" IS NOT NULL
  LIMIT 1
)
WHERE "encryptedDsn" IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ClubDatabase');

-- 4. Copy encryptedConfig (S3) from ClubFileStorage
UPDATE "Club" c
SET "encryptedS3Config" = (
  SELECT cfs."encryptedConfig"
  FROM "ClubFileStorage" cfs
  WHERE cfs."clubId" = c.id
    AND cfs."encryptedConfig" IS NOT NULL
  LIMIT 1
)
WHERE "encryptedS3Config" IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ClubFileStorage');

-- 5. Drop old tables (order: FK-dependencies first)
DROP TABLE IF EXISTS "UserEmail";
DROP TABLE IF EXISTS "ClubDatabase";
DROP TABLE IF EXISTS "ClubFileStorage";

-- 6. Drop old enums (if present)
DROP TYPE IF EXISTS "DataBackend";
DROP TYPE IF EXISTS "FileBackend";

-- 7. Drop old columns on Club that were removed with Google integration
ALTER TABLE "Club" DROP COLUMN IF EXISTS "oauthToken";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "storageConfig";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "storageType";
