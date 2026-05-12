<script setup lang="ts">
import { useManagersStore } from '~/stores/managers'
import type { Manager } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const managerId = route.params.id as string
const managersStore = useManagersStore()

const manager = ref<Manager | null>(null)
const form = reactive({ name: '', email: '', isMemberManager: false })
const isLoading = ref(true)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ manager: Manager }>(`/api/ini/${slug}/managers/${managerId}`)
    manager.value = data.manager
    form.name = data.manager.name
    form.email = data.manager.email
    form.isMemberManager = data.manager.isMemberManager
  } catch {
    error.value = 'Vorstandsmitglied nicht gefunden'
  } finally {
    isLoading.value = false
  }
})

async function onSubmit() {
  isSubmitting.value = true
  error.value = null
  try {
    await managersStore.updateManager(slug, managerId, form)
    await navigateTo(`/ini/${slug}/management`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}

async function onDelete() {
  if (!confirm(`${manager.value?.name} wirklich entfernen?`)) return
  isDeleting.value = true
  try {
    await managersStore.deleteManager(slug, managerId)
    await navigateTo(`/ini/${slug}/management`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Löschen'
    isDeleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/management`" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">{{ manager?.name ?? 'Vorstandsmitglied' }}</h1>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500" role="status" aria-live="polite">
      Brumm, brumm …
    </div>

    <form v-else class="card max-w-lg" @submit.prevent="onSubmit">
      <div v-if="error" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ error }}
      </div>

      <div class="space-y-4">
        <div>
          <label for="name" class="label">Name</label>
          <input id="name" v-model="form.name" type="text" class="input" required />
        </div>
        <div>
          <label for="email" class="label">E-Mail</label>
          <input id="email" v-model="form.email" type="email" class="input" required />
        </div>
        <div class="flex items-center gap-3">
          <input id="isMemberManager" v-model="form.isMemberManager" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600" />
          <label for="isMemberManager" class="text-sm text-gray-700">Kinderverwaltung</label>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="flex gap-3">
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Wird gespeichert …' : 'Speichern' }}
          </button>
          <NuxtLink :to="`/ini/${slug}/management`" class="btn-secondary">Abbrechen</NuxtLink>
        </div>
        <button type="button" class="btn-danger" :disabled="isDeleting" @click="onDelete">
          {{ isDeleting ? 'Wird entfernt …' : 'Entfernen' }}
        </button>
      </div>
    </form>
  </div>
</template>
