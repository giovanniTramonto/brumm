<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useParentJobsStore } from '~/stores/parentJobs'
import type { ParentJob } from '~/types'

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

function sortedJobMembers(job: ParentJob) {
  return [...(job.members ?? [])].sort((a, b) =>
    a.isLeader === b.isLeader ? 0 : a.isLeader ? -1 : 1,
  )
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

    <div class="card space-y-4">
      <LoadingBrumm v-if="parentJobsStore.isLoading" />

      <template v-else>
        <p v-if="parentJobsStore.parentJobs.length === 0" class="text-sm text-gray-500">Noch keine Elternposten angelegt.</p>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200">
                <th v-if="canManageClub && isEditing" class="w-4 pb-2 pr-3" />
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Posten</th>
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Mitglied</th>
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">E-Mail</th>
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Telefon</th>
                <th class="pb-2" />
              </tr>
            </thead>
            <tbody
              v-for="job in parentJobsStore.parentJobs"
              :key="job.id"
              :draggable="canManageClub && isEditing"
              :class="{ 'opacity-40': draggedId === job.id }"
              @dragstart="canManageClub && isEditing && onDragStart($event, job.id)"
              @dragover="canManageClub && isEditing && onDragOver($event, job.id)"
              @drop="canManageClub && isEditing && onDrop(job.id)"
              @dragend="onDragEnd"
            >
              <template v-if="job.members?.length">
                <tr
                  v-for="(m, i) in sortedJobMembers(job)"
                  :key="m.id"
                  :class="i === 0 && dragOverId === job.id && dragOverId !== draggedId ? 'border-t-2 border-primary-500' : i === 0 ? 'border-t border-gray-100' : ''"
                >
                  <td v-if="i === 0 && canManageClub && isEditing" :rowspan="job.members.length" class="pr-3 align-top pt-3">
                    <span class="cursor-grab text-gray-300 active:cursor-grabbing">⠿</span>
                  </td>
                  <td v-if="i === 0" :rowspan="job.members.length" class="pr-6 align-top font-medium text-gray-900" :class="{ 'pt-3': true, 'pb-3': job.members.length === 1 }">
                    <NuxtLink :to="`/ini/${slug}/parent-jobs/${job.id}`" draggable="false" class="hover:text-primary-700">{{ job.name }}</NuxtLink>
                  </td>
                  <td class="whitespace-nowrap pr-6 align-top text-gray-900" :class="{ 'pt-3': i === 0, 'pb-3': i === job.members.length - 1, 'py-1': i > 0 && i < job.members.length - 1 }">
                    <span class="inline-block max-w-48 whitespace-normal">{{ m.name ?? m.email }}</span>
                    <span v-if="m.isLeader" class="ml-1.5 inline-block rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">Leitung</span>
                  </td>
                  <td class="pr-6 align-top" :class="{ 'pt-3': i === 0, 'pb-3': i === job.members.length - 1, 'py-1': i > 0 && i < job.members.length - 1 }">
                    <a :href="`mailto:${m.email}`" class="text-blue-600 hover:text-blue-800">{{ m.email }}</a>
                  </td>
                  <td class="pr-6 align-top" :class="{ 'pt-3': i === 0, 'pb-3': i === job.members.length - 1, 'py-1': i > 0 && i < job.members.length - 1 }">
                    <a v-if="m.phone" :href="`tel:${m.phone}`" class="font-mono text-blue-600 hover:underline">{{ m.phone }}</a>
                  </td>
                  <td v-if="i === 0" :rowspan="job.members.length" class="align-top pt-3">
                    <div class="flex items-center justify-end gap-2">
                      <NuxtLink :to="`/ini/${slug}/parent-jobs/${job.id}`" draggable="false" class="btn-secondary py-1 text-xs">Ansehen</NuxtLink>
                      <button v-if="canManageClub && isEditing" type="button" class="btn-danger py-1 text-xs" :disabled="deletingId === job.id" @click="onDelete(job.id, job.name)">
                        {{ deletingId === job.id ? '…' : 'Löschen' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-else :class="dragOverId === job.id && dragOverId !== draggedId ? 'border-t-2 border-primary-500' : 'border-t border-gray-100'">
                <td v-if="canManageClub && isEditing" class="pr-3 pt-3 align-top">
                  <span class="cursor-grab text-gray-300 active:cursor-grabbing">⠿</span>
                </td>
                <td class="pr-6 pt-3 pb-3 align-top font-medium text-gray-900">
                  <NuxtLink :to="`/ini/${slug}/parent-jobs/${job.id}`" draggable="false" class="hover:text-primary-700">{{ job.name }}</NuxtLink>
                </td>
                <td colspan="3" class="pr-6 pt-3 pb-3 text-xs text-gray-400">Noch keine Mitglieder</td>
                <td class="pt-3 pb-3 align-top">
                  <div class="flex items-center gap-2">
                    <NuxtLink :to="`/ini/${slug}/parent-jobs/${job.id}`" draggable="false" class="btn-secondary py-1 text-xs">Ansehen</NuxtLink>
                    <button v-if="canManageClub && isEditing" type="button" class="btn-danger py-1 text-xs" :disabled="deletingId === job.id" @click="onDelete(job.id, job.name)">
                      {{ deletingId === job.id ? '…' : 'Löschen' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="canManageClub && isEditing" class="border-t pt-4">
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
