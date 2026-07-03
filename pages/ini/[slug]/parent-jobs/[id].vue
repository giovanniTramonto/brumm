<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import { useParentJobsStore } from '~/stores/parentJobs'
import type { Member, ParentJob, ParentJobMember } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const jobId = route.params.id as string

const authStore = useAuthStore()
const { canManageClub } = storeToRefs(authStore)

const membersStore = useMembersStore()
const parentJobsStore = useParentJobsStore()

const job = ref<ParentJob | null>(null)
const isLoading = ref(true)
const pageError = ref<string | null>(null)

const isEditing = ref(false)
const isEditingName = ref(false)
const editName = ref('')
const isSavingName = ref(false)
const nameError = ref<string | null>(null)

const deletingMemberId = ref<string | null>(null)
const togglingMemberId = ref<string | null>(null)

const draggedMemberId = ref<string | null>(null)
const dragOverMemberId = ref<string | null>(null)

function onMemberDragStart(event: DragEvent, id: string) {
  draggedMemberId.value = id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onMemberDragOver(event: DragEvent, id: string) {
  event.preventDefault()
  dragOverMemberId.value = id
}

function onMemberDrop(targetId: string) {
  if (!draggedMemberId.value || draggedMemberId.value === targetId || !job.value?.members) return
  const members = job.value.members
  const from = members.findIndex((m) => m.id === draggedMemberId.value)
  const to = members.findIndex((m) => m.id === targetId)
  const updated = [...members]
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  job.value.members = updated
  parentJobsStore.updateParentJob(job.value)
  draggedMemberId.value = null
  dragOverMemberId.value = null
  $fetch(`/api/ini/${slug}/parent-jobs/${jobId}/members/reorder`, {
    method: 'PUT',
    body: { ids: updated.map((m) => m.id) },
  })
}

function onMemberDragEnd() {
  draggedMemberId.value = null
  dragOverMemberId.value = null
}

const isAddingMember = ref(false)
const addError = ref<string | null>(null)

const localTasks = ref<Record<string, string>>({})
const savingTasksMemberId = ref<string | null>(null)

function initLocalTasks(members: ParentJobMember[]) {
  for (const m of members) {
    if (!(m.id in localTasks.value)) {
      localTasks.value[m.id] = m.tasks ?? ''
    }
  }
}

type GuardianOption = {
  email: string
  name: string | null
  phone: string | null
  childNames: string[]
}
const selectedEmail = ref<string | null>(null)
const addIsLeader = ref(false)

onMounted(async () => {
  await Promise.all([
    membersStore.fetchMembers(slug),
    (async () => {
      try {
        const data = await $fetch<{ parentJob: ParentJob }>(`/api/ini/${slug}/parent-jobs/${jobId}`)
        job.value = data.parentJob
        initLocalTasks(data.parentJob.members ?? [])
      } catch {
        pageError.value = 'Elternposten nicht gefunden'
      } finally {
        isLoading.value = false
      }
    })(),
  ])
})

const activeMembers = computed(() =>
  membersStore.members.filter((m) => m.status === 'ACTIVE' || m.status === 'INACTIVE'),
)

const existingEmails = computed(() => {
  const set = new Set<string>()
  for (const m of job.value?.members ?? []) set.add(m.email)
  return set
})

const memberIdsByEmail = computed(() => {
  const map = new Map<string, string[]>()
  for (const m of membersStore.members as Member[]) {
    if (m.email1) {
      map.set(m.email1, [...(map.get(m.email1) ?? []), m.id])
    }
    if (m.email2) {
      map.set(m.email2, [...(map.get(m.email2) ?? []), m.id])
    }
  }
  return map
})

const jobMembers = computed<ParentJobMember[]>(() => job.value?.members ?? [])

const guardianOptions = computed<GuardianOption[]>(() => {
  const emailMap = new Map<
    string,
    { name: string | null; phone: string | null; childNames: string[] }
  >()
  for (const m of activeMembers.value as Member[]) {
    const childName = `${m.firstName} ${m.lastName}`.trim()
    if (m.email1 && !existingEmails.value.has(m.email1)) {
      const entry = emailMap.get(m.email1)
      if (entry) {
        entry.childNames.push(childName)
      } else {
        emailMap.set(m.email1, {
          name: m.guardian1Name ?? null,
          phone: m.phone1 ?? null,
          childNames: [childName],
        })
      }
    }
    if (m.email2 && !existingEmails.value.has(m.email2)) {
      const entry = emailMap.get(m.email2)
      if (entry) {
        entry.childNames.push(childName)
      } else {
        emailMap.set(m.email2, {
          name: m.guardian2Name ?? null,
          phone: m.phone2 ?? null,
          childNames: [childName],
        })
      }
    }
  }
  return Array.from(emailMap.entries())
    .map(([email, { name, phone, childNames }]) => ({ email, name, phone, childNames }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'de'))
})

const selectedGuardian = computed<GuardianOption | null>(
  () => guardianOptions.value.find((o) => o.email === selectedEmail.value) ?? null,
)

function onStartEditName() {
  editName.value = job.value?.name ?? ''
  isEditingName.value = true
  nameError.value = null
}

function onCancelEditName() {
  isEditingName.value = false
  nameError.value = null
}

async function onSaveName() {
  if (!editName.value.trim() || !job.value) return
  nameError.value = null
  isSavingName.value = true
  try {
    const data = await $fetch<{ parentJob: ParentJob }>(`/api/ini/${slug}/parent-jobs/${jobId}`, {
      method: 'PATCH',
      body: { name: editName.value.trim() },
    })
    job.value = { ...job.value, name: data.parentJob.name }
    parentJobsStore.updateParentJob(data.parentJob)
    isEditingName.value = false
  } catch (err: unknown) {
    nameError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingName.value = false
  }
}

async function onSaveTasks(member: ParentJobMember) {
  const value = (localTasks.value[member.id] ?? '').trim() || null
  savingTasksMemberId.value = member.id
  try {
    const data = await $fetch<{ member: ParentJobMember }>(
      `/api/ini/${slug}/parent-jobs/${jobId}/members/${member.id}`,
      { method: 'PATCH', body: { tasks: value } },
    )
    if (job.value?.members) {
      job.value.members = job.value.members.map((m) => (m.id === member.id ? data.member : m))
      parentJobsStore.updateParentJob(job.value)
    }
    localTasks.value[member.id] = value ?? ''
  } finally {
    savingTasksMemberId.value = null
  }
}

async function onToggleLeader(member: ParentJobMember) {
  togglingMemberId.value = member.id
  try {
    const data = await $fetch<{ member: ParentJobMember }>(
      `/api/ini/${slug}/parent-jobs/${jobId}/members/${member.id}`,
      { method: 'PATCH', body: { isLeader: !member.isLeader } },
    )
    if (job.value?.members) {
      job.value.members = job.value.members.map((m) => (m.id === member.id ? data.member : m))
      parentJobsStore.updateParentJob(job.value)
    }
  } finally {
    togglingMemberId.value = null
  }
}

async function onRemoveMember(member: ParentJobMember) {
  if (!confirm(`„${member.name ?? member.email}" aus diesem Posten entfernen?`)) return
  deletingMemberId.value = member.id
  try {
    await $fetch(`/api/ini/${slug}/parent-jobs/${jobId}/members/${member.id}`, { method: 'DELETE' })
    if (job.value?.members) {
      job.value.members = job.value.members.filter((m) => m.id !== member.id)
      parentJobsStore.updateParentJob(job.value)
    }
  } finally {
    deletingMemberId.value = null
  }
}

async function onAddMember() {
  if (!selectedGuardian.value) return
  addError.value = null
  isAddingMember.value = true
  try {
    const { email, name, phone } = selectedGuardian.value
    const data = await $fetch<{ member: ParentJobMember }>(
      `/api/ini/${slug}/parent-jobs/${jobId}/members`,
      { method: 'POST', body: { email, name, phone, isLeader: addIsLeader.value } },
    )
    if (job.value) {
      job.value.members = [...(job.value.members ?? []), data.member]
      parentJobsStore.updateParentJob(job.value)
    }
    selectedEmail.value = null
    addIsLeader.value = false
  } catch (err: unknown) {
    addError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Fehler beim Hinzufügen'
  } finally {
    isAddingMember.value = false
  }
}

function optionLabel(opt: GuardianOption): string {
  const base = opt.name ?? opt.email
  return `${base} (${opt.childNames.join(', ')})`
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/parent-jobs`" class="text-sm text-gray-500 hover:text-gray-900">← Zurück</NuxtLink>
    </div>

    <LoadingBrumm v-if="isLoading" />

    <p v-else-if="pageError" class="text-sm text-red-600">{{ pageError }}</p>

    <template v-else-if="job">
      <div class="card space-y-4">
        <div class="flex items-center gap-3">
          <template v-if="isEditingName">
            <input
              v-model="editName"
              type="text"
              class="input flex-1 text-xl font-bold"
              @keydown.enter="onSaveName"
              @keydown.escape="onCancelEditName"
            />
            <button type="button" class="btn-primary py-1 text-sm" :disabled="isSavingName || !editName.trim()" @click="onSaveName">
              {{ isSavingName ? '…' : 'Speichern' }}
            </button>
            <button type="button" class="btn-secondary py-1 text-sm" @click="onCancelEditName">Abbrechen</button>
          </template>
          <template v-else>
            <h1 class="flex-1 text-2xl font-bold text-gray-900">{{ job.name }}</h1>
            <button v-if="canManageClub && isEditing" type="button" class="btn-secondary py-1 text-sm" @click="onStartEditName">Umbenennen</button>
            <button v-if="canManageClub" type="button" class="btn-secondary py-1 text-sm" @click="isEditing = !isEditing">
              {{ isEditing ? 'Fertig' : 'Bearbeiten' }}
            </button>
          </template>
        </div>
        <p v-if="nameError" class="text-sm text-red-600">{{ nameError }}</p>

        <p v-if="!jobMembers.length" class="text-sm text-gray-500">Noch keine Mitglieder.</p>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200">
                <th v-if="canManageClub && isEditing" class="w-4 pb-2 pr-3" />
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Name</th>
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Aufgaben</th>
                <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">E-Mail</th>
                <th class="pb-2 text-left text-xs font-medium text-gray-500">Telefon</th>
                <th v-if="canManageClub && isEditing" class="pb-2" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in jobMembers"
                :key="m.id"
                :draggable="canManageClub && isEditing"
                :class="[
                  dragOverMemberId === m.id && dragOverMemberId !== draggedMemberId ? 'border-t-2 border-primary-500' : 'border-t border-gray-100',
                  draggedMemberId === m.id ? 'opacity-40' : '',
                  'align-top',
                ]"
                @dragstart="canManageClub && isEditing && onMemberDragStart($event, m.id)"
                @dragover="canManageClub && isEditing && onMemberDragOver($event, m.id)"
                @drop="canManageClub && isEditing && onMemberDrop(m.id)"
                @dragend="onMemberDragEnd"
              >
                <td v-if="canManageClub && isEditing" class="pr-3 pt-2.5 align-top">
                  <span class="cursor-grab text-gray-300 active:cursor-grabbing">⠿</span>
                </td>
                <td class="whitespace-nowrap py-2.5 pr-6 align-top font-medium text-gray-900">
                  <template v-if="canManageClub && memberIdsByEmail.get(m.email)?.length">
                    <span class="inline-block max-w-48 whitespace-normal">
                      <NuxtLink :to="`/ini/${slug}/members/${memberIdsByEmail.get(m.email)![0]}`" class="text-blue-600 hover:text-blue-800">{{ m.name ?? m.email }} →</NuxtLink>
                    </span>
                  </template>
                  <span v-else class="inline-block max-w-48 whitespace-normal">{{ m.name ?? m.email }}</span>
                  <span v-if="m.isLeader" class="ml-1.5 inline-block rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">Leitung</span>
                </td>
                <td class="min-w-80 py-2.5 pr-6 align-top">
                  <template v-if="canManageClub && isEditing">
                    <textarea
                      v-model="localTasks[m.id]"
                      class="input w-full resize-none text-xs"
                      rows="3"
                    />
                    <button
                      v-if="(localTasks[m.id] ?? '') !== (m.tasks ?? '')"
                      type="button"
                      class="btn-primary mt-1 py-0.5 text-xs"
                      :disabled="savingTasksMemberId === m.id"
                      @click="onSaveTasks(m)"
                    >
                      {{ savingTasksMemberId === m.id ? '…' : 'Speichern' }}
                    </button>
                  </template>
                  <span v-else class="text-xs text-gray-500">{{ m.tasks ?? '–' }}</span>
                </td>
                <td class="py-2.5 pr-6 align-top">
                  <a :href="`mailto:${m.email}`" class="text-blue-600 hover:text-blue-800">{{ m.email }}</a>
                </td>
                <td class="py-2.5 align-top">
                  <a v-if="m.phone" :href="`tel:${m.phone}`" class="font-mono text-blue-600 hover:underline">{{ m.phone }}</a>
                </td>
                <td v-if="canManageClub && isEditing" class="py-2.5 pl-4">
                  <div class="flex items-center justify-end gap-2">
                    <label class="flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        class="accent-primary-600"
                        :checked="m.isLeader"
                        :disabled="togglingMemberId === m.id"
                        @change="onToggleLeader(m)"
                      />
                      Leitung
                    </label>
                    <button
                      type="button"
                      class="btn-danger py-0.5 text-xs"
                      :disabled="deletingMemberId === m.id"
                      @click="onRemoveMember(m)"
                    >
                      {{ deletingMemberId === m.id ? '…' : 'Entfernen' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="canManageClub && isEditing" class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Mitglied hinzufügen</h3>
          <div v-if="addError" role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ addError }}</div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <select v-model="selectedEmail" class="input w-full text-sm">
                <option :value="null">Erziehungsberechtigte/n auswählen…</option>
                <option v-for="opt in guardianOptions" :key="opt.email" :value="opt.email">
                  {{ optionLabel(opt) }}
                </option>
              </select>
            </div>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input v-model="addIsLeader" type="checkbox" class="accent-primary-600" />
              Leitung
            </label>
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="!selectedGuardian || isAddingMember"
              @click="onAddMember"
            >
              {{ isAddingMember ? 'Wird hinzugefügt…' : 'Hinzufügen' }}
            </button>
          </div>
          <p v-if="guardianOptions.length === 0 && activeMembers.length > 0" class="mt-2 text-xs text-gray-500">
            Alle aktiven Erziehungsberechtigten sind bereits in diesem Posten.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
