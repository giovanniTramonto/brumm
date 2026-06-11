<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Einblicke – Brumm' })

const screens = [
  {
    src: '/screens/dashboard.png',
    label: 'Dashboard',
    description: 'Überblick über aktive Kinder, Gruppen und aktuelle Mitteilungen.',
  },
  {
    src: '/screens/members.png',
    label: 'Kinderliste',
    description: 'Alle Kinder auf einen Blick – mit Status, Gruppe und Vertragsende.',
  },
  {
    src: '/screens/member-detail.png',
    label: 'Kind-Details',
    description: 'Stammdaten, Vertragsunterlagen und Kontaktdaten des Erziehungsberechtigten.',
  },
  {
    src: '/screens/calculations.png',
    label: 'Berechnung',
    description: 'Kostenerstattung nach KitaFöG und Personalschlüssel – monatsgenau.',
  },
  {
    src: '/screens/wall.png',
    label: 'Aktuell',
    description: 'Dokumente und Links für alle Mitglieder an einem Ort.',
  },
  {
    src: '/screens/login.png',
    label: 'Anmeldung',
    description: 'Magic-Link-Login oder PIN – auch als installierte App auf dem Handy.',
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
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
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
