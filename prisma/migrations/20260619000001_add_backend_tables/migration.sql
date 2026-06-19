-- CreateEnum
CREATE TYPE "public"."AuditSeverity" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."DataBackend" AS ENUM ('GOOGLE_SHEETS', 'POSTGRES');

-- CreateEnum
CREATE TYPE "public"."FileBackend" AS ENUM ('GOOGLE_DRIVE', 'S3');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "event" TEXT NOT NULL,
    "severity" "public"."AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ip" TEXT,
    "path" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "public"."AuditLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateTable
CREATE TABLE "public"."ClubDatabase" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "type" "public"."DataBackend" NOT NULL DEFAULT 'GOOGLE_SHEETS',
    "encryptedDsn" TEXT,
    "pendingEncryptedDsn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubDatabase_clubId_key" ON "public"."ClubDatabase"("clubId");

-- AddForeignKey
ALTER TABLE "public"."ClubDatabase" ADD CONSTRAINT "ClubDatabase_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."ClubFileStorage" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "type" "public"."FileBackend" NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "encryptedConfig" TEXT,
    "pendingEncryptedConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubFileStorage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubFileStorage_clubId_key" ON "public"."ClubFileStorage"("clubId");

-- AddForeignKey
ALTER TABLE "public"."ClubFileStorage" ADD CONSTRAINT "ClubFileStorage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
