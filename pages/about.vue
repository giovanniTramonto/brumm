<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Über Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24">
    <section aria-labelledby="what-is-brumm">
      <h1 id="what-is-brumm" class="text-3xl font-bold text-gray-900">Was ist Brumm?</h1>
      <p class="mt-6 text-gray-500 leading-relaxed">
        Brumm ist eine Verwaltungssoftware speziell für Berliner Elterninitiativ-Kindertagesstätten.<br>Berliner Kita-Abläufe automatisieren – Bär? Auto? Brumm, brumm.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="manage-on-the-side">
      <h2 id="manage-on-the-side" class="text-xl font-semibold text-gray-900">Kita verwalten, nebenbei</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Elterninitiativ-Kitas stemmen viel Verwaltung mit wenig Zeit. Brumm nimmt einen Großteil davon ab: Mitglieder verwalten, Vertragsunterlagen einreichen, Kostenerstattungen berechnen – alles an einem Ort, ohne Papierkram. Berliner Besonderheiten wie KitaFöG-Kostensätze, ndH-Zuschläge und die Personalschlüsselberechnung nach Senatsvorgaben sind bereits eingebaut.
      </p>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Aktuell ist Brumm auf Elterninitiativ-Kindertageseinrichtungen (EKT) ausgerichtet. Eine Erweiterung für andere Trägerschaften ist in Planung. Brumm funktioniert auch als installierte App auf dem Handy (PWA) – ohne App Store.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="data-ownership">
      <h2 id="data-ownership" class="text-xl font-semibold text-gray-900">Daten bleiben beim Verein</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Alle persönlichen Daten – Mitgliederinformationen, Vertragsunterlagen, Dokumente – werden ausschließlich in einem Cloud-Ordner des Vereins gespeichert, nicht auf Brumm-Servern. Der Verein behält jederzeit die volle Kontrolle. Aktuell wird Google Workspace unterstützt; weitere Anbieter sollen demnächst folgen.
      </p>
    </section>

    <section class="mt-8" aria-labelledby="privacy">
      <h2 id="privacy" class="text-xl font-semibold text-gray-900">Datenschutz &amp; DSGVO</h2>
      <p class="mt-4 text-gray-500 leading-relaxed">
        Kein Tracking, keine Analytics, keine Weitergabe an Dritte. Technische Daten (Login-Sessions, Vereinskonfiguration) werden verschlüsselt gespeichert. Der Quellcode ist öffentlich einsehbar (Source Available) —
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
