<script setup lang="ts">
import { useManagersStore } from '~/stores/managers'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const managersStore = useManagersStore()

const isResetting = ref(false)
const isResetConfirming = ref(false)
const resetError = ref<string | null>(null)

async function onResetStorage() {
  if (!isResetConfirming.value) {
    isResetConfirming.value = true
    return
  }
  isResetting.value = true
  resetError.value = null
  try {
    await $fetch(`/api/ini/${slug}/settings/reset-storage`, { method: 'POST' })
    isResetConfirming.value = false
  } catch (e: unknown) {
    resetError.value = e instanceof Error ? e.message : 'Fehler beim Zurücksetzen'
  } finally {
    isResetting.value = false
  }
}

onMounted(async () => {
  await managersStore.fetchManagers(slug)
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Vorstand</h1>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <button
            class="btn-secondary text-sm text-red-600 hover:text-red-700"
            :disabled="isResetting"
            @click="onResetStorage"
          >
            {{ isResetConfirming ? 'Wirklich zurücksetzen?' : 'Storage zurücksetzen' }}
          </button>
          <button
            v-if="isResetConfirming"
            class="text-sm text-gray-500 hover:text-gray-700"
            @click="isResetConfirming = false"
          >
            Abbrechen
          </button>
        </div>
        <NuxtLink :to="`/ini/${slug}/managers/create`" class="btn-primary">
          Vorstand hinzufügen
        </NuxtLink>
      </div>
    </div>
    <p v-if="resetError" class="mb-4 text-sm text-red-600">{{ resetError }}</p>

    <div v-if="managersStore.isLoading" class="text-sm text-gray-500" role="status" aria-live="polite">
      Brumm, brumm …
    </div>

    <StoreError v-else-if="managersStore.error" :error="managersStore.error" :slug="slug" />

    <div v-else class="card">
      <ul v-if="managersStore.managers.length > 0" role="list" class="divide-y divide-gray-100">
        <li
          v-for="m in managersStore.managers"
          :key="m.id"
          class="flex items-center justify-between py-4"
        >
          <div>
            <p class="font-medium text-gray-900">{{ m.name }}</p>
            <p class="mt-0.5 text-sm text-gray-500">
              {{ m.email }}
              <span v-if="m.isMemberManager" class="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                Kinderverwaltung
              </span>
            </p>
          </div>
          <NuxtLink :to="`/ini/${slug}/managers/${m.id}`" class="btn-secondary text-sm">
            Bearbeiten
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="text-sm text-gray-500">Noch keine Vorstandsmitglieder eingetragen.</p>
    </div>
  </div>
</template>
