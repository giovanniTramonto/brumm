<script setup lang="ts">
import { useMembersStore } from '~/stores/members'
import { useParentJobsStore } from '~/stores/parentJobs'
import type { Member, ParentJob, ParentJobMember } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const jobId = route.params.id as string

const membersStore = useMembersStore()
const parentJobsStore = useParentJobsStore()

const job = ref<ParentJob | null>(null)
const isLoading = ref(true)
const pageError = ref<string | null>(null)

const isEditingName = ref(false)
const editName = ref('')
const isSavingName = ref(false)
const nameError = ref<string | null>(null)

const deletingMemberId = ref<string | null>(null)
const togglingMemberId = ref<string | null>(null)

const isAddingMember = ref(false)
const addError = ref<string | null>(null)

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

const leaders = computed<ParentJobMember[]>(
  () => job.value?.members?.filter((m) => m.isLeader) ?? [],
)
const others = computed<ParentJobMember[]>(
  () => job.value?.members?.filter((m) => !m.isLeader) ?? [],
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

async function onToggleLeader(member: ParentJobMember) {
  togglingMemberId.value = member.id
  try {
    const data = await $fetch<{ member: ParentJobMember }>(
      `/api/ini/${slug}/parent-jobs/${jobId}/members/${member.id}`,
      { method: 'PATCH', body: { isLeader: !member.isLeader } },
    )
    if (job.value?.members) {
      job.value.members = job.value.members.map((m) => (m.id === member.id ? data.member : m))
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
      <NuxtLink :to="`/ini/${slug}/parent-jobs`" class="text-sm text-gray-500 hover:text-gray-900">← Elternposten</NuxtLink>
    </div>

    <LoadingBrumm v-if="isLoading" />

    <p v-else-if="pageError" class="text-sm text-red-600">{{ pageError }}</p>

    <template v-else-if="job">
      <div class="card mb-4 space-y-4">
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
            <button type="button" class="btn-secondary py-1 text-sm" @click="onStartEditName">Umbenennen</button>
          </template>
        </div>
        <p v-if="nameError" class="text-sm text-red-600">{{ nameError }}</p>
      </div>

      <div class="card space-y-4">
        <h2 class="text-sm font-medium text-gray-900">Mitglieder</h2>

        <ul v-if="job.members?.length">
          <li v-for="m in leaders" :key="m.id" class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900">{{ m.name ?? m.email }}</p>
              <p class="text-xs text-gray-500">{{ m.email }}</p>
            </div>
            <span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Leitung</span>
            <button
              type="button"
              class="btn-secondary py-1 text-xs"
              :disabled="togglingMemberId === m.id"
              @click="onToggleLeader(m)"
            >
              {{ togglingMemberId === m.id ? '…' : 'Leitung entfernen' }}
            </button>
            <button
              type="button"
              class="btn-danger py-1 text-xs"
              :disabled="deletingMemberId === m.id"
              @click="onRemoveMember(m)"
            >
              {{ deletingMemberId === m.id ? '…' : 'Entfernen' }}
            </button>
          </li>
          <li v-for="m in others" :key="m.id" class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900">{{ m.name ?? m.email }}</p>
              <p class="text-xs text-gray-500">{{ m.email }}</p>
            </div>
            <button
              type="button"
              class="btn-secondary py-1 text-xs"
              :disabled="togglingMemberId === m.id"
              @click="onToggleLeader(m)"
            >
              {{ togglingMemberId === m.id ? '…' : 'Als Leitung' }}
            </button>
            <button
              type="button"
              class="btn-danger py-1 text-xs"
              :disabled="deletingMemberId === m.id"
              @click="onRemoveMember(m)"
            >
              {{ deletingMemberId === m.id ? '…' : 'Entfernen' }}
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500">Noch keine Mitglieder.</p>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Mitglied hinzufügen</h3>
          <div v-if="addError" role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ addError }}</div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <select
                v-model="selectedEmail"
                class="input w-full text-sm"
              >
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
