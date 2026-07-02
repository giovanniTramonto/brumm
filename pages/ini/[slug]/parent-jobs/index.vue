<script setup lang="ts">
import { useParentJobsStore } from '~/stores/parentJobs'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

const parentJobsStore = useParentJobsStore()

const newName = ref('')
const isCreating = ref(false)
const createError = ref<string | null>(null)
const deletingId = ref<string | null>(null)

onMounted(async () => {
  await parentJobsStore.fetchParentJobs(slug)
})

async function onCreate() {
  if (!newName.value.trim()) return
  createError.value = null
  isCreating.value = true
  try {
    const data = await $fetch<{ parentJob: { id: string; name: string } }>(
      `/api/ini/${slug}/parent-jobs`,
      { method: 'POST', body: { name: newName.value.trim() } },
    )
    parentJobsStore.addParentJob(data.parentJob)
    newName.value = ''
  } catch (err: unknown) {
    createError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Anlegen'
  } finally {
    isCreating.value = false
  }
}

async function onDelete(id: string, name: string) {
  if (!confirm(`„${name}" wirklich löschen?`)) return
  deletingId.value = id
  try {
    await $fetch(`/api/ini/${slug}/parent-jobs/${id}`, { method: 'DELETE' })
    parentJobsStore.removeParentJob(id)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-900">← Zurück</NuxtLink>
    </div>

    <div class="card space-y-4">
      <h1 class="text-2xl font-bold text-gray-900">Elternposten</h1>

      <LoadingBrumm v-if="parentJobsStore.isLoading" />

      <template v-else>
        <p v-if="parentJobsStore.parentJobs.length === 0" class="text-sm text-gray-500">Noch keine Elternposten angelegt.</p>

        <ul v-else class="divide-y divide-gray-100">
          <li v-for="job in parentJobsStore.parentJobs" :key="job.id" class="flex items-center gap-3 py-3">
            <span class="min-w-0 flex-1 text-sm font-medium text-gray-900">{{ job.name }}</span>
            <NuxtLink :to="`/ini/${slug}/parent-jobs/${job.id}`" class="btn-secondary py-1 text-xs">Bearbeiten</NuxtLink>
            <button type="button" class="btn-danger py-1 text-xs" :disabled="deletingId === job.id" @click="onDelete(job.id, job.name)">
              {{ deletingId === job.id ? '…' : 'Löschen' }}
            </button>
          </li>
        </ul>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Neuer Elternposten</h3>
          <div v-if="createError" role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ createError }}</div>
          <div class="flex gap-3">
            <input
              v-model="newName"
              type="text"
              class="input flex-1 text-sm"
              placeholder="z.B. Elterndienst"
              @keydown.enter="onCreate"
            />
            <button type="button" class="btn-primary text-sm" :disabled="!newName.trim() || isCreating" @click="onCreate">
              {{ isCreating ? 'Wird angelegt…' : 'Anlegen' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
