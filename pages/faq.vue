<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'FAQ – Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-24">
    <h1 class="text-3xl font-bold text-gray-900">FAQ</h1>

    <section class="mt-12" aria-labelledby="google-workspace">
      <h2 id="google-workspace" class="text-xl font-semibold text-gray-900">Google Workspace einrichten</h2>
      <p class="mt-2 text-sm text-gray-500">
        Brumm speichert alle Mitgliederdaten ausschließlich in eurer eigenen Geteilten Ablage (Google Drive) – nicht auf Brumm-Servern. Dafür braucht ihr vor der Einrichtung:
      </p>
      <p class="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Aktuell wird ausschließlich Google Workspace als Datenspeicher unterstützt.
      </p>
      <p class="mt-3 text-sm text-gray-500">
        <strong class="text-gray-700">Google Workspace ist für gemeinnützige Vereine kostenlos</strong> – über das Programm
        <a href="https://www.google.com/nonprofits/" target="_blank" rel="noopener" class="text-primary-600 hover:underline">Google for Nonprofits</a>.
        Nach der Registrierung erhaltet ihr u.a. Google Workspace for Nonprofits ohne Kosten.
      </p>
      <ol class="mt-4 space-y-3 text-gray-500 list-decimal pl-5">
        <li>
          Einen <strong class="text-gray-700">Google Workspace Account</strong> für den Admin – ein normaler Gmail-Account reicht nicht, da Geteilte Ablagen (Shared Drives) nur in Workspace verfügbar sind.
        </li>
        <li>
          Eine <strong class="text-gray-700">Geteilte Ablage</strong> in Google Drive, auf die der Admin-Account Zugriff hat. Anlegen: Google Drive → „Geteilte Ablagen" → „Neu".
        </li>
        <li>
          Die <strong class="text-gray-700">ID der Geteilten Ablage</strong> – sie steht in der URL wenn die Ablage geöffnet ist:
          <code class="mt-1 block rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">drive.google.com/drive/folders/<strong>DIESE-ID-HIER</strong></code>
        </li>
      </ol>
    </section>
  </main>
</template>
