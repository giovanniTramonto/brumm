<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'FAQ – Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24">
    <h1 class="text-3xl font-bold text-gray-900">FAQ</h1>

    <section class="mt-12" aria-labelledby="datenspeicher">
      <h2 id="datenspeicher" class="text-xl font-semibold text-gray-900">Datenspeicher einrichten</h2>
      <p class="mt-3 text-sm text-gray-500">
        Brumm speichert alle Mitgliederdaten ausschließlich in der eigenen Datenbank und im eigenen Datei-Speicher des Vereins. Für die Einrichtung benötigt ihr:
      </p>
      <ol class="mt-4 space-y-3 text-gray-500 list-decimal pl-5">
        <li>
          Eine <strong class="text-gray-700">PostgreSQL-Datenbank</strong> für Mitgliederdaten. Den Connection String unter <strong class="text-gray-700">Einstellungen → Datenbank</strong> eintragen.
        </li>
        <li>
          Einen <strong class="text-gray-700">S3-kompatiblen Speicher</strong> für Dateien (Vertragsvorlagen, Vertragsunterlagen, Infos-Dokumente) – z.&nbsp;B. AWS S3, Cloudflare R2 oder Hetzner Object Storage. Bucket, Region und Zugangsdaten unter <strong class="text-gray-700">Einstellungen → Datenspeicher</strong> eintragen.
        </li>
      </ol>
    </section>
  </main>
</template>
