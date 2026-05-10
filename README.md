# Jita

Multi-Tenant SPA für Kindergarten-Vereinsverwaltung. Jeder Verein ist komplett isoliert und hat einen eigenen Slug.

**Datentrennung**: Neon speichert ausschließlich technische Auth-Daten. Alle persönlichen Mitgliederdaten (Name, Geburtsdatum, E-Mails) leben pro Verein in Google Sheets – kein globaler Service Account, keine persönlichen Daten in der zentralen Datenbank.

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
/register                          → Verein registrieren
/admin                             → Jita Admin (ADMIN_SECRET)
/ini/{slug}/login                  → Anmeldung per Magic Link
/ini/{slug}/onboarding             → Google Drive Einrichten
/ini/{slug}/dashboard
/ini/{slug}/members
/ini/{slug}/members/create         → Kind anlegen
/ini/{slug}/members/import         → CSV-Import (max. 50)
/ini/{slug}/members/{id}           → Kind-Detailseite
/ini/{slug}/members/{id}/edit      → Kind bearbeiten
/ini/{slug}/members/deactivate     → Selbst abmelden
/ini/{slug}/groups
/ini/{slug}/settings
/ini/{slug}/settings/delete        → Verein löschen
```

## Rollen

| Rolle | Rechte |
|---|---|
| `SUPERUSER` | Alles: Kinder anlegen/bearbeiten/freischalten/abmelden, Settings, Google Drive verbinden |
| `TEAM` | Alle Daten lesen |
| `MEMBER` | Elternteil eines Kindes – nur eigene Daten |

## Lizenz

MIT
