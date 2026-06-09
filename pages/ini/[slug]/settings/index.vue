<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'SUPERUSER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const reconnected = route.query.reconnected === '1'

const nameInput = ref(authStore.currentClub?.name ?? '')
const isEditingName = ref(false)
const isSavingName = ref(false)
const nameError = ref('')

function onEditName() {
  nameInput.value = authStore.currentClub?.name ?? ''
  nameError.value = ''
  isEditingName.value = true
}

function onCancelName() {
  isEditingName.value = false
  nameError.value = ''
}

async function onSaveName() {
  if (!nameInput.value.trim()) return
  isSavingName.value = true
  nameError.value = ''
  try {
    const data = await $fetch<{ name: string }>(`/api/ini/${slug}/settings/name`, {
      method: 'PATCH',
      body: { name: nameInput.value.trim() },
    })
    if (authStore.currentClub) authStore.currentClub.name = data.name
    isEditingName.value = false
  } catch (err) {
    nameError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingName.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Einstellungen</h1>

    <div v-if="reconnected" class="rounded-md bg-green-50 p-3 text-sm text-green-700">
      Google Drive wurde erfolgreich neu verbunden.
    </div>

    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Verein</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Name</dt>
          <dd class="text-gray-900">
            <form v-if="isEditingName" class="flex items-center gap-2" @submit.prevent="onSaveName">
              <input
                v-model="nameInput"
                type="text"
                class="input text-sm"
                maxlength="100"
                required
                autofocus
              />
              <button type="submit" class="btn-primary text-sm" :disabled="isSavingName">Speichern</button>
              <button type="button" class="btn-secondary text-sm" @click="onCancelName">Abbrechen</button>
            </form>
            <template v-else>
              {{ authStore.currentClub?.name }}
              <button class="ml-2 text-xs text-primary-600 hover:underline" @click="onEditName">Ändern</button>
            </template>
            <p v-if="nameError" class="mt-1 text-xs text-red-600">{{ nameError }}</p>
          </dd>
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
          <dd :class="authStore.currentClub?.isSetupDone ? 'text-green-700' : 'text-orange-600'">
            {{ authStore.currentClub?.isSetupDone ? "Abgeschlossen" : "Ausstehend" }}
          </dd>
        </div>
      </dl>
      <div class="flex gap-2 pt-2">
        <NuxtLink
          v-if="!authStore.currentClub?.isSetupDone"
          :to="`/ini/${slug}/settings/onboarding`"
          class="btn-primary inline-block text-sm"
        >
          Jetzt einrichten
        </NuxtLink>
        <template v-if="authStore.currentClub?.isSetupDone">
          <NuxtLink
            :to="`/ini/${slug}/settings/onboarding`"
            class="btn-secondary inline-block text-sm"
          >
            Datenspeicher ändern
          </NuxtLink>
          <a
            :href="`/api/ini/${slug}/auth/google`"
            class="btn-secondary inline-block text-sm"
          >
            Google neu verbinden
          </a>
        </template>
      </div>
    </div>

    <div class="card space-y-4 border-red-200">
      <h2 class="font-semibold text-red-700">Gefahrenbereich</h2>
      <p class="text-sm text-gray-600">
        Den Verein und alle Daten unwiderruflich löschen.
      </p>
      <NuxtLink :to="`/ini/${slug}/settings/delete`" class="btn-danger inline-block text-sm">
        Verein löschen
      </NuxtLink>
    </div>
  </div>
</template>
