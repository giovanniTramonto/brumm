<script setup lang="ts">
definePageMeta({ layout: false })

interface ClubWithCount {
  id: string
  slug: string
  name: string
  storageType: string | null
  isSetupDone: boolean
  isSetupRequested: boolean
  createdAt: string
  _count: { users: number }
}

const adminSecret = ref("")
const isAuthenticated = ref(false)
const isLoading = ref(false)
const clubs = ref<ClubWithCount[]>([])
const error = ref<string | null>(null)

const setupClubId = ref<string | null>(null)
const setupEmail = ref("")
const setupKey = ref("")
const isSetupLoading = ref(false)
const setupError = ref<string | null>(null)
const setupSuccess = ref<string | null>(null)

async function onLogin() {
  isLoading.value = true
  error.value = null
  try {
    const data = await $fetch<{ clubs: ClubWithCount[] }>("/api/admin/clubs", {
      headers: { "x-admin-secret": adminSecret.value },
    })
    clubs.value = data.clubs
    isAuthenticated.value = true
  } catch {
    error.value = "Falsches Passwort"
  } finally {
    isLoading.value = false
  }
}

async function onSetupStorage(clubId: string) {
  if (!setupEmail.value || !setupKey.value) return
  isSetupLoading.value = true
  setupError.value = null
  setupSuccess.value = null
  try {
    await $fetch(`/api/admin/clubs/${clubId}/storage`, {
      method: "PATCH",
      headers: { "x-admin-secret": adminSecret.value },
      body: { serviceAccountEmail: setupEmail.value, serviceAccountKey: setupKey.value },
    })
    setupSuccess.value = clubId
    setupClubId.value = null
    setupEmail.value = ""
    setupKey.value = ""
    const data = await $fetch<{ clubs: ClubWithCount[] }>("/api/admin/clubs", {
      headers: { "x-admin-secret": adminSecret.value },
    })
    clubs.value = data.clubs
  } catch (err: unknown) {
    setupError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "Fehler"
  } finally {
    isSetupLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-12">
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-8 text-2xl font-bold text-gray-900">Jita Admin</h1>

      <!-- Login -->
      <div v-if="!isAuthenticated" class="card max-w-sm">
        <h2 class="mb-4 font-semibold text-gray-900">Anmelden</h2>
        <form class="space-y-4" @submit.prevent="onLogin">
          <input type="text" name="username" autocomplete="username" value="admin" class="hidden" />
          <div>
            <label class="label">Admin-Passwort</label>
            <input v-model="adminSecret" type="password" class="input mt-1" autocomplete="current-password" required />
          </div>
          <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
          <button type="submit" class="btn-primary w-full" :disabled="isLoading">
            {{ isLoading ? "Wird geladen…" : "Anmelden" }}
          </button>
        </form>
      </div>

      <!-- Vereinsliste -->
      <template v-else>
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm text-gray-600">{{ clubs.length }} Vereine registriert</p>
          <button class="btn-secondary text-sm" @click="isAuthenticated = false">
            Abmelden
          </button>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Verein</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Slug</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Mitglieder</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Storage</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <template v-for="club in clubs" :key="club.id">
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">{{ club.name }}</td>
                  <td class="px-4 py-3 font-mono text-gray-600">{{ club.slug }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ club._count.users }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ club.storageType ?? "–" }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="
                        club.isSetupDone
                          ? 'bg-green-100 text-green-800'
                          : club.isSetupRequested
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-600'
                      "
                    >
                      {{
                        club.isSetupDone
                          ? "Aktiv"
                          : club.isSetupRequested
                            ? "Setup angefragt"
                            : "Ausstehend"
                      }}
                    </span>
                    <span
                      v-if="setupSuccess === club.id"
                      class="ml-2 text-xs text-green-700"
                    >
                      ✓ Eingerichtet
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      v-if="!club.isSetupDone"
                      class="btn-secondary py-1 text-xs"
                      @click="setupClubId = setupClubId === club.id ? null : club.id"
                    >
                      Storage einrichten
                    </button>
                  </td>
                </tr>

                <!-- Setup-Formular -->
                <tr v-if="setupClubId === club.id">
                  <td colspan="6" class="bg-gray-50 px-4 py-4">
                    <div class="max-w-lg space-y-3">
                      <h3 class="font-medium text-gray-900">
                        Google Drive einrichten für {{ club.name }}
                      </h3>
                      <div>
                        <label class="label">Service Account E-Mail</label>
                        <input v-model="setupEmail" type="email" class="input mt-1" />
                      </div>
                      <div>
                        <label class="label">Private Key (JSON-Inhalt)</label>
                        <textarea
                          v-model="setupKey"
                          class="input mt-1 font-mono text-xs"
                          rows="3"
                        />
                      </div>
                      <div v-if="setupError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                        {{ setupError }}
                      </div>
                      <div class="flex gap-3">
                        <button
                          class="btn-primary text-sm"
                          :disabled="isSetupLoading"
                          @click="onSetupStorage(club.id)"
                        >
                          {{ isSetupLoading ? "Wird eingerichtet…" : "Einrichten" }}
                        </button>
                        <button class="btn-secondary text-sm" @click="setupClubId = null">
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
