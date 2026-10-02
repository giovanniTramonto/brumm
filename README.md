# Brumm

Brumm ist eine Verwaltungssoftware für Berliner Elterninitiativ-Kindertagesstätten (EKT) – von der Mitgliederverwaltung über Vertragsunterlagen bis zur KitaFöG-Berechnung.

Mehrere Vereine laufen auf einer Instanz – jeder mit eigenem Slug und getrennten Daten.

**Datentrennung**: Die zentrale Datenbank speichert ausschließlich technische Auth-Daten. Persönliche Mitgliederdaten (Name, Geburtsdatum, E-Mails, Telefonnummern) sowie Vorstandsdaten leben pro Verein in einer eigenen PostgreSQL-Datenbank; Dateien in S3-kompatiblem Storage. Beides wird verschlüsselt konfiguriert – keine persönlichen Daten in der zentralen Datenbank.

## Stack

- **Nuxt 3** – SPA + PWA (`@vite-pwa/nuxt`, App Shell Caching, Offline-Fallback)
- **Prisma + PostgreSQL** – Zentrale DB (nur Auth/Tech-Daten, Multi-Tenant via `clubId`)
- **PostgreSQL** – Pro-Verein-Datenbank für Mitgliederdaten (verschlüsselter DSN in der zentralen DB)
- **S3-kompatibler Storage** – Pro-Verein-Dateispeicher für Vorlagen, Vertragsunterlagen und Aktuell-Dateien
- **Resend** – Transaktionale E-Mails
- **Tailwind CSS + Reka UI** – UI
- **Netlify** – Hosting + Scheduled Functions + deploy-succeeded Hook

## Setup

```bash
cp .env.example .env
# .env befüllen (siehe .env.example)

npm install
npx lefthook install   # Git Hooks einrichten (einmalig)
npm run db:push
npm run dev
npm run clean   # löscht .nuxt, .output, dist (bei Cache-Problemen)
```

Nach dem Start PostgreSQL-DSN und S3-Zugangsdaten unter `/ini/{slug}/settings` eintragen. Für lokales Docker als Club-DSN `?sslmode=disable` anhängen: `postgresql://brumm:brumm@localhost:5433/brumm?sslmode=disable`. Beim Speichern der DSN werden ausstehende Club-DB-Migrationen automatisch ausgeführt.

## ISBJ-Trägerportal (Dienstschnittstelle)

