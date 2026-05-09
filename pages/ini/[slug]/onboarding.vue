<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string

const step = ref(1)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Schritt 1: SUPERUSER anlegen
const firstName = ref("")
const lastName = ref("")
const birthDate = ref("")
const guardian1Name = ref("")
const email1 = ref("")
const email2 = ref("")

// Schritt 2: Storage
const serviceAccountEmail = ref("")
const serviceAccountKey = ref("")
const isStorageSetupDone = ref(false)
const isSetupRequested = ref(false)

async function onCreateSuperUser() {
  if (!firstName.value || !lastName.value || !birthDate.value || !email1.value) return
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/members/create`, {
      method: "POST",
      body: {
        firstName: firstName.value,
        lastName: lastName.value,
        birthDate: birthDate.value,
        guardian1Name: guardian1Name.value || undefined,
        email1: email1.value,
        email2: email2.value || undefined,
      },
    })
    step.value = 2
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Fehler beim Anlegen"
  } finally {
    isLoading.value = false
  }
}

async function onSetupStorage() {
  if (!serviceAccountEmail.value || !serviceAccountKey.value) return
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/setup/storage`, {
      method: "POST",
      body: {
        serviceAccountEmail: serviceAccountEmail.value,
        serviceAccountKey: serviceAccountKey.value,
      },
    })
    isStorageSetupDone.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      "Storage-Setup fehlgeschlagen"
  } finally {
    isLoading.value = false
  }
}

async function onRequestManagedSetup() {
  isLoading.value = true
  error.value = null
  try {
    await $fetch(`/api/ini/${slug}/setup/storage`, {
      method: "POST",
      body: { managed: true },
    })
  } catch {
    // managed-Anfrage wird serverseitig markiert
  } finally {
    isSetupRequested.value = true
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p class="mt-1 text-gray-600">Schritt {{ step }} von 2</p>
      </div>

      <div class="card">
        <!-- Schritt 1: SUPERUSER Account -->
        <template v-if="step === 1">
          <h2 class="mb-6 text-lg font-semibold text-gray-900">Verwaltungs-Account anlegen</h2>
          <form class="space-y-4" @submit.prevent="onCreateSuperUser">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Vorname</label>
                <input v-model="firstName" type="text" class="input mt-1" required />
              </div>
              <div>
                <label class="label">Nachname</label>
                <input v-model="lastName" type="text" class="input mt-1" required />
              </div>
            </div>
            <div>
              <label class="label">Geburtsdatum</label>
              <input v-model="birthDate" type="date" class="input mt-1" required />
            </div>
            <div>
              <label class="label">Name (Erziehungsberechtigte/r)</label>
              <input v-model="guardian1Name" type="text" class="input mt-1" />
            </div>
            <div>
              <label class="label">E-Mail (primär)</label>
              <input v-model="email1" type="email" class="input mt-1" required />
            </div>
            <div>
              <label class="label">E-Mail (optional)</label>
              <input v-model="email2" type="email" class="input mt-1" />
            </div>
            <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {{ error }}
            </div>
            <button type="submit" class="btn-primary w-full" :disabled="isLoading">
              {{ isLoading ? "Wird angelegt…" : "Weiter" }}
            </button>
          </form>
        </template>

        <!-- Schritt 2: Storage -->
        <template v-if="step === 2">
          <h2 class="mb-2 text-lg font-semibold text-gray-900">Datenspeicher einrichten</h2>

          <template v-if="!isStorageSetupDone && !isSetupRequested">
            <p class="mb-6 text-sm text-gray-600">
              Wähle, wie Dateien und Mitgliederdaten gespeichert werden sollen.
            </p>

            <!-- Option A: Selbst einrichten -->
            <div class="mb-6 rounded-lg border border-gray-200 p-4">
              <h3 class="mb-3 font-medium text-gray-900">Google Drive (selbst einrichten)</h3>
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

            <!-- Option B: Einrichten lassen -->
            <div class="rounded-lg border border-gray-200 p-4">
              <h3 class="mb-1 font-medium text-gray-900">Einrichten lassen</h3>
              <p class="mb-3 text-sm text-gray-600">
                Unser Team richtet den Speicher für euch ein.
              </p>
              <button
                class="btn-secondary w-full"
                :disabled="isLoading"
                @click="onRequestManagedSetup"
              >
                Support-Anfrage senden
              </button>
            </div>
          </template>

          <!-- Erfolgreich -->
          <template v-else>
            <div class="space-y-4">
              <p class="text-sm text-green-700">
                {{
                  isSetupRequested
                    ? "Anfrage gesendet. Das Team richtet den Speicher ein."
                    : "Google Drive wurde erfolgreich eingerichtet."
                }}
              </p>
              <NuxtLink :to="`/ini/${slug}/dashboard`" class="btn-primary block text-center">
                Zum Dashboard
              </NuxtLink>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
