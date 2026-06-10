<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error.status === 404)

useHead({ title: is404.value ? 'Seite nicht gefunden – Brumm' : 'Fehler – Brumm' })

function onBack() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <NuxtLayout name="public">
    <main id="main-content" class="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
      <p class="text-5xl font-bold text-gray-200">{{ error.status }}</p>
      <h1 class="mt-4 text-2xl font-semibold text-gray-900">
        {{ is404 ? 'Seite nicht gefunden' : 'Ein Fehler ist aufgetreten' }}
      </h1>
      <p class="mt-4 text-gray-500">
        {{ is404 ? 'Die gesuchte Seite existiert nicht oder wurde verschoben.' : 'Bitte versuche es später noch einmal.' }}
      </p>
      <button class="btn-primary mt-8" @click="onBack">Zur Startseite</button>
    </main>
  </NuxtLayout>
</template>
