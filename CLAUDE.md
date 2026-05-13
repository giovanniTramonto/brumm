# Brumm – CLAUDE.md

## Stack
- Nuxt 3 (Hybrid: SSG/SPA), Vue 3 + Composition API
- Pinia (State Management), TypeScript strict
- Reka UI + Tailwind CSS
- Prisma ORM + Neon (PostgreSQL)
- googleapis (Google Drive + Sheets), google-auth-library (OAuth 2.0)
- Resend (E-Mails), @paralleldrive/cuid2 (IDs)
- Biome (Formatter + Linter), Netlify (Hosting + Scheduled Functions)

## Projektsprache
- UI / Texte / Fehlermeldungen: **Deutsch**
- Code (Identifier, Kommentare, Variablen, Funktionen): **Englisch** — keine deutschen Wörter in Variablen-, Funktions- oder Typnamen (z.B. `isConfirmed` statt `isBestätigt`)

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
/ini/{slug}/addresses
/ini/{slug}/members
/ini/{slug}/members/create
/ini/{slug}/members/import
/ini/{slug}/members/{id}
/ini/{slug}/members/deactivate
/ini/{slug}/contract-templates
/ini/{slug}/groups
/ini/{slug}/management
/ini/{slug}/management/create
/ini/{slug}/management/{id}
/ini/{slug}/settings
/ini/{slug}/settings/delete
```
Der Slug `/ini` ist reserviert und kann nicht als Vereinsslug vergeben werden.

## Architektur
- **Multi-Tenant**: Jeder Verein hat einen eigenen Slug, alle Daten über `clubId` isoliert
- **Storage pro Verein**: Beim Onboarding verbindet der SUPERUSER seinen Google-Account via OAuth 2.0. Das OAuth-Token wird in `Club.oauthToken` (Neon) gespeichert. Kein globaler Service Account, kein GCP-Setup durch den Verein nötig.
- **Datentrennung**: Neon speichert ausschließlich technische/Auth-Daten (`id`, `clubId`, `role`, `isActive`, `storageId`). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, `phone1`, `phone2`, etc.) leben ausschließlich in Google Sheets
- **AuthUser-Anreicherung**: `me.get.ts` und `verify/[token].get.ts` reichern den zurückgegebenen User für MEMBER-Nutzer mit `firstName`/`lastName` aus den Mitgliederdaten an, damit diese im Auth-Store verfügbar sind
- **Vertragsunterlagen (DocumentTemplates)**: Typ `upload` (Eltern laden hoch) oder `read` (Eltern bestätigen gelesen). Aktive/abgemeldete Kinder sehen nur Vorlagen mit vorhandener Einreichung. „Gelesen markieren" ist einmalig und kopiert die Vorlagendatei in den Drive-Ordner des Kindes
- **Kind-Aktionen**: „Vertrag abmelden" (setzt `deactivatedAt`, nur aktive Kinder), „Abmeldung aufheben" (reaktiviert + sendet E-Mail), „Kind entfernen" (löscht Neon-Eintrag, Drive-Ordner und Sheets-Zeile)
- **storageId vs. storageRef**: In Neon wird nur die 8-stellige `storageId` (cuid2) gespeichert. Der vollständige `storageRef` (`YYYY-MM-DD-vorname-nachname_storageId`) existiert nur in Sheets und wird bei Bedarf daraus rekonstruiert
- **Dev-Fallback**: Solange `isSetupDone = false` werden Mitgliederdaten in `User.localData` (Neon JSON) zwischengespeichert. Nach dem Storage-Onboarding werden sie nach Sheets migriert und aus Neon gelöscht
- **Auth**: Magic Link (15 min) für SUPERUSER; Invite-Link (7 Tage) für Eltern. HttpOnly Cookie, max. 1 aktive Session pro User
- **Invite-Logik**: Beim Anlegen eines Kindes wird ein Invite erstellt und per E-Mail an die Erziehungsberechtigten gesendet. Ist eine der Guardian-E-Mails bereits als registrierter Nutzer im Verein bekannt, wird kein Invite verschickt (Opt-in nicht nötig).
- **Kind-Status**: `Ausstehend` (offener Invite), `Bestätigt` (Invite geklickt oder Elternteil bereits registriert, wartet auf SUPERUSER-Freischaltung), `Aktiv` (freigeschaltet), `Abgemeldet` (deaktiviert)
- **Magic-Link-Lookup**: 1. UserEmail in Neon (SUPERUSER), 2. Sheets `findUserIdByEmail` (wenn Setup fertig), 3. `localData`-Suche in Neon (Dev-Fallback)
- **Verify-Endpoint**: `/api/ini/{slug}/auth/verify/{token}` prüft zuerst `MagicLink`, dann `Invite` – ein Token-Typ reicht für beide Auth-Flows
- **MANAGER-Rolle**: Neon speichert für MANAGER nur technische Daten (`id`, `clubId`, `isMemberManager`). Persönliche Daten (Name, E-Mail) leben in Google Sheets unter `app/management/managers`. Dev-Fallback via `Manager.localData`. Lazy-Init: Ordner + Sheet werden beim ersten Manager automatisch angelegt, IDs in `Club.storageConfig` (`managementFolderId`, `managersSheetId`) gespeichert
- **canManageMembers**: `SUPERUSER` oder `MANAGER` mit `isMemberManager = true`. Nur diese dürfen Kinder anlegen, bearbeiten, aktivieren, deaktivieren, löschen und Einladungen verwalten. Frontend-Buttons und alle Member-API-Endpoints prüfen diese Bedingung

## Environment Variables
```
DATABASE_URL          # Neon Pooled Connection
DIRECT_URL            # Neon Direct Connection (für Migrationen)
RESEND_API_KEY        # Resend (plattformweiter E-Mail-Dienst)
EMAIL_FROM            # Absender-Adresse (z.B. "Brumm <noreply@example.com>")
ADMIN_SECRET          # Brumm Admin-Bereich (/admin)
APP_URL               # Basis-URL der App (z.B. http://localhost:3001)
GOOGLE_CLIENT_ID      # Google OAuth 2.0 Client ID
GOOGLE_CLIENT_SECRET  # Google OAuth 2.0 Client Secret
```

## Wichtige Pfade
| Bereich | Pfad |
|---|---|
| Prisma Schema | `prisma/schema.prisma` |
| Zod Schemas (API-Validierung) | `server/utils/schemas.ts` |
| Google Auth (OAuth) | `server/utils/googleAuth.ts` |
| Google OAuth Callback | `server/api/auth/google/callback.get.ts` |
| Mitgliederdaten (Sheets/localData) | `server/utils/memberData.ts` |
| Managerdaten (Sheets/localData) | `server/utils/managerData.ts` |
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
