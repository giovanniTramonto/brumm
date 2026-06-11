<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Einblicke – Brumm' })

const screens = [
  {
    src: '/images/preview/admin.webp',
    label: 'Admin-Bereich',
    description: 'Zugriff auf Mitglieder, Team, Gruppen und Vereinseinstellungen.',
  },
  {
    src: '/images/preview/manager-dashboard.webp',
    label: 'Vorstand-Dashboard',
    description: 'Kennzahlen, aktive Kinder und anstehende Aufgaben auf einen Blick.',
  },
  {
    src: '/images/preview/manager-member-list.webp',
    label: 'Kinderliste',
    description: 'Alle Kinder mit Status, Gruppe und Vertragsende.',
  },
  {
    src: '/images/preview/manager-calculations-month.webp',
    label: 'Berechnung – Monat',
    description:
      'KitaFöG-konforme Berechnung der Kostenerstattung und des Personalschlüssels – monatsgenau.',
  },
  {
    src: '/images/preview/manager-calculations-year.webp',
    label: 'Berechnung – Jahr',
    description: 'Jahresübersicht der Einnahmen und Personalstunden.',
  },
  {
    src: '/images/preview/member-dashboard.webp',
    label: 'Eltern-Dashboard',
    description: 'Eltern sehen den aktuellen Status ihrer Kinder und aktuelle Mitteilungen.',
  },
  {
    src: '/images/preview/member-onboarding.webp',
    label: 'Onboarding',
    description: 'Vertragsunterlagen einreichen – geführt, Schritt für Schritt.',
  },
  {
    src: '/images/preview/team.webp',
    label: 'Team',
    description: 'Gruppenübersicht und Geburtstage für das pädagogische Team.',
  },
  {
    src: '/images/preview/login-pin.webp',
    label: 'PIN-Anmeldung',
    description: 'Geräteerkennung und PIN – schnell anmelden ohne Passwort.',
  },
]
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24">
    <h1 class="text-3xl font-bold text-gray-900">Einblicke</h1>
    <p class="mt-4 text-gray-500 leading-relaxed">
      Ein Blick in die wichtigsten Bereiche von Brumm.
    </p>

    <div class="mt-12 flex flex-col gap-16">
      <figure v-for="screen in screens" :key="screen.src">
        <figcaption class="mb-3 px-1">
          <p class="font-semibold text-gray-900">{{ screen.label }}</p>
          <p class="mt-0.5 text-sm text-gray-500">{{ screen.description }}</p>
        </figcaption>
        <div class="overflow-hidden rounded-md border border-gray-200 bg-gray-50 shadow-md">
          <img
            :src="screen.src"
            :alt="screen.label"
            class="w-full object-cover object-top"
            loading="lazy"
          />
        </div>
      </figure>
    </div>
  </main>
</template>
