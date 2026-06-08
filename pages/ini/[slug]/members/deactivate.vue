<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const confirmed = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

async function onDeactivate() {
  if (!confirmed.value || !authStore.currentUser) return
  isLoading.value = true
  error.value = null
  try {
    await membersStore.deactivateMember(slug, authStore.currentUser.id)
    authStore.clearAuth()
    await navigateTo('/register')
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Abmeldung fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-lg">
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
    </div>

    <div class="card space-y-6">
      <div>
        <h1 class="text-xl font-bold text-red-700">Vom Verein abmelden</h1>
        <p class="mt-2 text-sm text-gray-600">
          Wenn du dein Kind vom Verein abmeldest, werden alle aktiven Sitzungen beendet.
          Gemäß DSGVO werden alle persönlichen Daten nach einem Jahr vollständig gelöscht.
        </p>
      </div>

      <div class="rounded-md bg-orange-50 p-4">
        <p class="text-sm font-medium text-orange-800">
          Abzumelden:
          <strong>
            {{ authStore.currentUser?.firstName }} {{ authStore.currentUser?.lastName }}
          </strong>
        </p>
      </div>

      <label class="flex cursor-pointer items-start gap-3">
        <input v-model="confirmed" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
        <span class="text-sm text-gray-700">
          Ich bestätige, dass ich mein Kind vom Verein abmelden möchte. Diese Aktion kann
          nicht rückgängig gemacht werden.
        </span>
      </label>

      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

      <button
        class="btn-danger w-full"
        :disabled="!confirmed || isLoading"
        @click="onDeactivate"
      >
        {{ isLoading ? "Wird abgemeldet…" : "Endgültig abmelden" }}
      </button>
    </div>
  </div>
</template>
