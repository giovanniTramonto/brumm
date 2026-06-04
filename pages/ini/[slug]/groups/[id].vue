<script setup lang="ts">
import { useGroupsStore } from '~/stores/groups'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const groupId = route.params.id as string
const groupsStore = useGroupsStore()

const form = reactive({ name: '' })
const isLoading = ref(true)
const isSubmitting = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  await groupsStore.fetchGroups(slug)
  const group = groupsStore.groups.find((g) => g.id === groupId)
  if (group) {
    form.name = group.name
  } else {
    error.value = 'Gruppe nicht gefunden'
  }
  isLoading.value = false
})

async function onSubmit() {
  isSubmitting.value = true
  error.value = null
  try {
    await groupsStore.updateGroup(slug, groupId, { name: form.name.trim() || undefined })
    await navigateTo(`/ini/${slug}/groups`)
  } catch (err) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/groups`" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Gruppe bearbeiten</h1>
    </div>

    <LoadingBrumm v-if="isLoading" />

    <div v-else-if="error && !form.name" class="rounded-md bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <form v-else class="card max-w-lg space-y-4" @submit.prevent="onSubmit">
      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ error }}
      </div>

      <div>
        <label for="name" class="label">Name *</label>
        <input id="name" v-model="form.name" type="text" class="input mt-1" required />
      </div>
      <div class="flex gap-3">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wird gespeichert…' : 'Speichern' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/groups`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