Brumm kann die Kitaverträge eines Vereins live aus dem [ISBJ-Trägerportal](https://www.berlin.de/sen/jugend/traegerservice/isbj/zugang/) lesen (Dashboard-Card „ISBJ-Verträge" für Admin und Vorstand). Aktuell wird **nur gelesen und nichts gespeichert**; geplant ist, Verträge später auch aus Brumm heraus zu ändern. Zugangsdaten trägt der Admin unter `/ini/{slug}/settings` ein; API-Key, Zertifikat und Passwort werden AES-256-GCM-verschlüsselt abgelegt.

**Lokale Entwicklung**: In `.env` auf die Abnahmeumgebung zeigen, damit Dev nie gegen Produktion läuft:

```bash
NUXT_ISBJ_DEFAULT_HOST=dienstschnittstelle.isbja.itdz-berlin.de
```

Ohne Variable gilt Produktion (`dienstschnittstelle.isbjp.itdz-berlin.de`). Für die Abnahme braucht es eigene Zugangsdaten (Zertifikat per E-Mail, PIN per Brief).

**Was abweichend vom [Entwicklerleitfaden](https://www.berlin.de/sen/jugend/traegerservice/isbj/isbj-tragerportal_entwicklerleitfaden-dienstschnittstelle_v202.pdf) gilt** (gegen ISBJ verifiziert):

- **Host**: Der Leitfaden nennt `ds.traegerportal.isbj.verwalt-berlin.de` – existiert nicht mehr. Seit 03/2026: `dienstschnittstelle.isbjp.itdz-berlin.de` (Abnahme: `…isbja…`).
- **Serverzertifikat**: von der Berliner Landes-PKI („Berlin Class2 Root CA 2022"), nicht im Node-Trust-Store → explizit vertraut (`server/utils/isbjCa.ts`).
- **HMAC**: hex-kodiert (der Text sagt base64, das Rechenbeispiel passt nur zu hex); API-Key direkt als String-Schlüssel; der „normalisierte Pfad" ist der Pfad **ohne** Query-String.
- **Daten**: `betreuungsumfang` kommt als Klartext (`Ganztags`), Zuschläge als Kürzel (`NDH`; `QM` laut Leitfaden). `aktiv=true` heißt nur „nicht storniert". ISBJ liefert **keine Namen oder Geburtsdaten** von Kindern – nur eine stabile `kindId` über den Gutschein.
- **Rechte**: Die Vertragsliste enthält nur Verträge, für die der User das Vertrags-Änderungs-Recht der Einrichtung hat. Fehlt es, kommt eine leere Liste statt eines Fehlers (in Produktion so aufgetreten).

## URL-Struktur

```
/                                    → Landing Page
/login                               → Globaler Login (Kita-Auswahl)
/login/{slug}                        → Anmeldung per Magic Link / PIN
/register                            → Verein registrieren
/admin                               → Brumm Admin (ADMIN_SECRET)
/ini/{slug}/auth/verify/{token}      → Magic Link / Invite einlösen
/ini/{slug}/dashboard
/ini/{slug}/addresses                → Adressliste aller aktiven Kinder
/ini/{slug}/members
/ini/{slug}/members/create           → Kind anlegen
/ini/{slug}/members/{id}             → Kind-Detailseite & Vertragsunterlagen
/ini/{slug}/members/deactivate       → Selbst abmelden
/ini/{slug}/contract-templates       → Vertragsvorlagen (SUPERUSER + isMemberManager)
/ini/{slug}/groups                   → Gruppen verwalten (SUPERUSER)
/ini/{slug}/groups/create            → Gruppe anlegen
/ini/{slug}/groups/{id}              → Gruppe bearbeiten
/ini/{slug}/managers                 → Vorstand verwalten (SUPERUSER)
/ini/{slug}/managers/create          → Vorstand hinzufügen
/ini/{slug}/managers/{id}            → Vorstand bearbeiten
/ini/{slug}/team                     → Team verwalten (SUPERUSER)
/ini/{slug}/team/create              → Teammitglied hinzufügen
/ini/{slug}/team/{id}                → Teammitglied bearbeiten
/ini/{slug}/calculations             → Rechnung: Einnahmen, Personalschlüssel (SUPERUSER + MANAGER)
/ini/{slug}/wall                     → Wall / Aktuell (SUPERUSER + MANAGER)
/ini/{slug}/parent-jobs              → Elternposten (SUPERUSER + MANAGER)
/ini/{slug}/parent-jobs/{id}         → Elternposten-Detailseite
/ini/{slug}/settings
/ini/{slug}/settings/delete          → Verein löschen
/offline                             → Offline-Fallback (PWA)
```

## Rollen

| Rolle | Rechte |
|---|---|
| `SUPERUSER` | Alles: Kinder anlegen/bearbeiten/freischalten/abmelden, Vertragsvorlagen, Vorstand, Gruppen, Rechnung (Einnahmen & Personalschlüssel), Settings (PostgreSQL + S3 konfigurieren). Beim Anlegen kann per Checkbox gesteuert werden, ob eine Einladungs-Email verschickt wird. |
| `MANAGER` | Vorstandsmitglied. Zugriff auf Rechnung (Einnahmen & Personalschlüssel) und Elternposten. Mit `isMemberManager = true`: Kinder anlegen/bearbeiten/freischalten/abmelden, Vertragsvorlagen verwalten |
| `TEAM` | Kinderdaten lesen (read-only, keine Unterlagen). Dashboard mit Vereinsunterlagen. Login per Magic Link. Wird ausschließlich von SUPERUSER angelegt und verwaltet. |
| `MEMBER` | Elternteil eines Kindes – sieht eigene Kinder in der Liste (inkl. Betreuungsumfang und Vertragsende) und auf dem Dashboard. Kann das Formular auf der Kind-Detailseite bearbeiten solange das Kind noch nicht aktiv ist. Ab Freischaltung ist das Formular vollständig readonly. Kann Vertragsunterlagen hochladen (max. 1 MB) und weitere Unterlagen nach Aktivierung hoch- oder ersetzen. Klickt „Einreichen" wenn alle Unterlagen vollständig sind. |

`canManageMembers` = `SUPERUSER` oder `MANAGER` mit `isMemberManager`

## Tests

Test-Specs in `tests/specs/` laufen sowohl lokal (E2E) als auch gegen die Netlify-Test-Umgebung (Smoke).

### E2E (lokal)
```bash
docker compose up -d   # Test-DB starten
npm run test:e2e
```

### Smoke (Netlify)
```bash
cp .env.smoke.example .env.smoke
# .env.smoke befüllen (APP_URL, DATABASE_URL, SMOKE_SLUG, SMOKE_EMAIL)
npm run test:smoke
```

### Beide
```bash
npm test   # erst E2E, dann Smoke
```

## Lizenz

Business Source License 1.1 (BSL 1.1)
