<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Über Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-24">
    <section aria-labelledby="was-ist-brumm">
      <h1 id="was-ist-brumm" class="text-3xl font-bold text-gray-900">Was ist Brumm?</h1>
      <p class="mt-6 text-gray-600 leading-relaxed">
        Berliner Kita-Abläufe automatisieren – kindgerecht ausgedrückt: Bär?, Auto? – <span class="font-semibold text-gray-900">Brumm, brumm …</span>
      </p>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Brumm ist eine Verwaltungssoftware speziell für Elterninitiativ-Kindertagesstätten. Mitglieder verwalten, Vertragsunterlagen einreichen, Kostenerstattungen berechnen – alles an einem Ort, ohne Papierkram.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="fuer-wen">
      <h2 id="fuer-wen" class="text-xl font-semibold text-gray-900">Für wen ist Brumm?</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Brumm ist gemacht für Elterninitiativ-Kindertagesstätten in Berlin. Die Software kennt die Berliner Besonderheiten: KitaFöG-Kostensätze, ndH-Zuschläge, Personalschlüsselberechnung nach Senatsvorgaben – alles ist bereits eingebaut.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="was-kann-brumm">
      <h2 id="was-kann-brumm" class="text-xl font-semibold text-gray-900">Was kann Brumm?</h2>
      <ul class="mt-4 space-y-2 text-gray-500 list-disc pl-5">
        <li>Mitgliederverwaltung mit Statusverfolgung (Einladung, Bestätigung, Freischaltung)</li>
        <li>Vertragsunterlagen einreichen und verwalten</li>
        <li>Kostenerstattungsberechnung nach KitaFöG-Sätzen</li>
        <li>Personalschlüsselberechnung (Betreuungs- und Vorstandsstunden)</li>
        <li>Gruppenverwaltung und Vorstandsverwaltung</li>
        <li>Rollenbasierter Zugang für Eltern, Team und Vorstand</li>
      </ul>
    </section>

    <section class="mt-8" aria-labelledby="daten">
      <h2 id="daten" class="text-xl font-semibold text-gray-900">Eure Daten bleiben in eurer Hand</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Alle persönlichen Daten – Mitgliederinformationen, Vertragsunterlagen, Dokumente – werden ausschließlich in einem Cloud-Ordner gespeichert, der dem Verein gehört. Brumm hat keinen eigenen zentralen Datenspeicher für Mitgliederdaten. Ihr legt selbst fest, wo eure Daten abgelegt werden – ihr behaltet jederzeit die volle Kontrolle. Aktuell wird Google Drive unterstützt; europäische Alternativen wie Nextcloud folgen demnächst.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="privacy">
      <h2 id="privacy" class="text-xl font-semibold text-gray-900">Datenschutz &amp; DSGVO</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Brumm speichert keine personenbezogenen Mitgliederdaten auf eigenen Servern. Es gibt kein Tracking, keine Analytics, keine Weitergabe an Dritte. Technische Daten (Login-Sessions, Vereinskonfiguration) liegen verschlüsselt in einer europäischen Datenbank. Der Quellcode ist öffentlich einsehbar (Source Available) —
        <a
          href="https://github.com/giovanniTramonto/brumm"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 border-b border-gray-400 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded whitespace-nowrap"
        >Code auf GitHub ansehen <span aria-hidden="true">↗</span><span class="sr-only">(öffnet in neuem Tab)</span></a>, lizenziert unter der
        <a
          href="https://github.com/giovanniTramonto/brumm/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 border-b border-gray-400 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded whitespace-nowrap"
        >Business Source License 1.1 <span aria-hidden="true">↗</span><span class="sr-only">(öffnet in neuem Tab)</span></a>.
      </p>
    </section>
  </main>
</template>
