# Brumm

Multi-Tenant SPA für Kindergarten-Vereinsverwaltung. Jeder Verein ist komplett isoliert und hat einen eigenen Slug.

**Datentrennung**: Neon speichert ausschließlich technische Auth-Daten. Alle persönlichen Mitgliederdaten (Name, Geburtsdatum, E-Mails, Telefonnummern) sowie Vorstandsdaten leben pro Verein in Google Sheets – kein globaler Service Account, keine persönlichen Daten in der zentralen Datenbank.

## Stack

- **Nuxt 3** – Hybrid SSG/SPA
- **Prisma + Neon** – PostgreSQL (nur Auth/Tech-Daten, Multi-Tenant via `clubId`)
- **Google Drive + Sheets** – Persönliche Mitgliederdaten, Storage pro Verein (OAuth 2.0)
- **Resend** – Transaktionale E-Mails
- **Tailwind CSS + Reka UI** – UI
- **Netlify** – Hosting + Scheduled Functions

## Setup

```bash
cp .env.example .env
# .env befüllen (siehe .env.example)

npm install
npm run db:push
npm run dev
```

Ohne Google-Credentials (kein Onboarding) werden Mitgliederdaten als Dev-Fallback in `User.localData` (Neon) gespeichert und nach dem Storage-Onboarding automatisch nach Sheets migriert.

## URL-Struktur

```
/                                  → Globaler Login (Email-Lookup über alle Vereine)
/register                          → Verein registrieren
/admin                             → Brumm Admin (ADMIN_SECRET)
/ini/{slug}/login                  → Anmeldung per Magic Link
/ini/{slug}/auth/verify/{token}    → Magic Link / Invite einlösen
/ini/{slug}/onboarding             → Google Drive einrichten
/ini/{slug}/dashboard
/ini/{slug}/addresses              → Adressliste aller aktiven Kinder
/ini/{slug}/members
/ini/{slug}/members/create         → Kind anlegen
/ini/{slug}/members/{id}           → Kind-Detailseite & Vertragsunterlagen
/ini/{slug}/members/deactivate     → Selbst abmelden
/ini/{slug}/contract-templates     → Vertragsvorlagen verwalten (SUPERUSER + isMemberManager)
/ini/{slug}/groups                 → Gruppen verwalten (SUPERUSER)
/ini/{slug}/groups/create         → Gruppe anlegen
/ini/{slug}/groups/{id}           → Gruppe bearbeiten
/ini/{slug}/management             → Vorstand verwalten (SUPERUSER)
/ini/{slug}/management/create      → Vorstand hinzufügen
/ini/{slug}/management/{id}        → Vorstand bearbeiten
/ini/{slug}/settings
/ini/{slug}/settings/delete        → Verein löschen
```

## Rollen

| Rolle | Rechte |
|---|---|
| `SUPERUSER` | Alles: Kinder anlegen/bearbeiten/freischalten/abmelden, Vertragsvorlagen, Vorstand, Gruppen, Settings, Google Drive verbinden. Beim Anlegen kann per Checkbox gesteuert werden, ob eine Einladungs-Email verschickt wird. |
| `MANAGER` | Vorstandsmitglied. Mit `isMemberManager = true`: Kinder anlegen/bearbeiten/freischalten/abmelden, Vertragsvorlagen verwalten |
| `TEAM` | Alle Daten lesen |
| `MEMBER` | Elternteil eines Kindes – sieht eigene Kinder in der Liste und auf dem Dashboard (ein Status-Block pro Kind). Kann Kontaktdaten (Guardian-Name, E-Mail, Telefon) auf der Kind-Detailseite selbst bearbeiten, Vertragsunterlagen hochladen (max. 1 MB) und weitere Unterlagen nach Aktivierung hoch- oder ersetzen. Klickt „Einreichen" wenn alle Unterlagen vollständig sind – erst danach kann `canManageMembers` das Kind freischalten. |

`canManageMembers` = `SUPERUSER` oder `MANAGER` mit `isMemberManager`

## Lizenz

MIT
