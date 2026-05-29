<script setup lang="ts">
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const successParam = route.query.success === '1'
const errorParam = route.query.error as string | undefined

const sharedDriveId = ref('')
const isDev = import.meta.dev
const isChanging = ref(false)

const googleAuthUrl = computed(() => {
  const base = `/api/ini/${slug}/auth/google`
  const id = sharedDriveId.value.trim()
  return id ? `${base}?parentId=${encodeURIComponent(id)}` : base
})
</script>

<template>
  <div class="max-w-lg space-y-6">
    <NuxtLink :to="`/ini/${slug}/settings`" class="text-sm text-gray-500 hover:text-gray-900">
      ← Zurück
    </NuxtLink>

    <div class="card">
        <template v-if="successParam">
          <div class="space-y-4">
            <p class="text-sm text-green-700">
              Google Drive wurde erfolgreich verbunden.
            </p>
            <NuxtLink
              :to="`/ini/${slug}/dashboard`"
              class="btn-primary block text-center"
            >
              Zum Dashboard
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">
            {{ authStore.currentClub?.isSetupDone ? 'Datenspeicher ändern' : 'Datenspeicher einrichten' }}
          </h2>
          <p class="mb-4 text-sm text-gray-600">
            Wähle, wie Dateien und Kinderdaten gespeichert werden sollen.
          </p>
          <div
            v-if="errorParam"
            class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            {{ errorParam }}
          </div>

          <div
            v-if="authStore.currentClub?.isSetupDone"
            class="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700"
          >
            <strong>Achtung:</strong> Ein Wechsel des Datenspeichers ist ein manueller Eingriff und sollte im Normalfall nicht durchgeführt werden. Alle bestehenden Mitgliederdaten, Dokumente und Ordner im bisherigen Drive bleiben dort — sie werden <strong>nicht automatisch übertragen</strong> und sind danach über Brumm nicht mehr erreichbar. Nur fortfahren, wenn du weißt was du tust.
          </div>

          <template v-if="authStore.currentClub?.isSetupDone && !isChanging">
            <div class="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div class="flex items-center gap-3">
                <span class="text-2xl">📁</span>
                <div>
                  <h3 class="font-medium text-gray-900">Google Workspace</h3>
                  <p class="text-sm text-gray-500">Aktuell verbunden</p>
                </div>
              </div>
              <button class="btn-secondary text-sm" @click="isChanging = true">Ändern</button>
            </div>
          </template>

          <template v-else>
            <div class="mb-4 flex justify-end">
              <button
                v-if="authStore.currentClub?.isSetupDone"
                class="btn-secondary text-sm"
                @click="isChanging = false"
              >
                Abbrechen
              </button>
            </div>

            <div class="rounded-lg border border-gray-200 p-4">
              <div class="mb-3 flex items-center gap-3">
                <span class="text-2xl">📁</span>
                <div>
                  <h3 class="font-medium text-gray-900">Google Workspace</h3>
                  <p class="text-sm text-gray-500">Daten in einem Shared Drive speichern</p>
                </div>
              </div>
              <div class="mb-3">
                <div class="flex items-center gap-1">
                  <label for="sharedDriveId" class="label">Shared Drive ID</label>
                  <PopoverRoot>
                    <PopoverTrigger class="text-gray-400 hover:text-gray-600 focus:outline-none">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </PopoverTrigger>
                    <PopoverPortal>
                      <PopoverContent
                        class="z-50 max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
                        :side-offset="6"
                      >
                        Erfordert einen <strong>Google Workspace</strong> Account (kein persönliches Gmail).<br>
                        Shared Drive anlegen: Google Drive → „Shared drives" (linke Sidebar) → „+ Neu"
                        <PopoverArrow class="fill-gray-900" />
                      </PopoverContent>
                    </PopoverPortal>
                  </PopoverRoot>
                </div>
                <input
                  id="sharedDriveId"
                  v-model="sharedDriveId"
                  type="text"
                  class="input mt-1"
                  :placeholder="isDev ? 'z.B. 0ABCxyz123... (leer = persönlicher Drive)' : 'z.B. 0ABCxyz123...'"
                  :required="!isDev"
                />
                <p class="mt-1 text-xs text-gray-400">
                  Die ID steht in der URL des Shared Drive: <code>drive.google.com/drive/folders/<strong>ID</strong></code>
                </p>
              </div>
              <a
                :href="googleAuthUrl"
                :class="['btn-primary block text-center', !isDev && !sharedDriveId.trim() && 'pointer-events-none opacity-50']"
                :aria-disabled="!isDev && !sharedDriveId.trim()"
              >
                Mit Google verbinden
              </a>
            </div>

          </template>

        </template>
    </div>
  </div>
</template>
