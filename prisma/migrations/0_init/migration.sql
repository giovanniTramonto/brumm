-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AuditSeverity" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."DataBackend" AS ENUM ('GOOGLE_SHEETS', 'POSTGRES');

-- CreateEnum
CREATE TYPE "public"."FileBackend" AS ENUM ('GOOGLE_DRIVE', 'S3');

-- CreateEnum
CREATE TYPE "public"."MemberStatus" AS ENUM ('PENDING_INVITE', 'REGISTERED', 'ACTIVE', 'INACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPERUSER', 'TEAM', 'MEMBER', 'MANAGER');

-- CreateEnum
CREATE TYPE "public"."Storage" AS ENUM ('GOOGLE_DRIVE', 'S3', 'R2');

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

-- CreateTable
CREATE TABLE "public"."Club" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageType" "public"."Storage",
    "storageConfig" JSONB,
    "oauthToken" JSONB,
    "isSetupDone" BOOLEAN NOT NULL DEFAULT false,
    "membershipFee" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Document" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'document',
    "url" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentTemplate" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "documentType" TEXT,
    "driveFileId" TEXT,
    "driveFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MagicLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingPinHash" TEXT,
    "pendingDeviceTokenToDelete" TEXT,
    "otpCode" TEXT,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Manager" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "storageId" TEXT NOT NULL,
    "isMemberManager" BOOLEAN NOT NULL DEFAULT false,
    "localData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberDocument" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "driveFileId" TEXT,
    "filename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MemberDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "storageId" TEXT NOT NULL,
    "localData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."MemberStatus" NOT NULL DEFAULT 'REGISTERED',
    "storageId" TEXT,
    "localData" JSONB,
    "isMemberManager" BOOLEAN NOT NULL DEFAULT false,
    "hasSubmittedDocuments" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "public"."AuditLog"("clubId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "public"."Club"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClubDatabase_clubId_key" ON "public"."ClubDatabase"("clubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClubFileStorage_clubId_key" ON "public"."ClubFileStorage"("clubId" ASC);

-- CreateIndex
CREATE INDEX "DeviceSession_deviceId_clubId_idx" ON "public"."DeviceSession"("deviceId" ASC, "clubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_deviceToken_key" ON "public"."DeviceSession"("deviceToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_clubId_ref_key" ON "public"."DocumentTemplate"("clubId" ASC, "ref" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "public"."Invite"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_token_key" ON "public"."MagicLink"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Manager_storageId_clubId_key" ON "public"."Manager"("storageId" ASC, "clubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MemberDocument_memberId_templateId_key" ON "public"."MemberDocument"("memberId" ASC, "templateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Team_storageId_clubId_key" ON "public"."Team"("storageId" ASC, "clubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_storageId_clubId_key" ON "public"."User"("storageId" ASC, "clubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserEmail_email_key" ON "public"."UserEmail"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."ClubDatabase" ADD CONSTRAINT "ClubDatabase_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClubFileStorage" ADD CONSTRAINT "ClubFileStorage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceSession" ADD CONSTRAINT "DeviceSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MagicLink" ADD CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Manager" ADD CONSTRAINT "Manager_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberDocument" ADD CONSTRAINT "MemberDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberDocument" ADD CONSTRAINT "MemberDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserEmail" ADD CONSTRAINT "UserEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

