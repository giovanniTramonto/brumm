<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Anleitung – Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24">
    <h1 class="text-3xl font-bold text-gray-900">Anleitung</h1>
    <p class="mt-4 text-gray-500 leading-relaxed">
      Brumm hat vier Rollen – Admin, Vorstand, Team und Eltern. Je nach Rolle sieht die App anders aus und erlaubt unterschiedliche Aktionen.
    </p>

    <section class="mt-12" aria-labelledby="role-superuser">
      <h2 id="role-superuser" class="text-xl font-semibold text-gray-900">Admin</h2>
      <p class="mt-2 text-sm text-gray-500">Hat vollen Zugriff auf alle Bereiche.</p>
      <p class="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Einmalige Einrichtung</p>
      <ol class="mt-2 space-y-3 text-gray-500 list-decimal pl-5">
        <li>Kita unter <NuxtLink to="/register" class="text-primary-600 hover:underline font-medium">/register</NuxtLink> registrieren – du erhältst einen Einrichtungs-Link per E-Mail.</li>
        <li>
          Im Onboarding Datenspeicher verbinden (aktuell wird ausschließlich Google Workspace unterstützt) und die ID der Geteilten Ablage (Shared Drive) eingeben.
          <NuxtLink to="/faq#google-workspace" class="text-primary-600 hover:underline">→ Google Workspace einrichten</NuxtLink>
        </li>
        <li>Unter <strong class="text-gray-700">Vorstand</strong> Vorstandsmitglieder, unter <strong class="text-gray-700">Team</strong> pädagogische Fachkräfte und unter <strong class="text-gray-700">Gruppen</strong> Betreuungsgruppen anlegen.</li>
      </ol>
    </section>

    <section class="mt-12" aria-labelledby="role-manager">
      <h2 id="role-manager" class="text-xl font-semibold text-gray-900">Vorstand</h2>
      <p class="mt-2 text-sm text-gray-500">Wird vom Admin eingerichtet. Je nach Berechtigung gibt es zwei Ausprägungen.</p>
      <p class="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Alle Vorstandsmitglieder</p>
      <ol class="mt-2 space-y-3 text-gray-500 list-decimal pl-5">
        <li>Du erhältst einen Anmelde-Link per E-Mail – kein Passwort nötig.</li>
        <li>Unter <strong class="text-gray-700">Berechnung</strong> siehst du Kostenerstattungen und den Personalschlüssel – monatsgenau oder als Jahresübersicht.</li>
        <li>Unter <strong class="text-gray-700">Aktuell</strong> Dokumente und Links für alle Mitglieder bereitstellen.</li>
      </ol>
      <p class="mt-6 text-xs font-medium uppercase tracking-wide text-gray-500">Mit Mitgliederverwaltung</p>
      <p class="mt-1 text-sm text-gray-500">Nur wenn der Admin diese Berechtigung aktiviert hat.</p>
      <ol class="mt-2 space-y-3 text-gray-500 list-decimal pl-5">
        <li>Unter <strong class="text-gray-700">Kinder</strong> Kinder anlegen, bearbeiten und aktivieren.</li>
        <li>Einladungslinks verwalten und Vertragsvorlagen pflegen.</li>
      </ol>
    </section>

    <section class="mt-12" aria-labelledby="role-member">
      <h2 id="role-member" class="text-xl font-semibold text-gray-900">Eltern</h2>
      <p class="mt-2 text-sm text-gray-500">Sehen ausschließlich ihre eigenen Kinder.</p>
      <ol class="mt-4 space-y-3 text-gray-500 list-decimal pl-5">
        <li>Ihr erhaltet einen Einladungslink per E-Mail, sobald euer Kind in Brumm angelegt wurde.</li>
        <li>Nach dem Klick auf den Link seid ihr eingeloggt und seht das Dashboard mit euren Kindern.</li>
        <li>Unter <strong class="text-gray-700">Kinder</strong> ladet ihr die geforderten Vertragsunterlagen hoch bzw. bestätigt sie als gelesen.</li>
        <li>Sobald alle Unterlagen vollständig sind, klickt ihr auf <strong class="text-gray-700">Einreichen</strong> – der Vorstand wird benachrichtigt und aktiviert euer Kind.</li>
        <li>Nach der Aktivierung sind die Kind-Daten schreibgeschützt. Kontaktangaben wie E-Mail-Adresse, Telefon und Adresse könnt ihr jederzeit selbst aktualisieren.</li>
      </ol>
    </section>

    <section class="mt-12" aria-labelledby="role-team">
      <h2 id="role-team" class="text-xl font-semibold text-gray-900">Team</h2>
      <p class="mt-2 text-sm text-gray-500">Gruppenübersicht, Geburtstage und Kita-Aktuelles auf einen Blick.</p>
      <ol class="mt-4 space-y-3 text-gray-500 list-decimal pl-5">
        <li>Du erhältst einen Anmelde-Link per E-Mail – kein Passwort nötig.</li>
        <li>Das Dashboard zeigt eine Gruppenübersicht mit allen aktiven Kindern sowie die nächsten Geburtstage.</li>
        <li>Kinderdaten können eingesehen, aber nicht bearbeitet werden.</li>
        <li>Aktuelle Mitteilungen und Kontaktdaten des Vorstands sind ebenfalls sichtbar.</li>
      </ol>
    </section>
  </main>
</template>
