-- host is now an optional override; NULL means "use runtimeConfig.isbjDefaultHost" (nuxt.config.ts,
-- overridable via NUXT_ISBJ_DEFAULT_HOST). A future ISBJ host change then needs no data migration.
ALTER TABLE "ClubISBJConfig" ALTER COLUMN "host" DROP DEFAULT;
ALTER TABLE "ClubISBJConfig" ALTER COLUMN "host" DROP NOT NULL;

-- Reset the old, no longer resolving host (ISBJ moved the Dienstschnittstelle, Trägerinformation 31.03.2026)
-- and explicit copies of the current default to NULL.
UPDATE "ClubISBJConfig"
SET "host" = NULL
WHERE "host" IN ('ds.traegerportal.isbj.verwalt-berlin.de', 'dienstschnittstelle.isbjp.itdz-berlin.de');
