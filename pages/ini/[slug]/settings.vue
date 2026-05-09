<script setup lang="ts">
import { useAuthStore } from "~/stores/auth"

definePageMeta({ middleware: ["auth", "role"], requiredRole: "SUPERUSER" })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const serviceAccountEmail = ref("")
const serviceAccountKey = ref("")
const isSetupLoading = ref(false)
const setupError = ref<string | null>(null)
const setupSuccess = ref(false)

async function onSetupStorage() {
  if (!serviceAccountEmail.value || !serviceAccountKey.value) return
  isSetupLoading.value = true
  setupError.value = null
  setupSuccess.value = false
  try {
    await $fetch(`/api/ini/${slug}/setup/storage`, {
      method: "POST",
      body: {
        serviceAccountEmail: serviceAccountEmail.value,
        serviceAccountKey: serviceAccountKey.value,
      },
    })
    setupSuccess.value = true
  } catch (err: unknown) {
    setupError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "Fehler"
  } finally {
    isSetupLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Einstellungen</h1>

    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Verein</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Name</dt>
          <dd class="text-gray-900">{{ authStore.currentClub?.name }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Slug</dt>
          <dd class="font-mono text-gray-900">{{ authStore.currentClub?.slug }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Storage</dt>
          <dd class="text-gray-900">
            {{ authStore.currentClub?.storageType ?? "Nicht konfiguriert" }}
          </dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Setup</dt>
          <dd :class="authStore.currentClub?.isSetupDone ? 'text-green-700' : 'text-amber-600'">
            {{ authStore.currentClub?.isSetupDone ? "Abgeschlossen" : "Ausstehend" }}
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="!authStore.currentClub?.isSetupDone" class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Google Drive einrichten</h2>
      <p class="text-sm text-gray-600">
        Gib die Zugangsdaten des Service Accounts ein. Diese werden verschlüsselt gespeichert
        und nur für Lese-/Schreibzugriffe auf Google Drive verwendet.
      </p>
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
      <div v-if="setupError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {{ setupError }}
      </div>
      <div v-if="setupSuccess" class="rounded-md bg-green-50 p-3 text-sm text-green-700">
        Google Drive wurde erfolgreich eingerichtet.
      </div>
      <button
        class="btn-primary"
        :disabled="isSetupLoading || !serviceAccountEmail || !serviceAccountKey"
        @click="onSetupStorage"
      >
        {{ isSetupLoading ? "Wird eingerichtet…" : "Google Drive einrichten" }}
      </button>
    </div>
  </div>
</template>
