<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false, middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const successParam = route.query.success === '1'
const errorParam = route.query.error as string | undefined
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Einrichtung</h1>
        <p class="mt-1 text-gray-600">Datenspeicher konfigurieren</p>
      </div>

      <div class="card">
        <template v-if="successParam">
          <div class="space-y-4">
            <p class="text-sm text-green-700">Google Drive wurde erfolgreich verbunden.</p>
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="btn-primary block text-center">
              Zum Dashboard
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">Datenspeicher einrichten</h2>
          <p class="mb-4 text-sm text-gray-600">
            Wähle, wie Dateien und Kinderdaten gespeichert werden sollen.
          </p>
          <div v-if="authStore.currentClub?.isSetupDone" class="mb-4 space-y-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
            <p>Du hast bereits einen Datenspeicher verbunden. Beim Wechsel werden die vorhandenen Daten <strong>nicht automatisch migriert</strong> — sie bleiben im bisherigen Speicher erhalten und müssen manuell übertragen werden.</p>
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="btn-secondary inline-block text-sm">
              Zurück zum Dashboard
            </NuxtLink>
          </div>

          <div v-if="errorParam" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {{ errorParam }}
          </div>

          <div class="mb-4 rounded-lg border border-gray-200 p-4">
            <div class="mb-3 flex items-center gap-3">
              <span class="text-2xl">📁</span>
              <div>
                <h3 class="font-medium text-gray-900">Google Drive</h3>
                <p class="text-sm text-gray-500">Daten in deinem Google Drive speichern</p>
              </div>
            </div>
            <a :href="`/api/ini/${slug}/auth/google`" class="btn-primary block text-center">
              Mit Google verbinden
            </a>
          </div>

          <div class="mb-4 rounded-lg border border-gray-100 p-4 opacity-50">
            <div class="flex items-center gap-3">
              <span class="text-2xl">🪣</span>
              <div>
                <h3 class="font-medium text-gray-900">S3</h3>
                <p class="text-sm text-gray-500">Demnächst verfügbar</p>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-100 p-4 opacity-50">
            <div class="flex items-center gap-3">
              <span class="text-2xl">☁️</span>
              <div>
                <h3 class="font-medium text-gray-900">R2</h3>
                <p class="text-sm text-gray-500">Demnächst verfügbar</p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
