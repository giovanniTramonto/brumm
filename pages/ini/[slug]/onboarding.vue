<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false, middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref<string | null>(null)
const isStorageSetupDone = ref(false)
const isSetupRequested = ref(authStore.currentClub?.isSetupRequested ?? false)
const requestSentNow = ref(false)

const selectedHost = ref<'google_drive' | null>(null)
const serviceAccountEmail = ref('')
const serviceAccountKey = ref('')

async function onSetupStorage() {
  if (!serviceAccountEmail.value || !serviceAccountKey.value) return
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/setup/storage`, {
      method: 'POST',
      body: {
        serviceAccountEmail: serviceAccountEmail.value,
        serviceAccountKey: serviceAccountKey.value,
      },
    })
    isStorageSetupDone.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Storage-Setup fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}

async function onRequestManagedSetup() {
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/setup/storage`, {
      method: 'POST',
      body: { managed: true },
    })
  } catch {
    // server marks the request regardless
  } finally {
    isSetupRequested.value = true
    requestSentNow.value = true
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Einrichtung</h1>
        <p class="mt-1 text-gray-600">Datenspeicher konfigurieren</p>
      </div>

      <div class="card">
        <template v-if="!isStorageSetupDone">
          <h2 class="mb-2 text-lg font-semibold text-gray-900">Datenspeicher einrichten</h2>
          <p class="mb-6 text-sm text-gray-600">
            Wähle, wie Dateien und Mitgliederdaten gespeichert werden sollen.
          </p>

          <!-- Option A: self-managed -->
          <div class="mb-6">
            <h3 class="mb-3 font-medium text-gray-900">Anbieter wählen</h3>
            <div class="grid grid-cols-3 gap-3">
              <button
                class="flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors"
                :class="selectedHost === 'google_drive'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'"
                @click="selectedHost = 'google_drive'"
              >
                <span class="text-2xl">📁</span>
                Google Drive
              </button>
              <button
                disabled
                class="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-100 p-4 text-sm font-medium text-gray-300 cursor-not-allowed"
              >
                <span class="text-2xl">🪣</span>
                S3
                <span class="text-xs font-normal">Demnächst</span>
              </button>
              <button
                disabled
                class="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-100 p-4 text-sm font-medium text-gray-300 cursor-not-allowed"
              >
                <span class="text-2xl">☁️</span>
                R2
                <span class="text-xs font-normal">Demnächst</span>
              </button>
            </div>
          </div>

          <div v-if="selectedHost === 'google_drive'" class="mb-6 rounded-lg border border-gray-200 p-4">
            <div class="space-y-3">
              <div>
                <label class="label">Service Account E-Mail</label>
                <input
                  v-model="serviceAccountEmail"
                  type="email"
                  class="input mt-1"
                  placeholder="jita-storage@projekt.iam.gserviceaccount.com"
                />
              </div>
              <div>
                <label class="label">Private Key (JSON-Inhalt)</label>
                <textarea
                  v-model="serviceAccountKey"
                  class="input mt-1 font-mono text-xs"
                  rows="4"
                  placeholder='{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY-----\n..."}'
                />
                <p class="mt-1 text-xs text-gray-500">
                  Den kompletten Inhalt der heruntergeladenen JSON-Key-Datei einfügen.
                </p>
              </div>
              <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {{ error }}
              </div>
              <button
                class="btn-primary w-full"
                :disabled="isLoading || !serviceAccountEmail || !serviceAccountKey"
                @click="onSetupStorage"
              >
                {{ isLoading ? "Wird eingerichtet…" : "Google Drive einrichten" }}
              </button>
            </div>
          </div>

          <!-- Option B: managed by Jita -->
          <div class="rounded-lg border border-gray-200 p-4">
            <h3 class="mb-1 font-medium text-gray-900">Einrichten lassen</h3>
            <p class="mb-3 text-sm text-gray-600">
              Unser Team richtet den Speicher für euch ein.
            </p>
            <div v-if="requestSentNow" class="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
              Anfrage gesendet. Wir melden uns bei euch.
            </div>
            <p v-else-if="isSetupRequested" class="mb-3 text-sm text-amber-700">
              Anfrage bereits gesendet.
            </p>
            <button class="btn-secondary w-full" :disabled="isLoading" @click="onRequestManagedSetup">
              {{ isLoading ? "Wird gesendet…" : isSetupRequested ? "Erneut senden" : "Anfrage senden" }}
            </button>
          </div>
        </template>

        <template v-else-if="isStorageSetupDone">
          <div class="space-y-4">
            <p class="text-sm text-green-700">Google Drive wurde erfolgreich eingerichtet.</p>
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="btn-primary block text-center">
              Zum Dashboard
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
