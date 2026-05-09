# Jita

Multi-Tenant SPA für Kindergarten-Vereinsverwaltung. Jeder Verein ist komplett isoliert und hat einen eigenen Slug. Dateien und Mitgliederdaten werden über Google Drive und Google Sheets pro Verein gespeichert.

## Stack

- **Nuxt 3** – Hybrid SSG/SPA
- **Prisma + Neon** – PostgreSQL (Multi-Tenant via `clubId`)
- **Google Drive + Sheets** – Storage pro Verein (Service Account)
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

## URL-Struktur

```
/register                          → Verein registrieren
/admin                             → Jita Admin (ADMIN_SECRET)
/ini/{slug}/login                  → Anmeldung per Magic Link
/ini/{slug}/onboarding             → Ersteinrichtung
/ini/{slug}/dashboard
/ini/{slug}/members
/ini/{slug}/members/import         → CSV-Import (max. 50)
/ini/{slug}/groups
/ini/{slug}/settings
/ini/{slug}/account/deactivate
```

## Rollen

| Rolle | Rechte |
|---|---|
| `SUPERUSER` | Alles, inkl. Mitglieder freischalten, Settings |
| `TEAM` | Alle Daten lesen, eigene Daten bearbeiten |
| `MEMBER` | Nur eigene Daten |

## Lizenz

MIT
