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
/                      → Globaler Login (Email-Lookup über alle Vereine)
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
- **Datentrennung**: Neon speichert ausschließlich technische/Auth-Daten (`id`, `clubId`, `role`, `isActive`, `storageId`, `hasSubmittedDocuments`). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, `phone1`, `phone2`, etc.) leben ausschließlich in Google Sheets
- **AuthUser-Anreicherung**: `me.get.ts` und `verify/[token].get.ts` reichern den zurückgegebenen User für MEMBER-Nutzer mit `firstName`/`lastName` aus den Mitgliederdaten an. `firstName` wird auf `guardian1Name` gesetzt (Name des Erziehungsberechtigten, nicht des Kindes), `lastName` auf `null`
- **MEMBER-Rolle**: Sieht den Nav-Eintrag „Kinder", hat gelb-gefärbten Hintergrund (`#ffdd76`). Dashboard zeigt für jedes eigene Kind einen statusbasierten Block (Ausstehend / Wartet auf Freischaltung / Aktiv / Abgemeldet). Auf der Kind-Detailseite sieht MEMBER dieselbe editierbare Form wie `canManageMembers` (alle Felder, inkl. Kontaktdaten). Stammdaten (Vorname, Nachname, Geburtsdatum) sind readonly sobald das Kind aktiv ist; Kontaktdaten (Guardian-Name, E-Mail, Telefon) bleiben immer editierbar. Der Update-Endpoint erlaubt MEMBER, die eigene `memberId` zu updaten (`isSelfUpdate`)
- **Globaler Login** (`/`): Email-Lookup über alle Vereine via `/api/login/lookup`. Sucht in: 1. UserEmail in Neon, 2. `User.localData` (Dev-Fallback), 3. Sheets aller Setup-fertigen Vereine parallel. Bei einem Treffer direkter Magic-Link-Versand, bei mehreren Treffern Vereinsauswahl
- **Vertragsunterlagen (DocumentTemplates/contract-templates)**: Typ `upload` (Eltern laden hoch) oder `read` (Eltern bestätigen gelesen). Aktive/abgemeldete Kinder sehen nur Vorlagen mit vorhandener Einreichung. „Als gelesen markieren" ist einmalig und kopiert die Vorlagendatei in den Drive-Ordner des Kindes. Sobald ein Kind aktiv ist, sind Vertragsunterlagen schreibgeschützt. Verwaltung der Vorlagen via `canManageMembers` (SUPERUSER + isMemberManager). URL: `/ini/{slug}/contract-templates`
- **Einreichen-Flow**: MEMBER klickt „Einreichen" sobald alle Vertragsunterlagen vollständig sind. `User.hasSubmittedDocuments` wird auf `true` gesetzt (Neon). Benachrichtigung geht an: MANAGERs mit `isMemberManager = true` (Emails aus Sheets), oder – falls keine solchen existieren – an den SUPERUSER.
- **Weitere Unterlagen**: Für aktive Kinder gibt es einen separaten Bereich „Weitere Unterlagen". Dateien landen in `documents/other/` im Drive-Ordner des Kindes. Sowohl MEMBER (Guardian) als auch `canManageMembers` dürfen Dateien hinzufügen und ersetzen.
- **Drive-Ordnerstruktur pro Kind**: `members/{storageRef}/documents/contract/` – Vertragsunterlagen; `members/{storageRef}/documents/other/` – weitere Unterlagen nach Aktivierung
- **Kind-Aktionen**: „Vertrag abmelden" (setzt `deactivatedAt`, nur aktive Kinder), „Abmeldung aufheben" (reaktiviert + sendet E-Mail), „Kind entfernen" (löscht Neon-Eintrag, Drive-Ordner, Sheets-Zeile und sendet E-Mail an beide Erziehungsberechtigten)
- **Kind-Status**: Neu angelegte Kinder sind nie automatisch aktiv (`isActive: false`). Reihenfolge: `Ausstehend` (offener Invite) → `Bestätigt` (Invite geklickt, wartet auf SUPERUSER-Freischaltung) → `Aktiv` (freigeschaltet) / `Abgemeldet` (deaktiviert)
- **storageId vs. storageRef**: In Neon wird nur die 8-stellige `storageId` (cuid2) gespeichert. Der vollständige `storageRef` (`YYYY-MM-DD-vorname-nachname_storageId`) existiert nur in Sheets und wird bei Bedarf daraus rekonstruiert
- **Dev-Fallback**: Solange `isSetupDone = false` werden Mitgliederdaten in `User.localData` (Neon JSON) zwischengespeichert. Nach dem Storage-Onboarding werden sie nach Sheets migriert und aus Neon gelöscht
- **Auth**: Magic Link (15 min) für SUPERUSER und MANAGER; Invite-Link (7 Tage) für Eltern. HttpOnly Cookie, max. 1 aktive Session pro User. Logout leitet auf `/ini/{slug}/login`
- **Invite-Logik**: Beim Anlegen eines Kindes wird ein Invite erstellt und per E-Mail an die Erziehungsberechtigten gesendet. Ist eine Guardian-Email identisch mit der des eingeloggten SUPERUSER, wird kein Invite für diese Email verschickt (kein Opt-in nötig, SUPERUSER ist bereits registriert)
- **Magic-Link-Lookup**: 1. UserEmail in Neon (deckt SUPERUSER und MANAGER ab), 2. Mastersheet `findUserIdByEmail` + Managers-Sheet `findManagerIdByEmail` parallel (wenn Setup fertig) – bei Manager-Treffer wird User via `storageId` gesucht und ggf. lazy angelegt, 3. `User.localData` + `Manager.localData`-Suche in Neon (Dev-Fallback). Existiert die userId nicht mehr in Neon, wird kein Link erzeugt (stilles Fehlschlagen)
- **Verify-Endpoint**: `/api/ini/{slug}/auth/verify/{token}` prüft zuerst `MagicLink`, dann `Invite` – ein Token-Typ reicht für beide Auth-Flows. MEMBER wird nach `/dashboard` weitergeleitet
- **Google OAuth Fehlerbehandlung**: `withGoogleErrorHandling` in `server/utils/googleAuth.ts` fängt `invalid_grant`-Fehler (abgelaufener Refresh-Token) und wirft einen 503 mit lesbarer Fehlermeldung. Alle Google-API-Aufrufe in `memberData.ts` sind damit gewrappt. Refresh-Token bei OAuth-Apps im Test-Modus laufen nach 7 Tagen ab → Google Cloud Console App publishen für dauerhaften Zugriff
- **MANAGER-Rolle**: Beim Anlegen eines Managers werden zwei Neon-Einträge erstellt: ein `Manager`-Record (`id`, `clubId`, `storageId`, `isMemberManager`) und ein `User`-Record (`role: MANAGER`, gleiche `storageId`). Beide teilen dieselbe `storageId` als Verknüpfung. Keine `UserEmail` in Neon – die E-Mail lebt ausschließlich in Sheets. Persönliche Daten (Name, E-Mail) leben in Google Sheets unter `app/management/managers`. Dev-Fallback via `Manager.localData`. Lazy-Init: Ordner + Sheet werden beim ersten Manager automatisch angelegt, IDs in `Club.storageConfig` (`managementFolderId`, `managersSheetId`) gespeichert. Beim Löschen eines Managers werden Manager-Record und User-Record (inkl. Sessions, MagicLinks) entfernt
- **canManageMembers**: `SUPERUSER` oder `MANAGER` mit `isMemberManager = true`. Nur diese dürfen Kinder anlegen, bearbeiten, aktivieren, deaktivieren, löschen, Einladungen verwalten und Vertragsvorlagen (`/contract-templates`) verwalten. Frontend-Buttons und alle Member-API-Endpoints sowie contract-template-Endpoints prüfen diese Bedingung
- **E-Mail-Benachrichtigungen**: Eltern erhalten E-Mails bei: Invite (Kind anlegen), Abmeldung aufheben, Kind entfernen, eigene E-Mail-Adresse geändert. `canManageMembers` erhält E-Mail wenn MEMBER Unterlagen einreicht (`sendDocumentsSubmittedNotification`)
- **E-Mail-Cascade**: Wird `email1` oder `email2` eines Kindes geändert, werden alle anderen Kinder im gleichen Verein mit derselben alten E-Mail automatisch mitaktualisiert. Damit bleibt der Guardian-Email-Filter in der Kinderliste konsistent (MEMBER sieht alle eigenen Kinder). Gilt sowohl für `canManageMembers`-Updates als auch für MEMBER-Selbst-Updates
- **Storage-Init**: `initUserStorage` schreibt nur noch Drive-Ordner und Einzel-Sheet (kein Master-Sheet-Write mehr). Der Master-Sheet-Eintrag wird ausschließlich über `saveMemberData` geschrieben, um Duplikate zu vermeiden

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
