<script setup lang="ts">
definePageMeta({ layout: 'public' })

function onRetry() {
  location.reload()
}
</script>

<template>
  <main id="main-content" class="flex flex-grow flex-col items-center justify-center bg-gray-50 px-4 py-16">
    <div class="w-full max-w-sm text-center space-y-4">
      <p class="text-4xl" aria-hidden="true">📶</p>
      <h1 class="text-xl font-semibold text-gray-900">Du bist offline</h1>
      <p class="text-sm text-gray-600">
        Brumm benötigt eine Internetverbindung. Bitte überprüfe dein WLAN oder mobile Daten und versuche es erneut.
      </p>
      <button class="btn-primary" @click="onRetry">
        Erneut versuchen
      </button>
    </div>
  </main>
</template>
