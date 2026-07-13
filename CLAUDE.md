# Brumm – CLAUDE.md

## Stack
- Nuxt 3 (SPA, `ssr: false`; nur `/register` vorgerendert), Vue 3 + Composition API
- Pinia (State Management), TypeScript strict
- Reka UI + Tailwind CSS
- Prisma ORM + PostgreSQL (zentrale App-DB), postgres (direkter Client für Club-DBs)
- @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner (S3-kompatibler Datei-Storage)
- Resend (E-Mails), @paralleldrive/cuid2 (IDs)
- Biome (Formatter + Linter), Lefthook (Git Hooks), Netlify (Hosting + Scheduled Functions)
- @vite-pwa/nuxt (PWA: App Shell Caching, Offline-Fallback)

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
/about
/preview               → Einblicke (App-Screenshots)
/guide
/admin
/login/{slug}
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
/ini/{slug}/wall
/ini/{slug}/parent-jobs
/ini/{slug}/parent-jobs/{id}
/ini/{slug}/settings
/ini/{slug}/settings/delete
/offline
```
Der Slug `/ini` ist reserviert und kann nicht als Vereinsslug vergeben werden.

## Architektur
- **Multi-Tenant**: Jeder Verein hat einen eigenen Slug, alle Daten über `clubId` isoliert
- **Storage pro Verein**: Jeder Verein konfiguriert unter Einstellungen eine eigene PostgreSQL-Datenbank und optional einen externen Pooler (z.B. Supabase Port 6543). Die direkte DSN wird AES-256-GCM-verschlüsselt in `Club.encryptedDsn` gespeichert, die optionale Pool-DSN in `Club.encryptedPoolDsn`. S3-Credentials in `Club.encryptedS3Config`. Datenzugriffe laufen über den per-Club Postgres-Client (`getClubDb`), Dateizugriffe über S3 (`server/utils/storage/s3/files.ts`). **Verbindungsstrategie**: Ist `encryptedPoolDsn` gesetzt, verwendet `getClubDb` den Pooler (`max: 5, prepare: false` für PgBouncer-Kompatibilität); sonst die direkte DSN (`max: 1`). Migrationen (`migrateClubDb`) nutzen immer die direkte DSN mit einer frischen Verbindung, da PgBouncer im Transaction Mode keine Session-Features unterstützt.
- **Datentrennung**: Die zentrale Datenbank speichert technische/Auth-Daten (`id`, `clubId`, `role`, `status`, `storageId`, `deactivatedAt`, `hasSubmittedDocuments`), Vereins-Konfiguration (`adminEmail`, `encryptedDsn`, `encryptedPoolDsn`, `encryptedS3Config`) und ISBJ-Konfiguration (`ClubISBJConfig`). Die Admin-E-Mail des SUPERUSER liegt als `Club.adminEmail` direkt am Club-Datensatz (nicht mehr in einer separaten `UserEmail`-Tabelle). Alle persönlichen Mitgliederdaten (`firstName`, `lastName`, `birthDate`, `emails`, `phone1`, `phone2`, `groupId`, `surcharges`, `careType`, `contractEnd`, etc.) leben in der per-Club PostgreSQL-Datenbank (Tabelle `members`). S3-Keys werden als base64url-kodierte Strings in URLs und in `DocumentTemplate.s3Key` / `Document.s3Key` / `MemberDocument.s3Key` gespeichert.
- **AuthUser-Anreicherung**: `me.get.ts` und `verify/[token].get.ts` reichern den zurückgegebenen User für MEMBER-Nutzer mit `firstName`/`lastName` aus den Mitgliederdaten an. `firstName` wird auf `guardian1Name` gesetzt (Name des Erziehungsberechtigten, nicht des Kindes), `lastName` auf `null`
- **MEMBER-Rolle**: Sieht den Nav-Eintrag „Elternposten", hat gelb-gefärbten Hintergrund (`#ffdd76`). Dashboard zeigt für jedes eigene Kind einen statusbasierten Block (Ausstehend / Wartet auf Aktivierung / Aktiv / Abgemeldet). Auf der Kind-Detailseite sieht MEMBER dieselbe editierbare Form wie `canManageMembers`. Ab Einreichung (`status === 'REGISTERED' && hasInvite && hasSubmittedDocuments`) oder Aktivierung (`status === 'ACTIVE' || 'INACTIVE'`) ist das Formular in zwei Bereiche geteilt: **Kid-Data** (Vorname bis Vertragsende) wird readonly (`isKidDataLocked`); **Kontaktdaten** (Erziehungsber. 1/2, E-Mails, Telefone, Adresse via `GuardianField`-Komponente) bleiben editierbar. `isContactLocked` greift erst bei `DEACTIVATED`. Der Speichern-Button bleibt sichtbar solange `!isContactLocked`. Der Update-Endpoint erlaubt MEMBER, die eigene `memberId` zu updaten (`isSelfUpdate`)
- **Globaler Login** (`/login`): Zeigt ein Dropdown aller Kitas mit konfigurierter PostgreSQL-DSN (`GET /api/clubs` filtert auf `encryptedDsn IS NOT NULL`, public). Nach Auswahl wird auf `/login/{slug}` weitergeleitet. `/login/{slug}` ist die vereinsspezifische Anmeldeseite: erkennt via `device_token`-Cookie ob ein Gerät registriert ist — zeigt dann PIN-Numpad (4 Ziffern, Banking-Style), sonst E-Mail-Formular (Magic Link, 15 min). Nach dem Versenden zeigt die Seite zusätzlich ein OTP-Code-Eingabefeld (`autocomplete="one-time-code"`), mit dem der User sich direkt ohne Link-Klick anmelden kann — ermöglicht Login im gleichen Browser-Kontext (z.B. installierte PWA)
- **Vertragsunterlagen (DocumentTemplates/contract-templates)**: Drei Typen: `read` (Nur lesen — Eltern bestätigen gelesen), `upload` (Ausfüllen — Vorlage herunterladen, ausfüllen, hochladen), `submit` (Einreichen — beliebiges Dokument hochladen, keine Vorlage nötig). Aktive/abgemeldete Kinder sehen nur Vorlagen mit vorhandener Einreichung. „Als gelesen markieren" ist einmalig und speichert eine Kopie der Vorlagendatei im S3-Prefix des Kindes. Sobald ein Kind aktiv ist, sind Vertragsunterlagen schreibgeschützt (kein Löschen mehr möglich). Vor der Aktivierung können Dateien im Kein-Invite-Workflow gelöscht werden (`DELETE /api/ini/{slug}/members/{id}/documents/{fileId}`, nur `canManageMembers`). Verwaltung der Vorlagen via `canManageMembers` (SUPERUSER + isMemberManager). URL: `/ini/{slug}/contract-templates`. Datei-Upload: max. 5 MB (konfiguriert in `utils/config.ts` als `MAX_UPLOAD_SIZE_BYTES`/`MAX_UPLOAD_SIZE_LABEL`, clientseitig und serverseitig geprüft). Hochgeladener Dateiname wird neben dem Upload-Button angezeigt.
- **Einreichen-Flow**: MEMBER klickt „Einreichen" (Button in der Form-Action-Zeile neben „Speichern", nur bei `status === 'REGISTERED' && hasInvite && !submitted`) sobald alle Vertragsunterlagen vollständig sind. Confirm-Dialog zeigt Hinweis dass die Kita eine Benachrichtigung erhält. `User.hasSubmittedDocuments` wird auf `true` gesetzt (Datenbank). Benachrichtigung geht an: MANAGERs mit `isMemberManager = true` (E-Mails aus der Club-DB), oder – falls keine solchen existieren – an den SUPERUSER. Der „Aktivieren"-Button ist erst aktiv wenn `hasSubmittedDocuments = true` (und `member.hasInvite = true`); neben dem Titel „Vertragsunterlagen" erscheint ein „Noch nicht eingereicht"-Hinweis solange noch nicht eingereicht wurde. Im **Kein-Invite-Workflow** ist „Aktivieren" immer aktiv (unabhängig von `hasSubmittedDocuments`). Sind keine Vertragsvorlagen konfiguriert, erscheint ein oranger Hinweis (für MEMBER: „Die Kita hat noch keine Vertragsunterlagen hinterlegt."; für `canManageMembers`: mit Link zu `/contract-templates`).
- **Kein-Invite-Workflow**: Wird ein Kind ohne Einladung angelegt (`sendInvite = false`), ist `member.hasInvite = false`. Auf der Detailseite zeigt `canManageMembers` statt der Template-Liste direkt ein Upload-Interface (`documents/contract/`). Es erscheint kein „Noch nicht eingereicht"-Hinweis. „Aktivieren" ist sofort aktiv. Nach dem Aktivieren wird `member.hasInvite` lokal auf `true` gesetzt; direkt hochgeladene Dateien bleiben über `filteredDocuments` sichtbar.
- **filteredDocuments**: Computed in `pages/ini/[slug]/members/[id]/index.vue` — S3-Dateien aus `documents/`, die nicht bereits als Template-Einreichung (über `MemberDocument`-Eintrag) erfasst sind. `s3Key` wird base64url-kodiert gegen `d.id` verglichen. Wird in der `canManageMembers`-Sektion nur angezeigt wenn `member.status === 'REGISTERED' && member.hasInvite` (verhindert Doppeldarstellung nach Aktivierung, da der ACTIVE-Block ohnehin alle Dokumente zeigt).
- **isOwnChild**: `GET /api/ini/{slug}/members` gibt für jeden Member `isOwnChild: boolean` zurück — `true` wenn eine Guardian-Email des Kindes mit einer Email des eingeloggten Users übereinstimmt (für MEMBER: eigene Guardian-Emails; für andere Rollen immer `false`). Der Members-Endpoint filtert **nicht** mehr serverseitig — alle Member werden zurückgegeben, die Filterung auf eigene Kinder erfolgt clientseitig (`DashboardMyKids`, `members/index.vue`). Der Detail-Endpoint (`GET /api/ini/{slug}/members/{id}`) schreibt `isOwnChild` direkt ins Member-Objekt; `computeIsOwnChild()` auf der Detailseite berechnet den Wert client-seitig (MEMBER = immer `true` da Server Zugriff bereits erzwingt; SUPERUSER = Admin-Email vs. Guardian-Emails). `GET /api/ini/{slug}/members` liefert außerdem `hasInvite` korrekt (Invite-Tabelle via `inviteUserIds`-Set, parallel zu anderen Queries) — war vorher fälschlicherweise immer `false`.
- **Confirm-Dialoge**: Kind anlegen mit Invite → „Kind anlegen und Einladung senden?"; Speichern mit geänderter E-Mail → „Die E-Mail-Adresse wurde geändert. [...] Speichern und E-Mail-Hinweis versenden?"; Aktivieren → „[Name] aktivieren? Die Erziehungsberechtigten erhalten eine Bestätigungs-E-Mail."; Abmelden → „Kind abmelden?"; Löschen / Kind entfernen → „Kind wirklich dauerhaft entfernen? Die Eltern erhalten eine E-Mail."; Datei löschen → „Datei unwiderruflich löschen?"; Einreichen → „Unterlagen einreichen? Die Kita erhält eine Benachrichtigung."
- **Weitere Unterlagen**: Für aktive Kinder gibt es einen separaten Bereich „Weitere Unterlagen". Dateien landen im S3-Prefix `members/{memberId}/other/`. Sowohl MEMBER (Guardian) als auch `canManageMembers` dürfen Dateien hinzufügen, ersetzen und löschen (`DELETE /api/ini/{slug}/members/{id}/documents/other/{fileId}` — Guardian oder `canManageMembers` berechtigt). Der Fehler beim „Ändern" einer einzelnen Datei wird per-file angezeigt (`otherReplaceError`/`otherReplaceErrorFileId`), der Fehler beim „Datei hinzufügen" inline unter dem Button.
- **Wall / Aktuell** (`/ini/{slug}/wall`): SUPERUSER und MANAGER können Einträge vom Typ `document` (Datei-Upload → S3) oder `link` (externe URL → nur DB) anlegen, sortieren (Drag & Drop) und löschen. Datenbank-Tabelle `Document` (`clubId`-isoliert) speichert `name`, `order`, `type` (`"document"` | `"link"`), optional `fileName`, `s3Key` und `url`. API-Endpunkte: `GET/POST /api/ini/{slug}/documents`, `PATCH/DELETE /api/ini/{slug}/documents/{fileId}`, `PUT /api/ini/{slug}/documents/reorder`, `GET /api/ini/{slug}/documents/{fileId}/download` — Pfade bleiben `/documents`, nur die Frontend-Route heißt `/wall`. POST erkennt am Content-Type ob JSON (Link) oder Multipart (Datei). Dashboard-Card `DashboardWall` zeigt Einträge in `order`-Reihenfolge mit Links/Downloads sowie „Bearbeiten"-Button für SUPERUSER/MANAGER. Beide Komponenten (`DashboardWall.vue` und `wall.vue`) nutzen `useDocumentsStore` — Mutationen (anlegen, ersetzen, löschen, sortieren) aktualisieren den Store direkt ohne Re-Fetch.
- **Elternposten** (`/ini/{slug}/parent-jobs`): SUPERUSER und MANAGER können Elternposten anlegen, umbenennen (Stift-Icon neben dem Titel im Edit-Mode), mit einem Emoji-Icon versehen (Select, 5rem breit), sortieren (Drag & Drop) und löschen. Jeder Posten kann mehrere Mitglieder haben; Mitglieder werden per E-Mail-Adresse identifiziert (Vorschläge aus den Guardian-E-Mails der Kinderliste). Jeder Posten kann eine **Kontaktperson** haben (`contact_email` + `contact_type`: `PARENT`, `MANAGER` oder `ADMIN`) — gespeichert als Email-Referenz, Name und Telefon werden live per SQL-Subquery aus `members` bzw. `managers` aufgelöst (kein gespeicherter Name); `ADMIN` liefert hardcoded `'Admin'` als Name. Tabellen in der Club-DB: `parent_jobs` (`job_id`, `name`, `icon`, `sort_order`, `contact_email`, `contact_type`) und `parent_job_members` (`member_id`, `job_id`, `email`, `name`, `phone`, `tasks`, `sort_order`). API-Endpunkte: `GET/POST /api/ini/{slug}/parent-jobs`, `GET/PATCH/DELETE /api/ini/{slug}/parent-jobs/{id}`, `PUT /api/ini/{slug}/parent-jobs/reorder`, `POST /api/ini/{slug}/parent-jobs/{id}/members`, `PATCH/DELETE /api/ini/{slug}/parent-jobs/{id}/members/{memberId}`, `PUT /api/ini/{slug}/parent-jobs/{id}/members/reorder`. Die Listenansicht (`parent-jobs/index.vue`) zeigt Cards in einem Grid (`grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4`) mit Drag-Drop-Sortierung in Edit-Mode. Die Detailseite (`parent-jobs/[id].vue`) zeigt Kontaktperson (Person-Icon + Name + Vorstand-Badge + Email/Tel als Links) und eine Mitgliedertabelle (Name + Aufgaben), erlaubt Hinzufügen/Entfernen/Reorder von Mitgliedern, Umbenennen des Postens und Icon-Auswahl (Emoji-Select in Edit-Mode, auto-saven via PATCH). Im Edit-Mode: „Kontaktperson hinzufügen"-Button öffnet gruppiertes Select (Vorstand zuerst, dann Eltern). Oranger Hinweis wenn alle Guardian-E-Mails der Kita bereits in dem Posten sind. `syncParentJobMemberContact` hält E-Mail/Name/Phone in `parent_job_members` synchron wenn Guardian-Daten eines Kindes geändert werden. Beim Löschen eines Kindes werden `parent_job_members`-Einträge entfernt deren E-Mail nicht mehr als Guardian-E-Mail eines anderen Kindes existiert (geprüft via SQL-Subquery in `pgDeleteMember` und im DSGVO-Cleanup). Pinia-Store `stores/parentJobs.ts` wird im Middleware prefetched (analog zu `stores/members.ts`). Migrationen: 002 (initial), 003 (sort_order + tasks), 004 (member sort_order), 007 (drop is_leader), 008 (add icon), 009 (contact_email + contact_type).
- **Dashboard-Komponenten**: Das Dashboard ist vollständig in wiederverwendbare Komponenten unter `components/dashboard/` aufgeteilt, die alle als async (`<script setup>` mit top-level `await`) implementiert sind und gemeinsam in einer `<Suspense>`-Grenze in `dashboard.vue` liegen — ein zentrales `<LoadingBrumm>` für das gesamte Dashboard. Komponenten: `DashboardMyKids` (Anmeldungs-Card für MEMBER, filtert Store-Daten auf `isOwnChild`, zeigt eigene Kinderliste mit Status — kein Link zur Kinderliste), `DashboardOverview` (Stats-Grid für `canManageClub` — also alle MANAGERs unabhängig von `isMemberManager`: 2/3-Card mit Kennzahlen Angemeldete Kinder / Aktiv / Inaktiv + Aufschlüsselung nach Gruppen und Betreuungsumfang + orangene Hinweise; 1/3-Spalte mit Vertragsende- und Abgemeldet-Cards), `DashboardGroups` (TEAM: Kinderliste pro Gruppe als Spalten mit Anzahl, Namen als Links mit Geburtsdatum; Kinder ohne Gruppe als oranger Hinweis unten), `DashboardBirthdays` (TEAM: nächster Geburtstag als gelbe Card mit Alter, Name, Datum, Gruppe; Zwillinge/Kinder mit gleichem Datum und Alter in einer Card; nächste 3 Daten als Liste), `DashboardContacts` (Link zur Adressliste), `DashboardWall` (Wall/Aktuell-Card, zeigt Dateien + Links). „Vertragsende in Jahr" zeigt nur Kinder mit `contractEnd === currentYear && month < 7` (ab August erscheinen sie unter „Vertragsende überschritten"). `stores/members.ts`, `stores/team.ts`, `stores/managers.ts`, `stores/groups.ts` und `stores/documents.ts` deduplizieren parallele Fetch-Aufrufe via Promise-Caching und laden pro Session nur einmal (`fetchPromise` für konkurrierende Aufrufe). Die meisten Stores verwenden `if (data.length > 0) return` als Guard; `stores/documents.ts` nutzt stattdessen ein `isLoaded`-Boolean, damit leere Ergebnismengen nicht als „nicht geladen" interpretiert werden. `middleware/auth.ts` feuert `fetchMembers`, `fetchTeam`, `fetchManagers`, `fetchDocuments` und `fetchMonthly` (aktueller Monat, nur für `canManageClub`) als fire-and-forget bei jedem authentifizierten Routenwechsel mit Slug — dadurch brauchen Seiten keine eigenen `onMounted`-Fetches mehr (Ausnahme: Dashboard-Async-Komponenten mit top-level `await`, die ihren eigenen Fetch behalten). `stores/members.ts` liefert neben `members` auch `groups` (aus dem gleichen `/api/ini/{slug}/members`-Response) und stellt Write-Methoden bereit: `updateMember` (nach Speichern), `removeMember` (nach Löschen), `reactivateMember`, `toggleDisabledMember`, `deactivateMember`, `activateMember` (Status-Aktionen) — alle patchen den Store lokal ohne Re-Fetch. `invalidate()` leert `members`, `groups` und `fetchPromise` und wird nach dem Anlegen eines Kindes aufgerufen (Create-Endpoint gibt kein vollständiges Member-Objekt zurück). Die Kind-Detailseite (`/ini/{slug}/members/{id}`) holt Member-Daten und Gruppen direkt aus dem Store (kein eigener Fetch) und setzt `isLoading = false` sofort nach der Formular-Befüllung — Vertragsunterlagen und Dokumente laden parallel im Hintergrund via `loadMemberDocTemplates()` / `loadDocuments()` / `loadOtherDocuments()` mit eigenen Ladezuständen (`isLoadingTemplates`, `isLoadingDocs`).
- **Kind-Aktionen**: Für aktive Kinder (`status = ACTIVE | INACTIVE`) zeigen sich zwei Buttons: „Deaktivieren/Aktivieren" (togglet zwischen `ACTIVE` ↔ `INACTIVE` in der Datenbank, kein E-Mail-Versand) und „Abmelden" (setzt `status = DEACTIVATED` + `deactivatedAt` in der Datenbank, löscht Sessions, kein E-Mail-Versand). Für abgemeldete Kinder: „Abmeldung rückgängig" (setzt `status = ACTIVE`, löscht `deactivatedAt`, kein E-Mail) und „Löschen" (löscht alle DB-Einträge, S3-Objekte und Club-DB-Zeile + sendet E-Mail an beide Erziehungsberechtigten). Für noch nicht aktivierte Kinder (`status = PENDING_INVITE | REGISTERED`): „Aktivieren" + „Kind entfernen" (wie „Löschen").
- **Zuschläge**: Jedes Kind kann mehrere Zuschläge tragen (`surcharges: string[]`, gespeichert als kommaseparierter String in der Club-DB). Aktuell verfügbare Schlüssel: `ndhs` (NdHS), `qm` (QM/MSS), `integration_a` (Integration Typ A), `integration_b` (Integration Typ B). Neue Zuschläge werden in `SURCHARGE_OPTIONS` in `utils/config.ts` ergänzt — keine Schema-Änderung nötig. Nur `canManageMembers` kann Zuschläge bearbeiten.
- **Betreuungsumfang (careType)**: Pflichtfeld für die Kostenerstattungsberechnung. Gespeichert als String-Key in der Club-DB. Mögliche Werte: `full_extended`, `full`, `part`, `half_with_meal`, `half_without_meal`. Nur `canManageMembers` kann den Betreuungsumfang setzen. Aktive Kinder ohne `careType` erhalten in der Kinderliste einen Warnhinweis.
- **Vertragsende (contractEnd)**: Gespeichert als Jahreszahl (z.B. `"2026"`) in der Club-DB. Das Vertragsjahr endet jeweils am 31. Juli — ein Kind mit `contractEnd = "2026"` wird ab August 2026 aus allen Berechnungen ausgeschlossen (`isContractActive()` in `utils/reimbursement.ts`). Wird in der Kinderliste als eigene Spalte angezeigt (alle Rollen).
- **Letzte Änderung (lastEditedAt / lastEditedBy)**: Werden bei jedem Speichern server-seitig in `updateMemberData` gesetzt und in der Club-DB geschrieben. Editorname wird aufgelöst nach Rolle: MEMBER → `guardian1Name`, MANAGER → Name aus Club-DB, SUPERUSER → `"Admin"`. Wird auf der Kind-Detailseite in einer `FootnoteCard` angezeigt.
- **FootnoteCard**: Wiederverwendbare Komponente (`components/FootnoteCard.vue`) mit Content-Slot. Passt Border- und Textfarbe automatisch an die Hintergrundfarbe des eingeloggten Users an (`border-ini-300/text-ini-800` für MANAGER, `border-member-300/text-member-800` für MEMBER, `border-team-300/text-team-800` für TEAM, `border-admin-300/text-admin-800` für SUPERUSER). Tailwind-Paletten `member`, `team` und `admin` haben je Abstufungen 200/300/500/700/800.
- **Rechnung-Seite** (`/calculations`): Nur für SUPERUSER und MANAGER. Navigation per URL-Parametern: `?year=` für Jahresansicht, `?year=&month=` für Monatsansicht (default: aktueller Monat), `?edit=1` für Bearbeitungsmodus. Berechnet Einnahmen (Kostenerstattung nach KitaFöG-Sätzen + Zuschläge ndH/QM/Integration + Mitgliedsbeiträge) und Personalschlüssel (Betreuungsstunden, Min. Fachstunden ab `tablet`, Max. Quereinsteigerstd. ab `tablet`, Leitungsstunden) auf Basis der aktiven Kinder. **Finanzdaten** (Einnahmen/Ausgaben) werden in der Club-DB gespeichert: Tabellen `income` (`id`, `name`, `amount`, `recurrence_type`, `start_at`, `end_at`, `group_id`, `item_type`, `sort_order`) und `expenses` (analog ohne `item_type`). Migration 010 legt die Tabellen mit altem Schema an, Migration 011 migriert auf `recurrence_type`/`start_at`/`end_at` (ersetzt `is_recurring`/`month`/`year`). Der Mitgliedsbeitrag ist ein spezieller Income-Eintrag mit `item_type = 'membership_fee'` (recurring) — kein eigenes Feld mehr in der zentralen DB. **`stores/financials.ts`** cacht Monthly-Daten pro Key `"{year}-{month}"` und Annual-Daten pro Jahr; `invalidateAnnual` + refetch im edit-Watch verhindert leere `CalculationsTitleCard` nach dem Speichern. `middleware/auth.ts` prefetcht aktuellen Monat als fire-and-forget. **`CalculationsTitleCard.vue`** (geteilt zwischen Monats- und Jahresansicht): kombiniertes Card mit Titel-Header (Slots `#center`, `#action`, default), 12-Monats-Chart (Einnahmen grau solid, Ausgaben Schrägstreifen; hover/selected: dunkelgrau + rot) und Saldo-Grid — alles in einem `overflow-x-auto`-Container mit `min-width: 5rem` pro Monatsspalte. Default-Slot enthält links Einnahmen/Ausgaben (grid-Layout für bündige Werte) und rechts den Saldo. **`MonthTitleCard.vue`** nur noch im Bearbeitungsmodus. Jahresansichten zeigen farbige Perioden-Marker für den jeweils gültigen RV-Tag-Ratensatz (`RATE_PERIOD_COLORS`). Berechnungslogik in `utils/reimbursement.ts`, Ratentabellen (periodenbezogen) in `utils/rates/` (`getRatesForDate`, `getRateIndex`). Quellenangabe: Roland Kern, DaKS e.V. **Gesamterstattung (Land Berlin)**: `baseTotal` wird pro Kind um `rates.mealAllowance` (23 €, Anteil Eltern Essen) reduziert — entspricht dem ISBJ-Anteil Bezirk. Der Essen-Anteil (`mealTotal` im `ReimbursementResult`) fließt stattdessen unter „Mitgliedsbeiträge" ein, das in Monatssicht in „└ Beitrag" und „└ Essen (N Kinder)" aufgeteilt wird. „Gesamteinnahmen" = `reimbursement.total + mealTotal + membershipFees` (unverändert hoch). **Zahlenformatierung**: Einzelposten Einnahmen und Ausgaben: 2 Nachkommastellen (`formatEurExpense`); Summenwerte, Erstattungen, Saldo: gerundet ohne Nachkommastellen (`formatEur`); Personalschlüssel-Zahlen: `toLocaleString('de-DE')` mit Komma. **Jahresansicht**: Titel „Jahresansicht YEAR" mit optionalem `titleSuffix`-Prop (grau, via `CalculationsTitleCard.vue`) — laufendes Jahr zeigt „– Stand TT. Monat". Im Title-Card-Default-Slot: laufendes Jahr zeigt Einnahmen/Ausgaben links (nur Monate 1–aktueller Monat) und Saldo rechts; Folgejahr zeigt nur den „Saldo"-Label mit „–" (kein Wert), Einnahmen/Ausgaben ausgeblendet. Separate Card darunter: **„Prognose YEAR"** (laufendes Jahr, wenn mind. 1 Vormonat vorhanden): Ø-Monatssaldo der Vormonate auf 12 Monate hochgerechnet, mit `≈`-Prefix. **„Vorschau YEAR"** (Folgejahr): zeigt tatsächliche Jahressummen aus wiederkehrenden Posten — kein `≈`, da echte Daten. Lade-Animation (`<LoadingBrumm>`) während Daten noch nicht im Cache.
- **Gruppen**: Gespeichert in der Club-DB (Tabelle `groups`, Spalten: `groupId`, `name`, `email`). `server/utils/groupData.ts` stellt `getAllGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup` bereit. SUPERUSER kann Gruppen anlegen, bearbeiten und löschen (`/ini/{slug}/groups`). Die `groupId` eines Kindes wird in der `members`-Tabelle gespeichert; bei der Kinderliste wird die Gruppe per `groupMap` angereichert. Nur SUPERUSER hat Zugriff auf die Gruppen-Verwaltung. `GET /api/ini/{slug}/members` gibt `groups` als separates Array zurück (geordnet wie in der DB), sodass die Adressliste keine eigene API-Anfrage braucht.
- **Kind-Status**: Modelliert als `MemberStatus`-Enum in der Datenbank (`User.status`). Reihenfolge: `PENDING_INVITE` (offener Invite, UI: „Ausstehend") → `REGISTERED` (Invite geklickt oder Superuser ist Guardian, UI: „Bestätigt") → `ACTIVE` (aktiviert, UI: „Aktiv") / `INACTIVE` (temporär deaktiviert, reversibel per Toggle ACTIVE ↔ INACTIVE, UI: „Inaktiv" — dient zur Simulation in der Berechnung) / `DEACTIVATED` (`deactivatedAt` gesetzt in der Datenbank, UI: „Abgemeldet" — automatische Löschung nach 1 Jahr). Erlaubte Übergänge sind zentral in `server/utils/memberStatus.ts` (`assertValidTransition`) definiert. `INACTIVE` und `DEACTIVATED` sind von der Kostenerstattungs- und Personalschlüssel-Berechnung ausgeschlossen. Status-Badge-Farben: ACTIVE grün, INACTIVE und REGISTERED lila, PENDING_INVITE orange, DEACTIVATED grau.
- **storageId**: In der zentralen Datenbank wird die 8-stellige `storageId` (cuid2) gespeichert und dient als Primärschlüssel in der Club-DB (`members.storage_id`).
- **Auth**: Magic Link (15 min) für SUPERUSER, MANAGER und TEAM; Invite-Link (7 Tage) für Eltern. HttpOnly Cookie, max. 1 aktive Session pro User. Logout leitet auf `/login/{slug}`
- **Invite-Logik**: Beim Anlegen eines Kindes kann `canManageMembers` per Checkbox „Eltern zum Unterlagen-Upload einladen" (default: aktiv) steuern, ob ein Invite-Link per E-Mail verschickt wird. Sind keine Vertragsvorlagen vorhanden, ist die Checkbox disabled und `sendInvite` wird automatisch auf `false` gesetzt; ein grauer Hinweis mit Link zu `/contract-templates` erscheint. Ist mindestens eine Guardian-Email identisch mit `club.adminEmail` (`hasSuperUserEmail`), wird sofort ein Invite mit `isUsed: true` erstellt → Kind startet mit `status = REGISTERED`. Ohne `hasSuperUserEmail` und mit aktivem `sendInvite` startet das Kind mit `status = PENDING_INVITE`. Beim Klick auf den Invite-Link setzt `verify/[token].get.ts` den Status auf `REGISTERED`. `Member.hasInvite` (API-Feld, aus der `Invite`-Tabelle: `!!anyInvite`) zeigt ob je ein Invite für dieses Kind erstellt wurde — steuert welcher Workflow auf der Detailseite greift (Template-Liste vs. Direkt-Upload)
- **Magic-Link-Lookup**: 1. `Club.adminEmail` prüfen (deckt SUPERUSER ab), 2. `findMemberIdByEmail` + `findManagerIdByEmailPg` + `findTeamMemberIdByEmailPg` parallel in der Club-DB (Priorität MANAGER > TEAM > MEMBER); bei Manager-/Team-Treffer wird User via `storageId` gesucht. Existiert die userId nicht mehr in der Datenbank, wird kein Link erzeugt (stilles Fehlschlagen)
- **Verify-Endpoint**: `/api/ini/{slug}/auth/verify/{token}` prüft zuerst `MagicLink`, dann `Invite` – ein Token-Typ reicht für beide Auth-Flows. MEMBER wird nach `/dashboard` weitergeleitet. Hat der MagicLink ein `pendingPinHash`, wird nach dem Einlösen automatisch eine `DeviceSession` angelegt und `device_token`-Cookie gesetzt. Hat der MagicLink ein `pendingDeviceTokenToDelete`, wird die zugehörige `DeviceSession` gelöscht und der Cookie geleert (PIN-vergessen-Flow). **OTP-Verify-Endpoint**: `POST /api/ini/{slug}/auth/verify-otp` akzeptiert einen 6-stelligen numerischen Code (`otpCode` aus `MagicLink`), validiert ihn gegen `clubId`, setzt dieselben Session- und Device-Session-Cookies wie der Token-Endpoint. Rate Limit: 3/min. Endpunkt ist in `PUBLIC_ROUTES` (`server/middleware/auth.ts`) eingetragen. `maybeCreateDeviceSession` ist in `server/utils/deviceSession.ts` ausgelagert und wird von beiden Verify-Endpoints geteilt
- **Angemeldet bleiben (PIN-Auth)**: Opt-in beim Magic-Link-Login via Checkbox + 4-stelliger PIN. Ablauf: (1) Nutzer wählt „Angemeldet bleiben", tippt 4-stellige PIN, sendet Magic Link → PIN-Hash wird in `MagicLink.pendingPinHash` gespeichert. (2) Beim Einlösen des Links (via Token-URL **oder OTP-Code**) legt der jeweilige Verify-Endpoint eine `DeviceSession` an (pinHash, deviceToken, 90 Tage) und setzt `device_token` als HttpOnly Cookie. (3) Nächste Anmeldung: Cookie erkannt → PIN-Numpad statt E-Mail-Formular. (4) `POST /api/ini/{slug}/auth/pin` verifiziert PIN per scrypt, rotiert `deviceToken` bei Erfolg. (5) 3 Fehlversuche → `DeviceSession.lockedAt` gesetzt → Sperre-Meldung, Magic-Link-Fallback. **PIN vergessen**: `POST /api/ini/{slug}/auth/pin-forgot` liest `device_token` Cookie → ermittelt User-Email je nach Rolle (SUPERUSER: `club.adminEmail`, MEMBER: `memberData.email1`, MANAGER/TEAM: Club-DB-Lookup via `storageId`) → erstellt MagicLink mit `pendingDeviceTokenToDelete` → sendet Email „PIN löschen und anmelden". Beim Einlösen wird DeviceSession gelöscht und Cookie geleert. Auf der Login-Seite erscheint nur noch „PIN vergessen" unten. PIN-Hashing via scrypt (Node.js built-in, kein extra Dependency) in `server/utils/pinHash.ts`. Cookies: `device_token` (HttpOnly, Secure, SameSite=Lax, 90 Tage)
- **MANAGER-Rolle**: Beim Anlegen eines Managers werden zwei DB-Einträge erstellt: ein `Manager`-Record (`id`, `clubId`, `storageId`, `isMemberManager`) und ein `User`-Record (`role: MANAGER`, gleiche `storageId`). Beide teilen dieselbe `storageId` als Verknüpfung. Keine `UserEmail` in der Datenbank – die E-Mail lebt in der Club-DB. Persönliche Daten (Name, E-Mail) leben in der Club-DB (Tabelle `managers`). Beim Anlegen wird direkt ein Magic Link (15 min) erzeugt und in der Willkommens-E-Mail mitgeschickt. Beim Löschen eines Managers werden Manager-Record und User-Record (inkl. Sessions, MagicLinks) entfernt
- **TEAM-Rolle**: Analog zu MANAGER. Beim Anlegen werden ein `Team`-Record (`id`, `clubId`, `storageId`) und ein `User`-Record (`role: TEAM`, gleiche `storageId`) erstellt. Persönliche Daten (Name, E-Mail) leben in der Club-DB (Tabelle `team`). Beim Anlegen wird ein Magic Link erzeugt und eine Willkommens-E-Mail gesendet. Beim Löschen werden Team-Record und User-Record (inkl. Sessions, MagicLinks) entfernt. TEAM sieht im Nav den Eintrag „Elternposten"; SUPERUSER verwaltet Team unter `/ini/{slug}/team`. TEAM darf Kinderdaten lesen (read-only via `:inert`), aber keine Unterlagen sehen, kein Kind anlegen; Back-Link auf Kind-Detailseite zeigt zum Dashboard. Dashboard zeigt `DashboardGroups` + `DashboardBirthdays` (2/3 + 1/3), `DashboardContacts` und `DashboardWall`. Hintergrundfarbe: `bg-team` (`#f2baba`), Tailwind-Palette `team` (200/300/500/700/800). SUPERUSER: `bg-admin` (`#aac3de`), Tailwind-Palette `admin` (200/300/500/700/800). MANAGER: `bg-ini`. Adressenseite zeigt am Ende `ContactTable`-Cards für Team und Vorstand (Name + E-Mail); Daten werden parallel geladen, Fehler (fehlende Berechtigung) werden still ignoriert.
- **canManageMembers**: `SUPERUSER` oder `MANAGER` mit `isMemberManager = true`. Nur diese dürfen Kinder anlegen, bearbeiten, aktivieren, deaktivieren, löschen, Einladungen verwalten und Vertragsvorlagen (`/contract-templates`) verwalten. Frontend-Buttons und alle Member-API-Endpoints sowie contract-template-Endpoints prüfen diese Bedingung
- **E-Mail-Benachrichtigungen**: Invite-E-Mail (`sendInviteEmail`): Betreff „Einladung: [Name] bei [Kita]"; Text „wurde eingeladen" (nicht „angemeldet"); Link-Text „Jetzt bestätigen"; Hinweis erklärt dass nach Bestätigung Profil und Unterlagen eingerichtet werden können. Eltern erhalten E-Mails bei: Invite (Kind anlegen), Aktivieren (inkl. Dashboard-Link), Kind entfernen/Löschen, eigene E-Mail-Adresse geändert. `canManageMembers` erhält E-Mail wenn MEMBER Unterlagen einreicht (`sendDocumentsSubmittedNotification`). Manager und Teammitglieder erhalten beim Anlegen eine Willkommens-E-Mail mit direktem Magic Link (`sendManagerAddedEmail`, `sendTeamAddedEmail`). Beim Entfernen erhalten sie eine Abmelde-E-Mail (`sendManagerRemovedEmail`, `sendTeamRemovedEmail`). Kein E-Mail-Versand bei Abmelden, Deaktivieren oder Abmeldung rückgängig. Alle Eltern-E-Mails verwenden die **„du"**-Ansprache (nie „Sie"). E-Mail-Benachrichtigungen bei E-Mail-Adressänderungen (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) werden im **Kein-Invite-Workflow vor Aktivierung** nicht versendet (`hasInvite = false && status = REGISTERED`).
- **Guardian-Validierung**: `guardianRefinement` in `server/utils/schemas.ts` erzwingt zwei Regeln beim Anlegen und Bearbeiten von Kindern: (1) Ist `guardian2Name` gesetzt, muss `email2` vorhanden sein. (2) `email1` und `email2` dürfen nicht identisch sein. Beide Regeln werden serverseitig via Zod `superRefine` geprüft.
- **E-Mail-Cascade**: Wird `email1` oder `email2` eines Kindes geändert, werden alle anderen Kinder im gleichen Verein mit derselben alten E-Mail automatisch mitaktualisiert. Damit bleibt der Guardian-Email-Filter in der Kinderliste konsistent (MEMBER sieht alle eigenen Kinder). Gilt sowohl für `canManageMembers`-Updates als auch für MEMBER-Selbst-Updates. Die Benachrichtigungs-E-Mails (`sendEmailRemovedNotification`, `sendEmailAddedNotification`) listen alle betroffenen Kinder (das editierte + Geschwister) als `childNames: string[]`, zusammengeführt mit `joinWithAnd` aus `utils/string.ts`. Die `GuardianField`-Komponente zeigt unter dem E-Mail-Feld einen Hinweis wenn die Adresse Geschwister betrifft: grau wenn unverändert („Diese E-Mail gehört auch zu X"), orange wenn geändert oder neu eingetragen („Änderung wird auch automatisch für X übernommen").
- **Optimistic Locking**: `updateMemberInDb` prüft vor dem Schreiben ob `lastEditedAt` noch mit dem vom Client gesendeten `expectedLastEditedAt` übereinstimmt → 409 bei Konflikt. Das Frontend sendet `member.lastEditedAt` bei jedem Save-Request mit.
- **Rate Limiting**: `server/middleware/rateLimit.ts` begrenzt `/api/clubs`, `/api/register` und Magic-Link-Endpunkte auf 5 Anfragen/Minute pro IP (in-memory Map mit TTL). PIN-Endpoint (`/api/ini/{slug}/auth/pin`) und OTP-Endpoint (`/api/ini/{slug}/auth/verify-otp`) sind auf 3 Anfragen/Minute begrenzt. Überschreitung → 429 mit deutscher Fehlermeldung
- **App-Navigation** (`layouts/default.vue`): Die Nav ist in Sektionen mit Dropdowns (Desktop) und Accordions (Mobile) gegliedert. `canManageClub` sieht: **Kinder & Eltern** (Kinder, Elternposten), **Personal** (Team — Direktlink), **Finanzen** (Berechnung — Direktlink). SUPERUSER zusätzlich: **Admin** (Gruppen, Vorstand, Einstellungen — Dropdown). Sektionen mit einem Eintrag werden als Direktlink gerendert, nicht als Dropdown. MEMBER und TEAM sehen einen einfachen Direktlink „Elternposten". Mobile: Burger-Menü öffnet Panel mit Accordion-Sektionen; beim Öffnen wird die aktive Sektion automatisch aufgeklappt, alle anderen geschlossen. Desktop: Klick außerhalb oder Escape schließt offenes Dropdown.
- **Öffentliche Seiten**: `/`, `/login`, `/login/{slug}`, `/register`, `/about`, `/preview`, `/guide`, `/legal`, `/privacy` verwenden `layout: 'public'` (`layouts/public.vue`). Dort: Skip-Link, Header mit responsiver Nav (unter `tablet`-Breakpoint als Burger-Menü; Escape + Route-Wechsel + Resize schließen das Menü; WCAG-konform mit `aria-expanded`, `aria-controls`, dynamischem `aria-label`), Bären-SVG-Logo, Beta-Badge, Footer mit Links zu `/legal` (Impressum) und `/privacy` (Datenschutz). `error.vue` (root) behandelt 404 und generische Fehler — verwendet `NuxtLayout name="public"` für konsistente Nav
- **Vereinsname ändern**: `PATCH /api/ini/{slug}/settings/name` (nur SUPERUSER). Validiert 1–100 Zeichen, schreibt `Club.name` in die Datenbank, aktualisiert sofort `authStore.currentClub.name`. Einstellungsseite zeigt Inline-Edit mit „Ändern"-Button neben dem Namen.
- **Verein löschen** (`DELETE /api/ini/{slug}/settings/delete`): Löscht in einer Prisma-Transaktion: Sessions, MagicLinks, Invites, MemberDocuments, Users, DocumentTemplates, Managers, Club. Seitenroute liegt in `pages/ini/[slug]/settings/index.vue` (Einstellungen) und `pages/ini/[slug]/settings/delete.vue` (Löschen) — `settings/index.vue` statt `settings.vue` damit beide Routen unabhängig funktionieren
- **DSGVO-Cleanup** (`netlify/functions/cleanup.ts`): Läuft täglich als Netlify Scheduled Function. Löscht abgemeldete Kinder (`status = DEACTIVATED`, `deactivatedAt <= 1 Jahr`) nach 1 Jahr vollständig — DB-Einträge (User, Sessions, MagicLinks, Invites, MemberDocuments) sowie Club-DB-Zeile und S3-Objekte. Query ist explizit auf `role: 'MEMBER'` beschränkt. Löscht zusätzlich alle abgelaufenen `DeviceSession`-Einträge (`expiresAt < now`).
- **PWA**: `@vite-pwa/nuxt` generiert Service Worker und `manifest.webmanifest`. Strategie: App Shell (JS, CSS, Fonts, HTML precached) + `NetworkOnly` für alle `/api/*`-Calls → keine Nutzerdaten werden gecacht (DSGVO). `pages/offline.vue` als Fallback-Seite. `plugins/offline.client.ts` hört auf `offline`/`online`-Events und leitet bei Verbindungsverlust auf `/offline` um, bei Rückkehr zurück auf `/`. iOS-Meta-Tags (`apple-mobile-web-app-capable` etc.) in `nuxt.config.ts` `app.head`. `public/site.webmanifest` entfernt — Plugin generiert `manifest.webmanifest` beim Build.
- **ISBJ Trägerportal**: SUPERUSER kann unter Einstellungen eine Verbindung zum ISBJ-Trägerportal (Dienstschnittstelle) konfigurieren. Konfiguration: `host`, `username`, `traegerNummer`, `einrichtungsNummer`, API-Key und PKCS12-Zertifikat. Zertifikat und API-Key werden AES-256-GCM-verschlüsselt in `ClubISBJConfig` gespeichert. Authentifizierung: zweifaktorig — mTLS via PKCS12-Client-Zertifikat (`node:https` mit `https.Agent({ pfx, passphrase })`) + HMAC-SHA256-Header (`Authorization: HMAC username:base64hmac`, Input: `METHOD\nnormalizedPath\nmd5(body)\ndateRFC1123`). API-Basis: `/api/v1/betreuung/` (JSON). Pro-Club Agent-Cache in `server/utils/isbjClient.ts`. Zugangsdaten werden per Post von SenBJF angefordert (E-Mail an `traeger-service@senbjf.berlin.de`, Betreff: `Dienstschnittstelle`).
- **Netlify**: `NETLIFY_NEXT_PLUGIN_SKIP = "true"` in `netlify.toml` verhindert, dass der global installierte `@netlify/plugin-nextjs` beim Nuxt-Build fälschlicherweise ausgeführt wird. `netlify/functions/deploy-succeeded.ts` läuft nach jedem erfolgreichen Deployment als Event-Handler und führt ausstehende SQL-Migrationen auf allen Club-Datenbanken durch. Ergebnis (angewendete Migrations oder Fehler) wird als `AuditLog`-Eintrag gespeichert (`event: DEPLOY_MIGRATION_DONE` / `DEPLOY_MIGRATION_FAILED`, `severity: INFO` / `ERROR`)

## Environment Variables
```
DATABASE_URL          # PostgreSQL Pooled Connection (PgBouncer, used at runtime)
DIRECT_URL            # PostgreSQL Direct Connection (no pooler, used for migrations)
RESEND_API_KEY        # Resend (plattformweiter E-Mail-Dienst)
EMAIL_FROM            # Absender-Adresse (z.B. "Brumm <noreply@example.com>")
ADMIN_SECRET          # Brumm Admin-Bereich (/admin)
APP_URL               # Basis-URL der App (z.B. http://localhost:3001)
ENCRYPTION_KEY        # AES-256-GCM Key (genau 64 Hex-Zeichen / 32 Bytes) – verschlüsselt Club-DB-DSNs und S3-Credentials → openssl rand -hex 32
DEV_EMAIL_WHITELIST   # Optional: kommaseparierte Whitelist – nur diese Adressen erhalten E-Mails in Dev (leer = alle erlaubt)
```

## Wichtige Pfade
| Bereich | Pfad |
|---|---|
| App-Konfiguration (Upload-Limits etc.) | `utils/config.ts` |
| String-Hilfsfunktionen (`joinWithAnd` etc.) | `utils/string.ts` |
| Ratentabellen (RV-Tag, periodenabhängig) | `utils/rates/` (`index.ts` → `getRatesForDate`/`getRateIndex`, `types.ts`, `rvtag/`) |
| Prisma Schema | `prisma/schema.prisma` |
| Zod Schemas (API-Validierung) | `server/utils/schemas.ts` |
| Mitgliederdaten (Postgres) | `server/utils/memberData.ts` |
| Status-Transitionen (assertValidTransition) | `server/utils/memberStatus.ts` |
| Dashboard-Komponenten | `components/dashboard/` (alle async mit top-level `await`, gemeinsam in `<Suspense>`) |
| Kontakttabelle (Name + E-Mail, wiederverwendbar) | `components/ContactTable.vue` |
| Guardian-Felder (Name, E-Mail, Telefon pro Elternteil) | `components/GuardianField.vue` |
| Sortierbarer Tabellen-Header (WCAG) | `components/SortableTableHeader.vue` |
| Lade-Animation (hüpfendes Emoji, WCAG) | `components/LoadingBrumm.vue` |
| Inline-SVG-Icons (`name`-Prop: `person`, `pencil`, `chevron-down`, `calendar`) | `components/AppIcon.vue` |
| PIN-Eingabe (4-stellig, Numpad-Style, `showSubmit`-Prop für expliziten ↵-Button) | `components/PinInput.vue` |
| OTP-Eingabe (6 Einzelfelder, Copy-Paste + Autocomplete) | `components/OtpInput.vue` |
| PIN-Hashing (scrypt) | `server/utils/pinHash.ts` |
| PIN-Auth Endpoints (device GET/DELETE, pin POST, pin-forgot POST) | `server/api/ini/[slug]/auth/device.get.ts`, `device.delete.ts`, `pin.post.ts`, `pin-forgot.post.ts` |
| OTP-Verify Endpoint | `server/api/ini/[slug]/auth/verify-otp.post.ts` |
| DeviceSession-Helper (geteilt von verify + verify-otp) | `server/utils/deviceSession.ts` |
| Offline-Fallback-Seite (PWA) | `pages/offline.vue` |
| Offline-Erkennung (Client-Plugin) | `plugins/offline.client.ts` |
| Managerdaten (Postgres) | `server/utils/managerData.ts` |
| Teamdaten (Postgres) | `server/utils/teamData.ts` |
| Storage Utils | `server/utils/storage/` |
| E-Mail Utils | `server/utils/email.ts` |
| Rate Limiting | `server/middleware/rateLimit.ts` |
| Server Middleware | `server/middleware/` |
| API Routes | `server/api/` |
| Pinia Stores | `stores/` |
| Types | `types/` |
| Netlify Cleanup | `netlify/functions/cleanup.ts` |
| Netlify Deploy-Hook (Postgres-Migrationen) | `netlify/functions/deploy-succeeded.ts` |
| Verschlüsselung (AES-256-GCM für DSN + S3-Config) | `server/utils/encryption.ts` |
| Per-Club Postgres Client Cache | `server/utils/clubDatabase.ts` |
| Per-Club S3 Client Cache | `server/utils/s3Client.ts` |
| SQL-Migrationsskripte (Club-DBs) | `server/utils/migrations/runner.ts`, `migrations/sql/` |
| Postgres Storage (members/managers/groups/team) | `server/utils/storage/postgres/` |
| Elternposten Daten + API-Hilfsfunktionen | `server/utils/parentJobData.ts` |
| Elternposten Postgres Storage | `server/utils/storage/postgres/parentJobs.ts` |
| Elternposten API Routes | `server/api/ini/[slug]/parent-jobs/` |
| Elternposten Pinia Store | `stores/parentJobs.ts` |
| Elternposten Seiten | `pages/ini/[slug]/parent-jobs/` |
| Berechnung: Titel+Chart+Saldo-Card (geteilt Monat/Jahr) | `components/CalculationsTitleCard.vue` |
| Berechnung: Titel-Card im Bearbeitungsmodus | `components/MonthTitleCard.vue` |
| Finanzdaten Store (monthly + annual cache, invalidate) | `stores/financials.ts` |
| S3 Storage Utils (Upload, Download, Delete, Presign) | `server/utils/storage/s3/files.ts` |
| Settings API (Datenbank-Backend) | `server/api/ini/[slug]/settings/database.*` |
| Settings API (Datei-Storage-Backend) | `server/api/ini/[slug]/settings/file-storage.*` |
| ISBJ Trägerportal Client (mTLS + HMAC) | `server/utils/isbjClient.ts` |
| ISBJ Settings API | `server/api/ini/[slug]/settings/isbj.*`, `isbj/test.post.ts` |
| Prod-DB-Migration (flatten Club config) | `prisma/migrations/flatten_club_config.sql` |
| Test Specs (shared) | `tests/specs/` |
| E2E Playwright Konfiguration | `playwright.config.ts` |
| Smoke Playwright Konfiguration | `playwright.smoke.config.ts` |
| Test DB Setup / Seed | `tests/global-setup.ts` |

## Datenbank
```bash
npm run db:push            # Schema pushen
npm run db:migrate         # Migration erstellen
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

`.env.smoke` benötigt: `APP_URL`, `DATABASE_URL` (Test-App), `SMOKE_SLUG`, `SMOKE_EMAIL`.

### Beide zusammen
```bash
npm test   # erst E2E, dann Smoke
```
