<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useParentJobsStore } from '~/stores/parentJobs'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

const authStore = useAuthStore()
const { canManageClub } = storeToRefs(authStore)

const parentJobsStore = useParentJobsStore()

const newName = ref('')
const isCreating = ref(false)
const createError = ref<string | null>(null)
const deletingId = ref<string | null>(null)

const isEditing = ref(false)

const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

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

function onDragStart(event: DragEvent, id: string) {
  draggedId.value = id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, id: string) {
  event.preventDefault()
  dragOverId.value = id
}

function onDrop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId) return
  const jobs = parentJobsStore.parentJobs
  const from = jobs.findIndex((j) => j.id === draggedId.value)
  const to = jobs.findIndex((j) => j.id === targetId)
  const updated = [...jobs]
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  const ids = updated.map((j) => j.id)
  parentJobsStore.reorder(ids)
  draggedId.value = null
  dragOverId.value = null
  $fetch(`/api/ini/${slug}/parent-jobs/reorder`, { method: 'PUT', body: { ids } })
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Elternposten</h1>
      <button v-if="canManageClub" type="button" class="btn-secondary text-sm" @click="isEditing = !isEditing">
        {{ isEditing ? 'Fertig' : 'Bearbeiten' }}
      </button>
    </div>

    <LoadingBrumm v-if="parentJobsStore.isLoading" />

    <div v-else class="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
      <p v-if="!parentJobsStore.parentJobs.length && !(canManageClub && isEditing)" class="col-span-full text-sm text-gray-500">
        Noch keine Elternposten angelegt.
      </p>

      <div
        v-for="job in parentJobsStore.parentJobs"
        :key="job.id"
        :draggable="canManageClub && isEditing"
        :class="[
          'card flex flex-col gap-3',
          !isEditing ? 'cursor-pointer hover:ring-1 hover:ring-primary-300' : '',
          draggedId === job.id ? 'opacity-40' : '',
          dragOverId === job.id && dragOverId !== draggedId ? 'ring-2 ring-primary-500' : '',
        ]"
        @click="!isEditing && navigateTo(`/ini/${slug}/parent-jobs/${job.id}`)"
        @dragstart="canManageClub && isEditing && onDragStart($event, job.id)"
        @dragover="canManageClub && isEditing && onDragOver($event, job.id)"
        @drop="canManageClub && isEditing && onDrop(job.id)"
        @dragend="onDragEnd"
      >
        <div class="flex items-start gap-2">
          <span v-if="canManageClub && isEditing" class="mt-0.5 cursor-grab text-gray-300 active:cursor-grabbing">⠿</span>
          <span class="flex-1 font-semibold text-gray-900">{{ job.name }}</span>
        </div>

        <div v-if="job.members?.length" class="space-y-1">
          <div v-for="m in job.members" :key="m.id" class="text-sm font-medium text-gray-900">
            {{ m.name ?? m.email }}
          </div>
        </div>
        <p v-else class="text-xs text-gray-400">Noch keine Mitglieder</p>

        <div v-if="canManageClub && isEditing" class="mt-auto flex justify-end border-t pt-3">
          <button
            type="button"
            class="btn-danger py-1 text-xs"
            :disabled="deletingId === job.id"
            @click.stop="onDelete(job.id, job.name)"
          >
            {{ deletingId === job.id ? '…' : 'Löschen' }}
          </button>
        </div>
      </div>

      <div v-if="canManageClub && isEditing" class="flex flex-col gap-3 rounded-lg border-2 border-dashed border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-700">Neuer Elternposten</p>
        <div v-if="createError" role="alert" class="rounded-md bg-red-50 p-2 text-xs text-red-700">{{ createError }}</div>
        <input
          v-model="newName"
          type="text"
          class="input text-sm"
          placeholder="z.B. Elterndienst"
          @keydown.enter="onCreate"
        />
        <button
          type="button"
          class="btn-primary text-sm"
          :disabled="!newName.trim() || isCreating"
          @click="onCreate"
        >
          {{ isCreating ? 'Wird angelegt…' : 'Anlegen' }}
        </button>
      </div>
    </div>
  </div>
</template>
