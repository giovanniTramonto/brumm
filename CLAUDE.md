# Jita – CLAUDE.md

## Stack
- Nuxt 3 (Hybrid: SSG/SPA), Vue 3 + Composition API
- Pinia (State Management), TypeScript strict
- Reka UI + Tailwind CSS
- Prisma ORM + Neon (PostgreSQL)
- googleapis (Google Drive + Sheets), google-auth-library (Service Account)
- Resend (E-Mails), @paralleldrive/cuid2 (IDs)
- Biome (Formatter + Linter), Netlify (Hosting + Scheduled Functions)

## Projektsprache
- UI / Texte / Fehlermeldungen: **Deutsch**
- Code (Identifier, Kommentare, Variablen, Funktionen): **Englisch**

## Code Style
- Formatter & Linter: Biome (`npm run lint`, `npm run lint:fix`)
- Boolean state: `is*` prefix (isActive, isLoading)
- Event handler: `on*` prefix (onSubmit, onDelete)
- Funktionen: verb-first (createMember, fetchMembers)
- Vue templates: props immer camelCase

## URL-Struktur
```
/register
/admin
/ini/{slug}/login
/ini/{slug}/onboarding
/ini/{slug}/dashboard
/ini/{slug}/members
/ini/{slug}/members/create
/ini/{slug}/members/import
/ini/{slug}/members/{id}
/ini/{slug}/members/deactivate
/ini/{slug}/groups
/ini/{slug}/settings
/ini/{slug}/settings/delete
```
Der Slug `/ini` ist reserviert und kann nicht als Vereinsslug vergeben werden.

## Architektur
- **Multi-Tenant**: Jeder Verein hat einen eigenen Slug, alle Daten über `clubId` isoliert
- **Storage pro Verein**: Google Drive-Credentials werden beim Onboarding eingegeben und in `Club.storageConfig` (Neon) gespeichert – kein globaler Service Account
- **Datentrennung**: Neon speichert ausschließlich technische/Auth-Daten (`id`, `clubId`, `role`, `isActive`, `storageId`). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, etc.) leben ausschließlich in Google Sheets
- **storageId vs. storageRef**: In Neon wird nur die 8-stellige `storageId` (cuid2) gespeichert. Der vollständige `storageRef` (`YYYY-MM-DD-vorname-nachname_storageId`) existiert nur in Sheets und wird bei Bedarf daraus rekonstruiert
- **Dev-Fallback**: Solange `isSetupDone = false` werden Mitgliederdaten in `User.localData` (Neon JSON) zwischengespeichert. Nach dem Storage-Onboarding werden sie nach Sheets migriert und aus Neon gelöscht
- **Auth**: Magic Link (15 min), HttpOnly Cookie, max. 1 aktive Session pro User
- **Magic-Link-Lookup**: 1. UserEmail in Neon (SUPERUSER), 2. Sheets `findUserIdByEmail` (wenn Setup fertig), 3. `localData`-Suche in Neon (Dev-Fallback)

## Environment Variables
```
DATABASE_URL     # Neon Pooled Connection
DIRECT_URL       # Neon Direct Connection (für Migrationen)
RESEND_API_KEY   # Resend (plattformweiter E-Mail-Dienst)
ADMIN_SECRET     # Jita Admin-Bereich (/admin)
```

## Wichtige Pfade
| Bereich | Pfad |
|---|---|
| Prisma Schema | `prisma/schema.prisma` |
| Zod Schemas (API-Validierung) | `server/utils/schemas.ts` |
| Google Auth | `server/utils/googleAuth.ts` |
| Mitgliederdaten (Sheets/localData) | `server/utils/memberData.ts` |
| Storage Utils | `server/utils/storage/` |
| E-Mail Utils | `server/utils/email.ts` |
| Server Middleware | `server/middleware/` |
| API Routes | `server/api/` |
| Pinia Stores | `stores/` |
| Types | `types/` |
| Netlify Cleanup | `netlify/functions/cleanup.ts` |

## Datenbank
```bash
npm run db:push      # Schema auf Neon pushen (dev)
npm run db:migrate   # Migration erstellen
npm run db:generate  # Prisma Client generieren
```

## Dev
```bash
npm install
npm run dev
```
