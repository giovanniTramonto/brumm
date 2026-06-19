<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'SUPERUSER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref<string | null>(null)

async function onDelete() {
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/settings/delete`, { method: 'POST' })
    authStore.clearAuth()
    await navigateTo('/register')
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Löschen'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-lg">
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/settings`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
    </div>

    <div class="card space-y-6">
      <div>
        <h1 class="text-xl font-bold text-red-700">Verein löschen</h1>
        <p class="mt-2 text-sm text-gray-600">
          Diese Aktion löscht den Verein und alle zugehörigen Daten (Kinder, Gruppen,
          Sitzungen) unwiderruflich. Dateien im S3-Speicher bleiben erhalten.
        </p>
      </div>

      <div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
        <strong>Achtung:</strong> Diese Aktion kann nicht rückgängig gemacht werden.
      </div>

      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

      <button class="btn-danger w-full" :disabled="isLoading" @click="onDelete">
        {{ isLoading ? "Wird gelöscht…" : "Verein endgültig löschen" }}
      </button>
    </div>
  </div>
</template>
