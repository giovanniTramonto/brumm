# Brumm – CLAUDE.md

## Stack
- Nuxt 3 (SPA, `ssr: false`; nur `/register` vorgerendert), Vue 3 + Composition API
- Pinia (State Management), TypeScript strict
- Reka UI + Tailwind CSS
- Prisma ORM + Neon (PostgreSQL)
- googleapis (Google Drive + Sheets), google-auth-library (OAuth 2.0)
- Resend (E-Mails), @paralleldrive/cuid2 (IDs)
- Biome (Formatter + Linter), Lefthook (Git Hooks), Netlify (Hosting + Scheduled Functions)

## Projektsprache
- UI / Texte / Fehlermeldungen: **Deutsch**
- Code (Identifier, Kommentare, Variablen, Funktionen): **Englisch** — keine deutschen Wörter in Variablen-, Funktions- oder Typnamen (z.B. `isConfirmed` statt `isBestätigt`)

## Code Style
- Formatter & Linter: Biome (`npm run lint`, `npm run lint:fix`)
- Boolean state: `is*` prefix (isLoading, isSubmitting)
- Event handler: `on*` prefix (onSubmit, onDelete)
- Funktionen: verb-first (createMember, fetchMembers)
- Vue templates: props immer camelCase
- Tailwind Breakpoints: `tablet` (768px), `desktop` (1024px) — in `tailwind.config.ts` unter `theme.extend.screens` definiert

## URL-Struktur
```
/                      → Landing Page (Hallo bei Brumm, Links zu Login/Register)
/login                 → Globaler Login (Kita-Auswahl per Dropdown)
/register
/admin
/login/{slug}
/ini/{slug}/settings/onboarding
/ini/{slug}/dashboard
/ini/{slug}/addresses
/ini/{slug}/members
/ini/{slug}/members/create
/ini/{slug}/members/{id}
/ini/{slug}/members/deactivate
/ini/{slug}/contract-templates
/ini/{slug}/groups
/ini/{slug}/groups/create
/ini/{slug}/groups/{id}
/ini/{slug}/managers
/ini/{slug}/managers/create
/ini/{slug}/managers/{id}
/ini/{slug}/calculations
/ini/{slug}/settings
/ini/{slug}/settings/delete
```
Der Slug `/ini` ist reserviert und kann nicht als Vereinsslug vergeben werden.

