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
- Tailwind Breakpoints: `mobile` (480px), `tablet` (768px), `desktop` (1024px) — in `tailwind.config.ts` unter `theme.extend.screens` definiert

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
/ini/{slug}/team
/ini/{slug}/team/create
/ini/{slug}/team/{id}
/ini/{slug}/calculations
/ini/{slug}/documents
/ini/{slug}/settings
/ini/{slug}/settings/delete
```
Der Slug `/ini` ist reserviert und kann nicht als Vereinsslug vergeben werden.

## Architektur
- **Multi-Tenant**: Jeder Verein hat einen eigenen Slug, alle Daten über `clubId` isoliert
- **Storage pro Verein**: Beim Onboarding verbindet der SUPERUSER seinen Google-Account via OAuth 2.0 und gibt die **ID einer Geteilten Ablage** (Pflichtfeld) ein. Alle Vereinsdaten werden ausschließlich in dieser Geteilten Ablage angelegt. Das OAuth-Token wird in `Club.oauthToken` (Neon) gespeichert. Kein globaler Service Account, kein GCP-Setup durch den Verein nötig. Die Shared Drive ID wird als `parentId` durch den OAuth-State (`/api/ini/{slug}/auth/google` → Callback → `setupClubStorage` → `createRootFolderStructure`) durchgereicht.
- **Datentrennung**: Neon speichert technische/Auth-Daten (`id`, `clubId`, `role`, `status`, `storageId`, `deactivatedAt`, `hasSubmittedDocuments`) sowie Vereins-Konfiguration (`membershipFee`). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, `phone1`, `phone2`, `groupId`, `surcharges`, `careType`, `contractEnd`, etc.) leben ausschließlich in Google Sheets. Sheets-Spalten: A=userId, B=storageRef, C=firstName, D=lastName, E=birthDate, F=guardian1Name, G=guardian2Name, H=email1, I=email2, J=groupId, K=contractEnd, L=phone1, M=phone2, N=surcharges, O=careType, P=lastEditedAt, Q=lastEditedBy, R=address
- **AuthUser-Anreicherung**: `me.get.ts` und `verify/[token].get.ts` reichern den zurückgegebenen User für MEMBER-Nutzer mit `firstName`/`lastName` aus den Mitgliederdaten an. `firstName` wird auf `guardian1Name` gesetzt (Name des Erziehungsberechtigten, nicht des Kindes), `lastName` auf `null`
- **MEMBER-Rolle**: Sieht den Nav-Eintrag „Kinder", hat gelb-gefärbten Hintergrund (`#ffdd76`). Dashboard zeigt für jedes eigene Kind einen statusbasierten Block (Ausstehend / Wartet auf Aktivierung / Aktiv / Abgemeldet). Auf der Kind-Detailseite sieht MEMBER dieselbe editierbare Form wie `canManageMembers`. Ab Einreichung (`status === 'REGISTERED' && hasInvite && hasSubmittedDocuments`) oder Aktivierung (`status === 'ACTIVE' || 'INACTIVE'`) ist das Formular in zwei Bereiche geteilt: **Kid-Data** (Vorname bis Vertragsende) wird readonly (`isKidDataLocked`); **Kontaktdaten** (Erziehungsber. 1/2, E-Mails, Telefone, Adresse via `GuardianField`-Komponente) bleiben editierbar. `isContactLocked` greift erst bei `DEACTIVATED`. Der Speichern-Button bleibt sichtbar solange `!isContactLocked`. Der Update-Endpoint erlaubt MEMBER, die eigene `memberId` zu updaten (`isSelfUpdate`)
- **Globaler Login** (`/login`): Zeigt ein Dropdown aller setup-fertigen Kitas (`GET /api/clubs`, public). Nach Auswahl wird auf `/login/{slug}` weitergeleitet. Kein Drive-Zugriff auf dieser Seite. `/login/{slug}` ist die vereinsspezifische Anmeldeseite: erkennt via `device_token`-Cookie ob ein Gerät registriert ist — zeigt dann PIN-Numpad (4 Ziffern, Banking-Style), sonst E-Mail-Formular (Magic Link, 15 min)
- **Vertragsunterlagen (DocumentTemplates/contract-templates)**: Drei Typen: `read` (Nur lesen — Eltern bestätigen gelesen), `upload` (Ausfüllen — Vorlage herunterladen, ausfüllen, hochladen), `submit` (Einreichen — beliebiges Dokument hochladen, keine Vorlage nötig). Aktive/abgemeldete Kinder sehen nur Vorlagen mit vorhandener Einreichung. „Als gelesen markieren" ist einmalig und kopiert die Vorlagendatei in den Drive-Ordner des Kindes. Sobald ein Kind aktiv ist, sind Vertragsunterlagen schreibgeschützt (kein Löschen mehr möglich). Vor der Aktivierung können Dateien im Kein-Invite-Workflow gelöscht werden (`DELETE /api/ini/{slug}/members/{id}/documents/{fileId}`, nur `canManageMembers`). Verwaltung der Vorlagen via `canManageMembers` (SUPERUSER + isMemberManager). URL: `/ini/{slug}/contract-templates`. Datei-Upload: max. 5 MB (konfiguriert in `utils/config.ts` als `MAX_UPLOAD_SIZE_BYTES`/`MAX_UPLOAD_SIZE_LABEL`, clientseitig und serverseitig geprüft). Hochgeladener Dateiname wird neben dem Upload-Button angezeigt.
- **Einreichen-Flow**: MEMBER klickt „Einreichen" (Button in der Form-Action-Zeile neben „Speichern", nur bei `status === 'REGISTERED' && hasInvite && !submitted`) sobald alle Vertragsunterlagen vollständig sind. Confirm-Dialog zeigt Hinweis dass die Kita eine Benachrichtigung erhält. `User.hasSubmittedDocuments` wird auf `true` gesetzt (Neon). Benachrichtigung geht an: MANAGERs mit `isMemberManager = true` (Emails aus Sheets), oder – falls keine solchen existieren – an den SUPERUSER. Der „Aktivieren"-Button ist erst aktiv wenn `hasSubmittedDocuments = true` (und `member.hasInvite = true`); neben dem Titel „Vertragsunterlagen" erscheint ein „Noch nicht eingereicht"-Hinweis solange noch nicht eingereicht wurde. Im **Kein-Invite-Workflow** ist „Aktivieren" immer aktiv (unabhängig von `hasSubmittedDocuments`). Sind keine Vertragsvorlagen konfiguriert, erscheint ein oranger Hinweis (für MEMBER: „Die Kita hat noch keine Vertragsunterlagen hinterlegt."; für `canManageMembers`: mit Link zu `/contract-templates`).
- **Kein-Invite-Workflow**: Wird ein Kind ohne Einladung angelegt (`sendInvite = false`), ist `member.hasInvite = false`. Auf der Detailseite zeigt `canManageMembers` statt der Template-Liste direkt ein Upload-Interface (`documents/contract/`). Es erscheint kein „Noch nicht eingereicht"-Hinweis. „Aktivieren" ist sofort aktiv. Nach dem Aktivieren wird `member.hasInvite` lokal auf `true` gesetzt; direkt hochgeladene Dateien bleiben über `filteredDocuments` sichtbar.
- **filteredDocuments**: Computed in `pages/ini/[slug]/members/[id]/index.vue` — Drive-Dateien aus `documents/`, die nicht bereits als Template-Einreichung (`MemberDocument.driveFileId`) erfasst sind. Wird in der `canManageMembers`-Sektion nur angezeigt wenn `member.status === 'REGISTERED' && member.hasInvite` (verhindert Doppeldarstellung nach Aktivierung, da der ACTIVE-Block ohnehin alle Dokumente zeigt).
- **isOwnChild**: Wird vom GET-Endpoint berechnet: `true` wenn eine Guardian-Email des Kindes mit der Email des eingeloggten SUPERUSER übereinstimmt. Ermöglicht im `canManageMembers`-Template-Block die Upload- und „Als gelesen markieren"-Buttons, so als wäre der SUPERUSER selbst MEMBER.
- **Confirm-Dialoge**: Kind anlegen mit Invite → „Kind anlegen und Einladung senden?"; Speichern mit geänderter E-Mail → „Die E-Mail-Adresse wurde geändert. [...] Speichern und E-Mail-Hinweis versenden?"; Aktivieren → „[Name] aktivieren? Die Erziehungsberechtigten erhalten eine Bestätigungs-E-Mail."; Abmelden → „Kind abmelden?"; Löschen / Kind entfernen → „Kind wirklich dauerhaft entfernen? Die Eltern erhalten eine E-Mail."; Datei löschen → „Datei unwiderruflich löschen?"; Einreichen → „Unterlagen einreichen? Die Kita erhält eine Benachrichtigung."
- **Weitere Unterlagen**: Für aktive Kinder gibt es einen separaten Bereich „Weitere Unterlagen". Dateien landen in `documents/other/` im Drive-Ordner des Kindes. Sowohl MEMBER (Guardian) als auch `canManageMembers` dürfen Dateien hinzufügen, ersetzen und löschen (`DELETE /api/ini/{slug}/members/{id}/documents/other/{fileId}` — Guardian oder `canManageMembers` berechtigt). Der Fehler beim „Ändern" einer einzelnen Datei wird per-file angezeigt (`otherReplaceError`/`otherReplaceErrorFileId`), der Fehler beim „Datei hinzufügen" inline unter dem Button.
- **Drive-Ordnerstruktur**: Stammverzeichnis heißt immer `brumm/` (unabhängig vom Vereinsslug). Darunter: `brumm/contract-templates/` (Vertragsvorlagen, wird beim Onboarding angelegt), `brumm/managers/` (Lazy-Init, enthält `managers`-Sheet), `brumm/groups/` (Lazy-Init, enthält `groups`-Sheet), `brumm/team/` (Lazy-Init, enthält `team`-Sheet), `brumm/documents/` (Lazy-Init, Vereinsunterlagen) und `brumm/members/` (enthält `members`-Sheet sowie pro Kind einen Ordner `{storageRef}/documents/contract/` – Vertragsunterlagen und `{storageRef}/documents/other/` – weitere Unterlagen nach Aktivierung). `GoogleDriveConfig` speichert: `rootFolderId`, `membersFolderId`, `membersSheetId`, `templatesFolderId`, optional `managersFolderId` + `managersSheetId` + `groupsFolderId` + `groupsSheetId` + `documentsFolderId` + `teamFolderId` + `teamSheetId`
- **Vereinsunterlagen (Documents)**: SUPERUSER und MANAGER können unter `/ini/{slug}/documents` Dateien hochladen, ersetzen, sortieren (Drag & Drop) und löschen. Metadaten (`name`, `driveFileId`, `order`) in Neon-Tabelle `Document` (`clubId`-isoliert). Datei selbst in `brumm/documents/` (Lazy-Init via `ensureDocumentsFolder` in `server/utils/clubDocuments.ts`). API: `GET/POST /api/ini/{slug}/documents`, `PATCH/DELETE /api/ini/{slug}/documents/{fileId}`, `PUT /api/ini/{slug}/documents/reorder`, `GET /api/ini/{slug}/documents/{fileId}/download`. Dashboard-Card „Unterlagen" zeigt Dokumente in `order`-Reihenfolge mit Direktdownload-Links sowie „Bearbeiten"-Button für SUPERUSER/MANAGER.
- **Dashboard-Komponenten**: Das Dashboard ist vollständig in wiederverwendbare Komponenten unter `components/dashboard/` aufgeteilt, die alle als async (`<script setup>` mit top-level `await`) implementiert sind und gemeinsam in einer `<Suspense>`-Grenze in `dashboard.vue` liegen — ein zentrales `<LoadingBrumm>` für das gesamte Dashboard. Komponenten: `DashboardMyKids` (Anmeldungs-Card für MEMBER, zeigt eigene Kinderliste mit Status — kein Link zur Kinderliste), `DashboardOverview` (Stats-Grid für `canManageMembers`: 2/3-Card mit Kennzahlen Angemeldete Kinder / Aktiv / Inaktiv + Aufschlüsselung nach Gruppen und Betreuungsumfang + orangene Hinweise; 1/3-Spalte mit Vertragsende- und Abgemeldet-Cards), `DashboardGroups` (TEAM: Kinderliste pro Gruppe als Spalten mit Anzahl, Namen als Links mit Geburtsdatum; Kinder ohne Gruppe als oranger Hinweis unten), `DashboardBirthdays` (TEAM: nächster Geburtstag als gelbe Card mit Alter, Name, Datum, Gruppe; Zwillinge/Kinder mit gleichem Datum und Alter in einer Card; nächste 3 Daten als Liste), `DashboardAktuell` (Link zur Adressliste), `DashboardDocuments` (Vereinsunterlagen-Card). „Vertragsende in Jahr" zeigt nur Kinder mit `contractEnd === currentYear && month < 7` (ab August erscheinen sie unter „Vertragsende überschritten"). `stores/members.ts` dedupliziert parallele `fetchMembers`-Aufrufe via Promise-Caching.
- **Kind-Aktionen**: Für aktive Kinder (`status = ACTIVE | INACTIVE`) zeigen sich zwei Buttons: „Deaktivieren/Aktivieren" (togglet zwischen `ACTIVE` ↔ `INACTIVE` in Neon, kein E-Mail-Versand) und „Abmelden" (setzt `status = DEACTIVATED` + `deactivatedAt` in Neon, löscht Sessions, kein E-Mail-Versand). Für abgemeldete Kinder: „Abmeldung rückgängig" (setzt `status = ACTIVE`, löscht `deactivatedAt`, kein E-Mail) und „Löschen" (löscht alle Neon-Einträge, Drive-Ordner, Sheets-Zeile + sendet E-Mail an beide Erziehungsberechtigten). Für noch nicht aktivierte Kinder (`status = PENDING_INVITE | REGISTERED`): „Aktivieren" + „Kind entfernen" (wie „Löschen").
- **Zuschläge**: Jedes Kind kann mehrere Zuschläge tragen (`surcharges: string[]`, gespeichert als kommaseparierter String in Sheets-Spalte N). Aktuell verfügbare Schlüssel: `ndhs`. Neue Zuschläge werden in `SURCHARGE_OPTIONS` in `pages/ini/[slug]/members/[id]/index.vue` ergänzt — keine Schema-Änderung nötig. Nur `canManageMembers` kann Zuschläge bearbeiten.
- **Betreuungsumfang (careType)**: Pflichtfeld für die Kostenerstattungsberechnung. Gespeichert als String-Key in Sheets-Spalte O. Mögliche Werte: `full_extended`, `full`, `part`, `half_with_meal`, `half_without_meal`. Nur `canManageMembers` kann den Betreuungsumfang setzen. Aktive Kinder ohne `careType` erhalten in der Kinderliste einen Warnhinweis.
- **Vertragsende (contractEnd)**: Gespeichert in Sheets-Spalte K als Jahreszahl (z.B. `"2026"`). Das Vertragsjahr endet jeweils am 31. Juli — ein Kind mit `contractEnd = "2026"` wird ab August 2026 aus allen Berechnungen ausgeschlossen (`isContractActive()` in `utils/reimbursement.ts`). Wird in der Kinderliste als eigene Spalte angezeigt (alle Rollen).
- **Letzte Änderung (lastEditedAt / lastEditedBy)**: Werden bei jedem Speichern server-seitig in `updateMemberData` gesetzt und in Sheets-Spalten P/Q geschrieben. Editorname wird aufgelöst nach Rolle: MEMBER → `guardian1Name`, MANAGER → Name aus Sheets, SUPERUSER → `"Admin"`. Wird auf der Kind-Detailseite in einer `FootnoteCard` angezeigt.
- **FootnoteCard**: Wiederverwendbare Komponente (`components/FootnoteCard.vue`) mit Content-Slot. Passt Border- und Textfarbe automatisch an die Hintergrundfarbe des eingeloggten Users an (`border-ini-300/text-ini-800` für normale Rollen, `border-member-300/text-member-800` für MEMBER, `border-team-300/text-team-800` für TEAM). Tailwind-Palette `member` und `team` haben je Abstufungen 200/300/500/700/800.
- **Rechnung-Seite** (`/calculations`): Nur für SUPERUSER und MANAGER. Monats- und Jahresansicht. Berechnet Einnahmen (Kostenerstattung nach KitaFöG-Sätzen + ndH-Zuschlag + Mitgliedsbeiträge) und Personalschlüssel (Betreuungsstunden, Min. Fachstunden, Max. Quereinsteiger, Leitungsstunden) auf Basis der aktiven Kinder. Mitgliedsbeitrag wird als `Club.membershipFee` in Neon gespeichert (PATCH `/api/ini/{slug}/settings/membership-fee`). Berechnungslogik und Ratentabellen in `utils/reimbursement.ts`. Quellenangabe: Roland Kern, DaKS e.V.
- **Gruppen**: Werden in Google Sheets gespeichert (Lazy-Init wie Manager: `brumm/groups/` Ordner + Sheet mit Spalten `groupId`, `name`, `email`). `server/utils/groupData.ts` stellt `getAllGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup` bereit. SUPERUSER kann Gruppen anlegen, bearbeiten und löschen (`/ini/{slug}/groups`). Die `groupId` eines Kindes wird im Members-Sheet gespeichert; bei der Kinderliste wird die Gruppe per `groupMap` aus dem Groups-Sheet angereichert. Nur SUPERUSER hat Zugriff auf die Gruppen-Verwaltung.
- **Kind-Status**: Modelliert als `MemberStatus`-Enum in Neon (`User.status`). Reihenfolge: `PENDING_INVITE` (offener Invite, UI: „Ausstehend") → `REGISTERED` (Invite geklickt oder Superuser ist Guardian, UI: „Bestätigt") → `ACTIVE` (aktiviert, UI: „Aktiv") / `INACTIVE` (temporär deaktiviert, reversibel per Toggle ACTIVE ↔ INACTIVE, UI: „Inaktiv" — dient zur Simulation in der Berechnung) / `DEACTIVATED` (`deactivatedAt` gesetzt in Neon, UI: „Abgemeldet" — automatische Löschung nach 1 Jahr). Erlaubte Übergänge sind zentral in `server/utils/memberStatus.ts` (`assertValidTransition`) definiert. `INACTIVE` und `DEACTIVATED` sind von der Kostenerstattungs- und Personalschlüssel-Berechnung ausgeschlossen. Status-Badge-Farben: ACTIVE grün, INACTIVE und REGISTERED lila, PENDING_INVITE orange, DEACTIVATED grau.
- **storageId vs. storageRef**: In Neon wird nur die 8-stellige `storageId` (cuid2) gespeichert. Der vollständige `storageRef` (`YYYY-MM-DD-vorname-nachname_storageId`) existiert nur in Sheets und wird bei Bedarf daraus rekonstruiert
- **Dev-Fallback**: Solange `isSetupDone = false` werden Mitgliederdaten in `User.localData` (Neon JSON) zwischengespeichert. Nach dem Storage-Onboarding werden sie nach Sheets migriert und aus Neon gelöscht
- **Auth**: Magic Link (15 min) für SUPERUSER, MANAGER und TEAM; Invite-Link (7 Tage) für Eltern. HttpOnly Cookie, max. 1 aktive Session pro User. Logout leitet auf `/login/{slug}`
- **Invite-Logik**: Beim Anlegen eines Kindes kann `canManageMembers` per Checkbox „Einladung senden" (default: aktiv) steuern, ob ein Invite-Link per E-Mail verschickt wird. Ist mindestens eine Guardian-Email identisch mit der Email des eingeloggten SUPERUSER (`hasSuperUserEmail`), wird sofort ein Invite mit `isUsed: true` erstellt → Kind startet mit `status = REGISTERED`. Ohne `hasSuperUserEmail` und mit aktivem `sendInvite` startet das Kind mit `status = PENDING_INVITE`. Beim Klick auf den Invite-Link setzt `verify/[token].get.ts` den Status auf `REGISTERED`. `parentAlreadyRegistered` wird nur gegen `inviteEmails` (nicht-Superuser-Emails) geprüft. `Member.hasInvite` (API-Feld, aus Neon `Invite`-Tabelle: `!!anyInvite`) zeigt ob je ein Invite für dieses Kind erstellt wurde — steuert welcher Workflow auf der Detailseite greift (Template-Liste vs. Direkt-Upload)
- **Magic-Link-Lookup**: 1. UserEmail in Neon (deckt SUPERUSER und MANAGER ab), 2. Members-Sheet `findUserIdByEmail` + Managers-Sheet `findManagerIdByEmail` + Team-Sheet `findTeamMemberIdByEmail` parallel (wenn Setup fertig) – bei Manager-/Team-Treffer wird User via `storageId` gesucht, 3. `User.localData` + `Manager.localData` + `Team.localData`-Suche in Neon (Dev-Fallback). Existiert die userId nicht mehr in Neon, wird kein Link erzeugt (stilles Fehlschlagen)
- **Verify-Endpoint**: `/api/ini/{slug}/auth/verify/{token}` prüft zuerst `MagicLink`, dann `Invite` – ein Token-Typ reicht für beide Auth-Flows. MEMBER wird nach `/dashboard` weitergeleitet. Hat der MagicLink ein `pendingPinHash`, wird nach dem Einlösen automatisch eine `DeviceSession` angelegt und `device_token`-Cookie gesetzt. Hat der MagicLink ein `pendingDeviceTokenToDelete`, wird die zugehörige `DeviceSession` gelöscht und der Cookie geleert (PIN-vergessen-Flow)
- **Angemeldet bleiben (PIN-Auth)**: Opt-in beim Magic-Link-Login via Checkbox + 4-stelliger PIN. Ablauf: (1) Nutzer wählt „Angemeldet bleiben", tippt 4-stellige PIN, sendet Magic Link → PIN-Hash wird in `MagicLink.pendingPinHash` gespeichert. (2) Beim Einlösen des Links legt `verify/[token].get.ts` eine `DeviceSession` an (pinHash, deviceToken, 90 Tage) und setzt `device_token` als HttpOnly Cookie. (3) Nächste Anmeldung: Cookie erkannt → PIN-Numpad statt E-Mail-Formular. (4) `POST /api/ini/{slug}/auth/pin` verifiziert PIN per scrypt, rotiert `deviceToken` bei Erfolg. (5) 3 Fehlversuche → `DeviceSession.lockedAt` gesetzt → Sperre-Meldung, Magic-Link-Fallback. **PIN vergessen**: `POST /api/ini/{slug}/auth/pin-forgot` liest `device_token` Cookie → ermittelt User-Email (Neon für SUPERUSER/MANAGER, Sheets für MEMBER) → erstellt MagicLink mit `pendingDeviceTokenToDelete` → sendet Email „PIN löschen und anmelden". Beim Einlösen wird DeviceSession gelöscht und Cookie geleert. Auf der Login-Seite erscheint nur noch „PIN vergessen" unten (kein separater „Per E-Mail anmelden"-Link mehr). PIN-Hashing via scrypt (Node.js built-in, kein extra Dependency) in `server/utils/pinHash.ts`. Cookies: `device_token` (HttpOnly, Secure, SameSite=Lax, 90 Tage)
- **Blattschutz**: Alle Sheets (members, managers, groups) erhalten beim Anlegen automatisch einen `warningOnly`-Blattschutz via `protectSheet` in `server/utils/googleAuth.ts`. API-Schreibzugriffe laufen trotzdem durch; nur manuelle Edits in der Sheets-UI zeigen eine Warnung. Beim Reconnect wird der Schutz auf alle vorhandenen Sheets gesetzt (idempotent: „already has sheet protection"-Fehler wird ignoriert). Nachträgliche Anwendung auf bestehende Clubs: `POST /api/admin/protect-sheets`.
- **Google OAuth Fehlerbehandlung**: `withGoogleErrorHandling` in `server/utils/googleAuth.ts` fängt `invalid_grant`-Fehler (abgelaufener Refresh-Token) und wirft einen 503 mit lesbarer Fehlermeldung. Alle Google-API-Aufrufe in `memberData.ts` sind damit gewrappt. Refresh-Token bei OAuth-Apps im Test-Modus laufen nach 7 Tagen ab → Google Cloud Console App publishen für dauerhaften Zugriff
- **Google Drive nicht erreichbar**: Sheet-Funktionen (`getAllMembersFromSheet`, `getMemberFromSheet`, `findUserIdByEmail`) fangen Google-404-Fehler sowie `Missing required parameters: spreadsheetId` (Sheet-ID fehlt in Config) ab und werfen einen 503 „Die Google-Ablage wurde nicht gefunden." mit der Original-Google-Fehlermeldung als `message`. Die Members-Liste zeigt diesen Fehler als roten Block an statt die Seite zu crashen — Navigation zu Einstellungen → Verein löschen bleibt erreichbar
- **MANAGER-Rolle**: Beim Anlegen eines Managers werden zwei Neon-Einträge erstellt: ein `Manager`-Record (`id`, `clubId`, `storageId`, `isMemberManager`) und ein `User`-Record (`role: MANAGER`, gleiche `storageId`). Beide teilen dieselbe `storageId` als Verknüpfung. Keine `UserEmail` in Neon – die E-Mail lebt ausschließlich in Sheets. Persönliche Daten (Name, E-Mail) leben in Google Sheets unter `brumm/managers/`. Dev-Fallback via `Manager.localData`. Lazy-Init: Ordner + Sheet werden beim ersten Manager automatisch angelegt, IDs in `Club.storageConfig` (`managersFolderId`, `managersSheetId`) gespeichert. Beim Anlegen wird direkt ein Magic Link (15 min) erzeugt und in der Willkommens-E-Mail mitgeschickt. Beim Löschen eines Managers werden Manager-Record und User-Record (inkl. Sessions, MagicLinks) entfernt
- **TEAM-Rolle**: Analog zu MANAGER. Beim Anlegen werden ein `Team`-Record (`id`, `clubId`, `storageId`) und ein `User`-Record (`role: TEAM`, gleiche `storageId`) erstellt. Persönliche Daten (Name, E-Mail) leben in Google Sheets unter `brumm/team/` (Sheet-Spalten: teamId, storageId, name, email). Dev-Fallback via `Team.localData`. Lazy-Init über `ensureTeamStorage`. Beim Anlegen wird ein Magic Link erzeugt und eine Willkommens-E-Mail gesendet. Beim Löschen werden Team-Record und User-Record (inkl. Sessions, MagicLinks) entfernt. TEAM sieht im Nav keine Einträge (kein „Kinder"); SUPERUSER verwaltet Team unter `/ini/{slug}/team`. TEAM darf Kinderdaten lesen (read-only via `:inert`), aber keine Unterlagen sehen, kein Kind anlegen; Back-Link auf Kind-Detailseite zeigt zum Dashboard. Dashboard zeigt `DashboardGroups` + `DashboardBirthdays` (2/3 + 1/3), `DashboardAktuell` und `DashboardDocuments`. Hintergrundfarbe: `bg-team` (`#f2baba`), Tailwind-Palette `team` (200/300/500/700/800). Adressenseite zeigt für SUPERUSER eine Team-Card mit Name + E-Mail aller Teammitglieder.
- **canManageMembers**: `SUPERUSER` oder `MANAGER` mit `isMemberManager = true`. Nur diese dürfen Kinder anlegen, bearbeiten, aktivieren, deaktivieren, löschen, Einladungen verwalten und Vertragsvorlagen (`/contract-templates`) verwalten. Frontend-Buttons und alle Member-API-Endpoints sowie contract-template-Endpoints prüfen diese Bedingung
- **E-Mail-Benachrichtigungen**: Eltern erhalten E-Mails bei: Invite (Kind anlegen), Aktivieren (inkl. Dashboard-Link), Kind entfernen/Löschen, eigene E-Mail-Adresse geändert. `canManageMembers` erhält E-Mail wenn MEMBER Unterlagen einreicht (`sendDocumentsSubmittedNotification`). Manager und Teammitglieder erhalten beim Anlegen eine Willkommens-E-Mail mit direktem Magic Link (`sendManagerAddedEmail`, `sendTeamAddedEmail`). Beim Entfernen erhalten sie eine Abmelde-E-Mail (`sendManagerRemovedEmail`, `sendTeamRemovedEmail`). Kein E-Mail-Versand bei Abmelden, Deaktivieren oder Abmeldung rückgängig. Alle Eltern-E-Mails verwenden die **„du"**-Ansprache (nie „Sie"). E-Mail-Benachrichtigungen bei E-Mail-Adressänderungen (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) werden im **Kein-Invite-Workflow vor Aktivierung** nicht versendet (`hasInvite = false && status = REGISTERED`).
- **E-Mail-Cascade**: Wird `email1` oder `email2` eines Kindes geändert, werden alle anderen Kinder im gleichen Verein mit derselben alten E-Mail automatisch mitaktualisiert. Damit bleibt der Guardian-Email-Filter in der Kinderliste konsistent (MEMBER sieht alle eigenen Kinder). Gilt sowohl für `canManageMembers`-Updates als auch für MEMBER-Selbst-Updates. Die Benachrichtigungs-E-Mails (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) listen alle betroffenen Kinder (das editierte + Geschwister) als `childNames: string[]`, zusammengeführt mit `joinWithAnd` aus `utils/string.ts`. Die `GuardianField`-Komponente zeigt unter dem E-Mail-Feld einen Hinweis wenn die Adresse Geschwister betrifft: grau wenn unverändert („Diese E-Mail gehört auch zu X"), orange wenn geändert oder neu eingetragen („Änderung wird auch automatisch für X übernommen").
- **Storage-Init**: `initUserStorage` legt nur noch Drive-Ordner an (kein per-Kind-Sheet mehr, kein Members-Sheet-Write). Der Members-Sheet-Eintrag wird ausschließlich über `saveMemberData` geschrieben, um Duplikate zu vermeiden. Per-Kind-Sheets (`createMemberSheet`) wurden entfernt — die App las sie nie, sie dienten nur als Drive-Anzeige.
- **Optimistic Locking**: `updateMemberInSheet` prüft vor dem Schreiben ob `lastEditedAt` (Spalte P) noch mit dem vom Client gesendeten `expectedLastEditedAt` übereinstimmt → 409 bei Konflikt. Das Frontend sendet `member.lastEditedAt` bei jedem Save-Request mit.
- **Rate Limiting**: `server/middleware/rateLimit.ts` begrenzt `/api/clubs`, `/api/register` und Magic-Link-Endpunkte auf 5 Anfragen/Minute pro IP (in-memory Map mit TTL). PIN-Endpoint (`/api/ini/{slug}/auth/pin`) ist auf 3 Anfragen/Minute begrenzt. Überschreitung → 429 mit deutscher Fehlermeldung
- **Öffentliche Seiten**: `/`, `/login`, `/login/{slug}`, `/register`, `/about`, `/guide`, `/legal`, `/privacy` verwenden `layout: 'public'` (`layouts/public.vue`). Dort: Skip-Link, Header mit responsiver Nav (unter `tablet`-Breakpoint als Burger-Menü; Escape + Route-Wechsel + Resize schließen das Menü; WCAG-konform mit `aria-expanded`, `aria-controls`, dynamischem `aria-label`), Bären-SVG-Logo, Beta-Badge, Footer mit Links zu `/legal` (Impressum) und `/privacy` (Datenschutz). `error.vue` (root) behandelt 404 und generische Fehler ohne Layout-Abhängigkeit
- **Verein löschen** (`DELETE /api/ini/{slug}/settings/delete`): Löscht in einer Prisma-Transaktion: Sessions, MagicLinks, Invites, MemberDocuments, UserEmails, Users, DocumentTemplates, Groups, Managers, Club. Seitenroute liegt in `pages/ini/[slug]/settings/index.vue` (Einstellungen) und `pages/ini/[slug]/settings/delete.vue` (Löschen) — `settings/index.vue` statt `settings.vue` damit beide Routen unabhängig funktionieren
- **DSGVO-Cleanup** (`netlify/functions/cleanup.ts`): Läuft täglich als Netlify Scheduled Function. Löscht abgemeldete Kinder (`status = DEACTIVATED`, `deactivatedAt <= 1 Jahr`) nach 1 Jahr vollständig — sowohl Neon-Einträge (User, UserEmail, Sessions, MagicLinks, Invites, MemberDocuments) als auch Drive-Ordner (Suche per `storageId`) und Sheets-Zeile (Suche per `userId` in Spalte A). Query ist explizit auf `role: 'MEMBER'` beschränkt. Löscht zusätzlich alle abgelaufenen `DeviceSession`-Einträge (`expiresAt < now`).
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
| Vereinsunterlagen (Lazy-Init, Upload) | `server/utils/clubDocuments.ts` |
| Dashboard-Komponenten | `components/dashboard/` (alle async mit top-level `await`, gemeinsam in `<Suspense>`) |
| Guardian-Felder (Name, E-Mail, Telefon pro Elternteil) | `components/GuardianField.vue` |
| Sortierbarer Tabellen-Header (WCAG) | `components/SortableTableHeader.vue` |
| Lade-Animation (hüpfendes Emoji, WCAG) | `components/LoadingBrumm.vue` |
| PIN-Eingabe (4-stellig, Numpad-Style) | `components/PinInput.vue` |
| PIN-Hashing (scrypt) | `server/utils/pinHash.ts` |
| PIN-Auth Endpoints (device GET/DELETE, pin POST, pin-forgot POST) | `server/api/ini/[slug]/auth/device.get.ts`, `device.delete.ts`, `pin.post.ts`, `pin-forgot.post.ts` |
| Managerdaten (Sheets/localData) | `server/utils/managerData.ts` |
| Teamdaten (Sheets/localData) | `server/utils/teamData.ts` |
| Team-Sheet-Utils | `server/utils/storage/teamSheet.ts` |
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
