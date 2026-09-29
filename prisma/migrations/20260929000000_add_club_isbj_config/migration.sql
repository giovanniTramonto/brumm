-- Idempotent: production may already have these via `db push` or flatten_club_config.sql.

-- Club config columns (previously only created by the manual flatten_club_config.sql)
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "adminEmail" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "encryptedDsn" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "encryptedS3Config" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClubISBJConfig" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'ds.traegerportal.isbj.verwalt-berlin.de',
    "username" TEXT NOT NULL,
    "providerNumber" TEXT NOT NULL,
    "facilityNumber" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "encryptedCert" TEXT NOT NULL,
    "encryptedCertPass" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubISBJConfig_pkey" PRIMARY KEY ("id")
);

-- Rename legacy German column names if the table was created earlier via `db push`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'ClubISBJConfig' AND column_name = 'traegerNummer') THEN
    ALTER TABLE "ClubISBJConfig" RENAME COLUMN "traegerNummer" TO "providerNumber";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'ClubISBJConfig' AND column_name = 'einrichtungsNummer') THEN
    ALTER TABLE "ClubISBJConfig" RENAME COLUMN "einrichtungsNummer" TO "facilityNumber";
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClubISBJConfig_clubId_key" ON "ClubISBJConfig"("clubId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubISBJConfig_clubId_fkey') THEN
    ALTER TABLE "ClubISBJConfig" ADD CONSTRAINT "ClubISBJConfig_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