## Architektur
- **Multi-Tenant**: Jeder Verein hat einen eigenen Slug, alle Daten über `clubId` isoliert
- **Storage pro Verein**: Beim Onboarding verbindet der SUPERUSER seinen Google-Account via OAuth 2.0 und gibt die **ID einer Geteilten Ablage** (Pflichtfeld) ein. Alle Vereinsdaten werden ausschließlich in dieser Geteilten Ablage angelegt. Das OAuth-Token wird in `Club.oauthToken` (Neon) gespeichert. Kein globaler Service Account, kein GCP-Setup durch den Verein nötig. Die Shared Drive ID wird als `parentId` durch den OAuth-State (`/api/ini/{slug}/auth/google` → Callback → `setupClubStorage` → `createRootFolderStructure`) durchgereicht.
- **Datentrennung**: Neon speichert technische/Auth-Daten (`id`, `clubId`, `role`, `status`, `storageId`, `deactivatedAt`, `hasSubmittedDocuments`) sowie Vereins-Konfiguration (`membershipFee`). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, `phone1`, `phone2`, `groupId`, `surcharges`, `careType`, `contractEnd`, etc.) leben ausschließlich in Google Sheets. Sheets-Spalten: A=userId, B=storageRef, C=firstName, D=lastName, E=birthDate, F=guardian1Name, G=guardian2Name, H=email1, I=email2, J=groupId, K=contractEnd, L=phone1, M=phone2, N=surcharges, O=careType, P=lastEditedAt, Q=lastEditedBy
- **AuthUser-Anreicherung**: `me.get.ts` und `verify/[token].get.ts` reichern den zurückgegebenen User für MEMBER-Nutzer mit `firstName`/`lastName` aus den Mitgliederdaten an. `firstName` wird auf `guardian1Name` gesetzt (Name des Erziehungsberechtigten, nicht des Kindes), `lastName` auf `null`
- **MEMBER-Rolle**: Sieht den Nav-Eintrag „Kinder", hat gelb-gefärbten Hintergrund (`#ffdd76`). Dashboard zeigt für jedes eigene Kind einen statusbasierten Block (Ausstehend / Wartet auf Freischaltung / Aktiv / Abgemeldet). Auf der Kind-Detailseite sieht MEMBER dieselbe editierbare Form wie `canManageMembers` (alle Felder, inkl. Kontaktdaten). Ab Freischaltung (`status === 'ACTIVE' || 'INACTIVE'`) ist das gesamte Formular für MEMBER readonly (`memberFormReadonly`); der Speichern-Button wird ausgeblendet. Der Update-Endpoint erlaubt MEMBER, die eigene `memberId` zu updaten (`isSelfUpdate`)
- **Globaler Login** (`/login`): Zeigt ein Dropdown aller setup-fertigen Kitas (`GET /api/clubs`, public). Nach Auswahl wird auf `/login/{slug}` weitergeleitet. Kein Drive-Zugriff auf dieser Seite. `/login/{slug}` ist die vereinsspezifische Anmeldeseite (Magic Link per E-Mail, 15 min)
- **Vertragsunterlagen (DocumentTemplates/contract-templates)**: Drei Typen: `read` (Nur lesen — Eltern bestätigen gelesen), `upload` (Ausfüllen — Vorlage herunterladen, ausfüllen, hochladen), `submit` (Einreichen — beliebiges Dokument hochladen, keine Vorlage nötig). Aktive/abgemeldete Kinder sehen nur Vorlagen mit vorhandener Einreichung. „Als gelesen markieren" ist einmalig und kopiert die Vorlagendatei in den Drive-Ordner des Kindes. Sobald ein Kind aktiv ist, sind Vertragsunterlagen schreibgeschützt (kein Löschen mehr möglich). Vor der Freischaltung können Dateien im Kein-Invite-Workflow gelöscht werden (`DELETE /api/ini/{slug}/members/{id}/documents/{fileId}`, nur `canManageMembers`). Verwaltung der Vorlagen via `canManageMembers` (SUPERUSER + isMemberManager). URL: `/ini/{slug}/contract-templates`. Datei-Upload: max. 5 MB (konfiguriert in `utils/config.ts` als `MAX_UPLOAD_SIZE_BYTES`/`MAX_UPLOAD_SIZE_LABEL`, clientseitig und serverseitig geprüft). Hochgeladener Dateiname wird neben dem Upload-Button angezeigt.
- **Einreichen-Flow**: MEMBER klickt „Einreichen" sobald alle Vertragsunterlagen vollständig sind. `User.hasSubmittedDocuments` wird auf `true` gesetzt (Neon). Benachrichtigung geht an: MANAGERs mit `isMemberManager = true` (Emails aus Sheets), oder – falls keine solchen existieren – an den SUPERUSER. Der „Freischalten"-Button ist erst aktiv wenn `hasSubmittedDocuments = true` (und `member.hasInvite = true`); neben dem Titel „Vertragsunterlagen" erscheint ein „Noch nicht eingereicht"-Hinweis solange noch nicht eingereicht wurde. Im **Kein-Invite-Workflow** ist „Freischalten" immer aktiv (unabhängig von `hasSubmittedDocuments`).
- **Kein-Invite-Workflow**: Wird ein Kind ohne Einladung angelegt (`sendInvite = false`), ist `member.hasInvite = false`. Auf der Detailseite zeigt `canManageMembers` statt der Template-Liste direkt ein Upload-Interface (`documents/contract/`). Es erscheint kein „Noch nicht eingereicht"-Hinweis. „Freischalten" ist sofort aktiv. Nach dem Freischalten wird `member.hasInvite` lokal auf `true` gesetzt; direkt hochgeladene Dateien bleiben über `filteredDocuments` sichtbar.
- **filteredDocuments**: Computed in `pages/ini/[slug]/members/[id]/index.vue` — Drive-Dateien aus `documents/`, die nicht bereits als Template-Einreichung (`MemberDocument.driveFileId`) erfasst sind. Wird in der `canManageMembers`-Sektion nur angezeigt wenn `member.status === 'REGISTERED' && member.hasInvite` (verhindert Doppeldarstellung nach Freischaltung, da der ACTIVE-Block ohnehin alle Dokumente zeigt).
- **isOwnChild**: Wird vom GET-Endpoint berechnet: `true` wenn eine Guardian-Email des Kindes mit der Email des eingeloggten SUPERUSER übereinstimmt. Ermöglicht im `canManageMembers`-Template-Block die Upload- und „Als gelesen markieren"-Buttons, so als wäre der SUPERUSER selbst MEMBER.
- **Confirm-Dialoge**: Kind anlegen mit Invite → „Kind anlegen und Einladung senden?"; Speichern mit geänderter E-Mail → „Die E-Mail-Adresse wurde geändert. [...] Speichern und E-Mail-Hinweis versenden?"; Freischalten → „[Name] freischalten? Die Erziehungsberechtigten erhalten eine Bestätigungs-E-Mail."; Abmelden → „Kind abmelden?"; Löschen / Kind entfernen → „Kind wirklich dauerhaft entfernen? Die Eltern erhalten eine E-Mail."; Datei löschen → „Datei unwiderruflich löschen?"
- **Weitere Unterlagen**: Für aktive Kinder gibt es einen separaten Bereich „Weitere Unterlagen". Dateien landen in `documents/other/` im Drive-Ordner des Kindes. Sowohl MEMBER (Guardian) als auch `canManageMembers` dürfen Dateien hinzufügen, ersetzen und löschen (`DELETE /api/ini/{slug}/members/{id}/documents/other/{fileId}` — Guardian oder `canManageMembers` berechtigt). Der Fehler beim „Ändern" einer einzelnen Datei wird per-file angezeigt (`otherReplaceError`/`otherReplaceErrorFileId`), der Fehler beim „Datei hinzufügen" inline unter dem Button.
- **Drive-Ordnerstruktur**: Stammverzeichnis heißt immer `brumm/` (unabhängig vom Vereinsslug). Darunter: `brumm/contract-templates/` (Vertragsvorlagen, wird beim Onboarding angelegt), `brumm/managers/` (Lazy-Init, enthält `managers`-Sheet), `brumm/groups/` (Lazy-Init, enthält `groups`-Sheet) und `brumm/members/` (enthält `members`-Sheet sowie pro Kind einen Ordner `{storageRef}/documents/contract/` – Vertragsunterlagen und `{storageRef}/documents/other/` – weitere Unterlagen nach Aktivierung). `GoogleDriveConfig` speichert: `rootFolderId`, `membersFolderId`, `membersSheetId`, `templatesFolderId`, optional `managersFolderId` + `managersSheetId` + `groupsFolderId` + `groupsSheetId`
- **Kind-Aktionen**: Für aktive Kinder (`status = ACTIVE | INACTIVE`) zeigen sich zwei Buttons: „Deaktivieren/Aktivieren" (togglet zwischen `ACTIVE` ↔ `INACTIVE` in Neon, kein E-Mail-Versand) und „Abmelden" (setzt `status = DEACTIVATED` + `deactivatedAt` in Neon, löscht Sessions, kein E-Mail-Versand). Für abgemeldete Kinder: „Abmeldung rückgängig" (setzt `status = ACTIVE`, löscht `deactivatedAt`, kein E-Mail) und „Löschen" (löscht alle Neon-Einträge, Drive-Ordner, Sheets-Zeile + sendet E-Mail an beide Erziehungsberechtigten). Für noch nicht freigeschaltete Kinder (`status = PENDING_INVITE | REGISTERED`): „Freischalten" + „Kind entfernen" (wie „Löschen").
- **Zuschläge**: Jedes Kind kann mehrere Zuschläge tragen (`surcharges: string[]`, gespeichert als kommaseparierter String in Sheets-Spalte N). Aktuell verfügbare Schlüssel: `ndhs`. Neue Zuschläge werden in `SURCHARGE_OPTIONS` in `pages/ini/[slug]/members/[id]/index.vue` ergänzt — keine Schema-Änderung nötig. Nur `canManageMembers` kann Zuschläge bearbeiten.
- **Betreuungsumfang (careType)**: Pflichtfeld für die Kostenerstattungsberechnung. Gespeichert als String-Key in Sheets-Spalte O. Mögliche Werte: `full_extended`, `full`, `part`, `half_with_meal`, `half_without_meal`. Nur `canManageMembers` kann den Betreuungsumfang setzen. Aktive Kinder ohne `careType` erhalten in der Kinderliste einen Warnhinweis.
- **Vertragsende (contractEnd)**: Gespeichert in Sheets-Spalte K als Jahreszahl (z.B. `"2026"`). Das Vertragsjahr endet jeweils am 31. Juli — ein Kind mit `contractEnd = "2026"` wird ab August 2026 aus allen Berechnungen ausgeschlossen (`isContractActive()` in `utils/reimbursement.ts`). Wird in der Kinderliste als eigene Spalte angezeigt (alle Rollen).
- **Letzte Änderung (lastEditedAt / lastEditedBy)**: Werden bei jedem Speichern server-seitig in `updateMemberData` gesetzt und in Sheets-Spalten P/Q geschrieben. Editorname wird aufgelöst nach Rolle: MEMBER → `guardian1Name`, MANAGER → Name aus Sheets, SUPERUSER → `"Admin"`. Wird auf der Kind-Detailseite in einer `FootnoteCard` angezeigt.
- **FootnoteCard**: Wiederverwendbare Komponente (`components/FootnoteCard.vue`) mit Content-Slot. Passt Border- und Textfarbe automatisch an die Hintergrundfarbe des eingeloggten Users an (`border-ini-300/text-ini-800` für normale Rollen, `border-member-300/text-member-800` für MEMBER). Tailwind-Palette `member` hat Abstufungen 200/300/500/700/800.
- **Rechnung-Seite** (`/calculations`): Nur für SUPERUSER und MANAGER. Monats- und Jahresansicht. Berechnet Einnahmen (Kostenerstattung nach KitaFöG-Sätzen + ndH-Zuschlag + Mitgliedsbeiträge) und Personalschlüssel (Betreuungsstunden, Min. Fachstunden, Max. Quereinsteiger, Vorstandsstunden) auf Basis der aktiven Kinder. Mitgliedsbeitrag wird als `Club.membershipFee` in Neon gespeichert (PATCH `/api/ini/{slug}/settings/membership-fee`). Berechnungslogik und Ratentabellen in `utils/reimbursement.ts`. Quellenangabe: Roland Kern, DaKS e.V.
- **Gruppen**: Werden in Google Sheets gespeichert (Lazy-Init wie Manager: `brumm/groups/` Ordner + Sheet mit Spalten `groupId`, `name`, `email`). `server/utils/groupData.ts` stellt `getAllGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup` bereit. SUPERUSER kann Gruppen anlegen, bearbeiten und löschen (`/ini/{slug}/groups`). Die `groupId` eines Kindes wird im Members-Sheet gespeichert; bei der Kinderliste wird die Gruppe per `groupMap` aus dem Groups-Sheet angereichert. Nur SUPERUSER hat Zugriff auf die Gruppen-Verwaltung.
- **Kind-Status**: Modelliert als `MemberStatus`-Enum in Neon (`User.status`). Reihenfolge: `PENDING_INVITE` (offener Invite, UI: „Ausstehend") → `REGISTERED` (Invite geklickt oder Superuser ist Guardian, UI: „Bestätigt") → `ACTIVE` (freigeschaltet, UI: „Aktiv") / `INACTIVE` (temporär deaktiviert, reversibel, UI: „Inaktiv") / `DEACTIVATED` (`deactivatedAt` gesetzt in Neon, UI: „Abgemeldet" — automatische Löschung nach 1 Jahr). Erlaubte Übergänge sind zentral in `server/utils/memberStatus.ts` (`assertValidTransition`) definiert. `INACTIVE` und `DEACTIVATED` sind von der Kostenerstattungs- und Personalschlüssel-Berechnung ausgeschlossen.
- **storageId vs. storageRef**: In Neon wird nur die 8-stellige `storageId` (cuid2) gespeichert. Der vollständige `storageRef` (`YYYY-MM-DD-vorname-nachname_storageId`) existiert nur in Sheets und wird bei Bedarf daraus rekonstruiert
- **Dev-Fallback**: Solange `isSetupDone = false` werden Mitgliederdaten in `User.localData` (Neon JSON) zwischengespeichert. Nach dem Storage-Onboarding werden sie nach Sheets migriert und aus Neon gelöscht
- **Auth**: Magic Link (15 min) für SUPERUSER und MANAGER; Invite-Link (7 Tage) für Eltern. HttpOnly Cookie, max. 1 aktive Session pro User. Logout leitet auf `/login/{slug}`
- **Invite-Logik**: Beim Anlegen eines Kindes kann `canManageMembers` per Checkbox „Einladung senden" (default: aktiv) steuern, ob ein Invite-Link per E-Mail verschickt wird. Ist mindestens eine Guardian-Email identisch mit der Email des eingeloggten SUPERUSER (`hasSuperUserEmail`), wird sofort ein Invite mit `isUsed: true` erstellt → Kind startet mit `status = REGISTERED`. Ohne `hasSuperUserEmail` und mit aktivem `sendInvite` startet das Kind mit `status = PENDING_INVITE`. Beim Klick auf den Invite-Link setzt `verify/[token].get.ts` den Status auf `REGISTERED`. `parentAlreadyRegistered` wird nur gegen `inviteEmails` (nicht-Superuser-Emails) geprüft. `Member.hasInvite` (API-Feld, aus Neon `Invite`-Tabelle: `!!anyInvite`) zeigt ob je ein Invite für dieses Kind erstellt wurde — steuert welcher Workflow auf der Detailseite greift (Template-Liste vs. Direkt-Upload)
- **Magic-Link-Lookup**: 1. UserEmail in Neon (deckt SUPERUSER und MANAGER ab), 2. Members-Sheet `findUserIdByEmail` + Managers-Sheet `findManagerIdByEmail` parallel (wenn Setup fertig) – bei Manager-Treffer wird User via `storageId` gesucht und ggf. lazy angelegt, 3. `User.localData` + `Manager.localData`-Suche in Neon (Dev-Fallback). Existiert die userId nicht mehr in Neon, wird kein Link erzeugt (stilles Fehlschlagen)
- **Verify-Endpoint**: `/api/ini/{slug}/auth/verify/{token}` prüft zuerst `MagicLink`, dann `Invite` – ein Token-Typ reicht für beide Auth-Flows. MEMBER wird nach `/dashboard` weitergeleitet
- **Blattschutz**: Alle Sheets (members, managers, groups) erhalten beim Anlegen automatisch einen `warningOnly`-Blattschutz via `protectSheet` in `server/utils/googleAuth.ts`. API-Schreibzugriffe laufen trotzdem durch; nur manuelle Edits in der Sheets-UI zeigen eine Warnung. Beim Reconnect wird der Schutz auf alle vorhandenen Sheets gesetzt (idempotent: „already has sheet protection"-Fehler wird ignoriert). Nachträgliche Anwendung auf bestehende Clubs: `POST /api/admin/protect-sheets`.
- **Google OAuth Fehlerbehandlung**: `withGoogleErrorHandling` in `server/utils/googleAuth.ts` fängt `invalid_grant`-Fehler (abgelaufener Refresh-Token) und wirft einen 503 mit lesbarer Fehlermeldung. Alle Google-API-Aufrufe in `memberData.ts` sind damit gewrappt. Refresh-Token bei OAuth-Apps im Test-Modus laufen nach 7 Tagen ab → Google Cloud Console App publishen für dauerhaften Zugriff
- **Google Drive nicht erreichbar**: Sheet-Funktionen (`getAllMembersFromSheet`, `getMemberFromSheet`, `findUserIdByEmail`) fangen Google-404-Fehler sowie `Missing required parameters: spreadsheetId` (Sheet-ID fehlt in Config) ab und werfen einen 503 „Die Google-Ablage wurde nicht gefunden." mit der Original-Google-Fehlermeldung als `message`. Die Members-Liste zeigt diesen Fehler als roten Block an statt die Seite zu crashen — Navigation zu Einstellungen → Verein löschen bleibt erreichbar
- **MANAGER-Rolle**: Beim Anlegen eines Managers werden zwei Neon-Einträge erstellt: ein `Manager`-Record (`id`, `clubId`, `storageId`, `isMemberManager`) und ein `User`-Record (`role: MANAGER`, gleiche `storageId`). Beide teilen dieselbe `storageId` als Verknüpfung. Keine `UserEmail` in Neon – die E-Mail lebt ausschließlich in Sheets. Persönliche Daten (Name, E-Mail) leben in Google Sheets unter `brumm/managers/`. Dev-Fallback via `Manager.localData`. Lazy-Init: Ordner + Sheet werden beim ersten Manager automatisch angelegt, IDs in `Club.storageConfig` (`managersFolderId`, `managersSheetId`) gespeichert. Beim Löschen eines Managers werden Manager-Record und User-Record (inkl. Sessions, MagicLinks) entfernt
- **canManageMembers**: `SUPERUSER` oder `MANAGER` mit `isMemberManager = true`. Nur diese dürfen Kinder anlegen, bearbeiten, aktivieren, deaktivieren, löschen, Einladungen verwalten und Vertragsvorlagen (`/contract-templates`) verwalten. Frontend-Buttons und alle Member-API-Endpoints sowie contract-template-Endpoints prüfen diese Bedingung
- **E-Mail-Benachrichtigungen**: Eltern erhalten E-Mails bei: Invite (Kind anlegen), Freischalten (inkl. Dashboard-Link), Kind entfernen/Löschen, eigene E-Mail-Adresse geändert. `canManageMembers` erhält E-Mail wenn MEMBER Unterlagen einreicht (`sendDocumentsSubmittedNotification`). Kein E-Mail-Versand bei Abmelden, Deaktivieren oder Abmeldung rückgängig. Alle Eltern-E-Mails verwenden die **„du"**-Ansprache (nie „Sie"). E-Mail-Benachrichtigungen bei E-Mail-Adressänderungen (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) werden im **Kein-Invite-Workflow vor Freischaltung** nicht versendet (`hasInvite = false && status = REGISTERED`).
- **E-Mail-Cascade**: Wird `email1` oder `email2` eines Kindes geändert, werden alle anderen Kinder im gleichen Verein mit derselben alten E-Mail automatisch mitaktualisiert. Damit bleibt der Guardian-Email-Filter in der Kinderliste konsistent (MEMBER sieht alle eigenen Kinder). Gilt sowohl für `canManageMembers`-Updates als auch für MEMBER-Selbst-Updates. Die Benachrichtigungs-E-Mails (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) listen alle betroffenen Kinder (das editierte + Geschwister) als `childNames: string[]`, zusammengeführt mit `joinWithAnd` aus `utils/string.ts`.
- **Storage-Init**: `initUserStorage` legt nur noch Drive-Ordner an (kein per-Kind-Sheet mehr, kein Members-Sheet-Write). Der Members-Sheet-Eintrag wird ausschließlich über `saveMemberData` geschrieben, um Duplikate zu vermeiden. Per-Kind-Sheets (`createMemberSheet`) wurden entfernt — die App las sie nie, sie dienten nur als Drive-Anzeige.
- **Optimistic Locking**: `updateMemberInSheet` prüft vor dem Schreiben ob `lastEditedAt` (Spalte P) noch mit dem vom Client gesendeten `expectedLastEditedAt` übereinstimmt → 409 bei Konflikt. Das Frontend sendet `member.lastEditedAt` bei jedem Save-Request mit.
- **Rate Limiting**: `server/middleware/rateLimit.ts` begrenzt `/api/clubs`, `/api/register` und Magic-Link-Endpunkte auf 5 Anfragen/Minute pro IP (in-memory Map mit TTL). Überschreitung → 429 mit deutscher Fehlermeldung
- **Öffentliche Seiten**: `/`, `/login`, `/login/{slug}`, `/register`, `/about`, `/guide`, `/legal`, `/privacy` verwenden `layout: 'public'` (`layouts/public.vue`). Dort: Skip-Link, Header mit responsiver Nav (unter `tablet`-Breakpoint als Burger-Menü; Escape + Route-Wechsel + Resize schließen das Menü; WCAG-konform mit `aria-expanded`, `aria-controls`, dynamischem `aria-label`), Bären-SVG-Logo, Beta-Badge, Footer mit Links zu `/legal` (Impressum) und `/privacy` (Datenschutz). `error.vue` (root) behandelt 404 und generische Fehler ohne Layout-Abhängigkeit
- **Verein löschen** (`DELETE /api/ini/{slug}/settings/delete`): Löscht in einer Prisma-Transaktion: Sessions, MagicLinks, Invites, MemberDocuments, UserEmails, Users, DocumentTemplates, Groups, Managers, Club. Seitenroute liegt in `pages/ini/[slug]/settings/index.vue` (Einstellungen) und `pages/ini/[slug]/settings/delete.vue` (Löschen) — `settings/index.vue` statt `settings.vue` damit beide Routen unabhängig funktionieren
- **DSGVO-Cleanup** (`netlify/functions/cleanup.ts`): Läuft täglich als Netlify Scheduled Function. Löscht abgemeldete Kinder (`status = DEACTIVATED`, `deactivatedAt <= 1 Jahr`) nach 1 Jahr vollständig — sowohl Neon-Einträge (User, UserEmail, Sessions, MagicLinks, Invites, MemberDocuments) als auch Drive-Ordner (Suche per `storageId`) und Sheets-Zeile (Suche per `userId` in Spalte A). Query ist explizit auf `role: 'MEMBER'` beschränkt.
- **Netlify**: `NETLIFY_NEXT_PLUGIN_SKIP = "true"` in `netlify.toml` verhindert, dass der global installierte `@netlify/plugin-nextjs` beim Nuxt-Build fälschlicherweise ausgeführt wird

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
DEV_EMAIL_WHITELIST   # Optional: kommaseparierte Whitelist – nur diese Adressen erhalten E-Mails in Dev (leer = alle erlaubt)
```

## Wichtige Pfade
| Bereich | Pfad |
|---|---|
| App-Konfiguration (Upload-Limits etc.) | `utils/config.ts` |
| String-Hilfsfunktionen (`joinWithAnd` etc.) | `utils/string.ts` |
| Prisma Schema | `prisma/schema.prisma` |
| Zod Schemas (API-Validierung) | `server/utils/schemas.ts` |
| Google Auth (OAuth) | `server/utils/googleAuth.ts` |
| Google OAuth Callback | `server/api/auth/google/callback.get.ts` |
| Mitgliederdaten (Sheets/localData) | `server/utils/memberData.ts` |
| Status-Transitionen (assertValidTransition) | `server/utils/memberStatus.ts` |
| Drive-Struktur (Templates-Ordner anlegen) | `server/utils/storage/googleDrive.ts` → `createTemplatesStructure` |
| Managerdaten (Sheets/localData) | `server/utils/managerData.ts` |
| Storage Utils | `server/utils/storage/` |
| E-Mail Utils | `server/utils/email.ts` |
| Rate Limiting | `server/middleware/rateLimit.ts` |
| Server Middleware | `server/middleware/` |
| API Routes | `server/api/` |
| Pinia Stores | `stores/` |
| Types | `types/` |
| Netlify Cleanup | `netlify/functions/cleanup.ts` |
| Test Specs (shared) | `tests/specs/` |
| E2E Playwright Konfiguration | `playwright.config.ts` |
| Smoke Playwright Konfiguration | `playwright.smoke.config.ts` |
| Test DB Setup / Seed | `tests/global-setup.ts` |

## Datenbank
```bash
npm run db:push            # Schema auf Neon pushen
npm run db:migrate         # Migration erstellen (Neon)
npm run db:generate        # Prisma Client generieren
```

Lokale DB via Docker:
```bash
docker compose up -d       # PostgreSQL starten (brumm:brumm@localhost:5433/brumm)
docker compose down        # stoppen (Daten bleiben erhalten)
docker compose down -v     # stoppen + Daten löschen
```

## Dev
```bash
npm install
npx lefthook install   # Git Hooks einrichten (einmalig nach clone)
npm run dev
npm run clean          # löscht .nuxt, .output, dist (bei Cache-Problemen)
```

Git Hooks (`lefthook.yml`):
- `pre-commit`: Biome lint auf gestagte `.ts/.vue/.js`-Dateien
- `pre-push`: E2E-Tests (`npm run test:e2e`, Docker muss laufen)

## Tests
Test-Specs liegen in `tests/specs/` und sind umgebungsagnostisch (nur Env-Vars, keine hardcodierten Werte). Beide Test-Suites verwenden dieselben Specs.

### E2E (lokal)
Playwright + Docker PostgreSQL. Docker muss laufen, `.env.test` wird automatisch geladen.

```bash
docker compose up -d     # Test-DB starten (Port 5433)
npm run test:e2e         # E2E-Tests ausführen
npm run test:e2e:ui      # Playwright UI-Modus
npm run test:e2e:debug   # Debug-Modus
```

`.env.test` enthält `DEV_EMAIL_WHITELIST=__blocked__@test.local` → kein echter E-Mail-Versand in Tests.

### Smoke (Netlify Test-Umgebung)
Läuft gegen eine echte Netlify-Deployment-URL. Kein lokaler Server, kein DB-Reset. `.env.smoke` wird automatisch geladen (nicht ins Git eingecheckt, siehe `.env.smoke.example`).

```bash
npm run test:smoke   # Smoke Tests gegen Netlify ausführen
```

`.env.smoke` benötigt: `APP_URL`, `DATABASE_URL` (Neon der Test-App), `SMOKE_SLUG`, `SMOKE_EMAIL`.

### Beide zusammen
```bash
npm test   # erst E2E, dann Smoke
```
