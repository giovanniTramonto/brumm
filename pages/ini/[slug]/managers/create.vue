<script setup lang="ts">
import { useManagersStore } from '~/stores/managers'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const managersStore = useManagersStore()

const form = reactive({ name: '', email: '', isMemberManager: false })
const isSubmitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  isSubmitting.value = true
  error.value = null
  try {
    await managersStore.createManager(slug, form)
    await navigateTo(`/ini/${slug}/managers`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <NuxtLink :to="`/ini/${slug}/managers`" class="mb-6 block text-sm text-gray-500 hover:text-gray-700">← Zurück</NuxtLink>

    <form class="card max-w-lg" @submit.prevent="onSubmit">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">Vorstand hinzufügen</h1>

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

      <div class="mt-6 flex gap-3">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wird gespeichert …' : 'Hinzufügen' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/managers`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
