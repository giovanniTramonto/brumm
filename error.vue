<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error.statusCode === 404)

useHead({ title: is404.value ? 'Seite nicht gefunden – Brumm' : 'Fehler – Brumm' })

function onBack() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <header class="border-b border-gray-100">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="text-lg font-semibold text-primary-700" aria-label="Brumm – zur Startseite">Brumm</NuxtLink>
          <span class="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">Beta-Version</span>
        </div>
      </div>
    </header>

    <main class="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
      <p class="text-5xl font-bold text-gray-200">{{ error.statusCode }}</p>
      <h1 class="mt-4 text-2xl font-semibold text-gray-900">
        {{ is404 ? 'Seite nicht gefunden' : 'Ein Fehler ist aufgetreten' }}
      </h1>
      <p class="mt-4 text-gray-500">
        {{ is404 ? 'Die gesuchte Seite existiert nicht oder wurde verschoben.' : 'Bitte versuche es später noch einmal.' }}
      </p>
      <button class="btn-primary mt-8" @click="onBack">Zur Startseite</button>
    </main>
  </div>
</template>
