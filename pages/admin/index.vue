<script setup lang="ts">
definePageMeta({ layout: false })

interface ClubWithCount {
  id: string
  slug: string
  name: string
  storageType: string | null
  isSetupDone: boolean
  superuserHasLoggedIn: boolean
  createdAt: string
  _count: { users: number }
}

const adminSecret = ref('')
const isAuthenticated = ref(false)
const isLoading = ref(false)
const clubs = ref<ClubWithCount[]>([])
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ clubs: ClubWithCount[] }>('/api/admin/clubs')
    clubs.value = data.clubs
    isAuthenticated.value = true
  } catch {
    // no valid session cookie — show login form
  }
})

const deleteClubId = ref<string | null>(null)
const isDeleteLoading = ref(false)
const deleteError = ref<string | null>(null)

const resendedClubs = ref<Set<string>>(new Set())
const isResendLoading = ref<string | null>(null)
const resendError = ref<string | null>(null)

async function onLogout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  isAuthenticated.value = false
  clubs.value = []
  adminSecret.value = ''
}

async function onLogin() {
  isLoading.value = true
  error.value = null
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { secret: adminSecret.value },
    })
    const data = await $fetch<{ clubs: ClubWithCount[] }>('/api/admin/clubs')
    clubs.value = data.clubs
    isAuthenticated.value = true
  } catch {
    error.value = 'Falsches Passwort'
  } finally {
    isLoading.value = false
  }
}

async function onResendInvite(clubId: string) {
  isResendLoading.value = clubId
  resendError.value = null
  try {
    await $fetch(`/api/admin/clubs/${clubId}/resend-invite`, { method: 'POST' as const })
    resendedClubs.value = new Set([...resendedClubs.value, clubId])
  } catch (err: unknown) {
    resendError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isResendLoading.value = null
  }
}

async function onDeleteClub(clubId: string) {
  isDeleteLoading.value = true
  deleteError.value = null
  try {
    await $fetch(`/api/admin/clubs/${clubId}/delete`, { method: 'POST' as const })
    deleteClubId.value = null
    clubs.value = clubs.value.filter((c) => c.id !== clubId)
  } catch (err: unknown) {
    deleteError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isDeleteLoading.value = false
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
          <button class="btn-secondary text-sm" @click="onLogout">
            Abmelden
          </button>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Verein</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Slug</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500">Kinder</th>
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
                          : club.superuserHasLoggedIn
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                      "
                    >
                      {{
                        club.isSetupDone
                          ? "Aktiv"
                          : club.superuserHasLoggedIn
                            ? "Einrichtung ausstehend"
                            : "Ausstehend"
                      }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-2">
                      <button
                        v-if="!club.isSetupDone && !club.superuserHasLoggedIn && !resendedClubs.has(club.id)"
                        class="btn-secondary py-1 text-xs"
                        :disabled="isResendLoading === club.id"
                        @click="onResendInvite(club.id)"
                      >
                        {{ isResendLoading === club.id ? '…' : 'Resend Invite' }}
                      </button>
                      <button
                        class="btn-danger py-1 text-xs"
                        @click="deleteClubId = deleteClubId === club.id ? null : club.id"
                      >
                        Löschen
                      </button>
                    </div>
                    <div v-if="resendedClubs.has(club.id)" class="mt-1 text-right text-xs text-green-700">
                      ✓ Invite gesendet
                    </div>
                    <div v-if="resendError" class="mt-1 text-right text-xs text-red-700">{{ resendError }}</div>
                  </td>
                </tr>

                <!-- Delete-Bestätigung -->
                <tr v-if="deleteClubId === club.id">
                  <td colspan="6" class="bg-red-50 px-4 py-4">
                    <div class="flex items-center justify-between">
                      <p class="text-sm text-red-700">
                        <strong>{{ club.name }}</strong> und alle Daten unwiderruflich löschen?
                      </p>
                      <div class="flex gap-2">
                        <div v-if="deleteError" class="text-xs text-red-700">{{ deleteError }}</div>
                        <button
                          class="btn-danger py-1 text-xs"
                          :disabled="isDeleteLoading"
                          @click="onDeleteClub(club.id)"
                        >
                          {{ isDeleteLoading ? "Wird gelöscht…" : "Ja, löschen" }}
                        </button>
                        <button class="btn-secondary py-1 text-xs" @click="deleteClubId = null">
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
