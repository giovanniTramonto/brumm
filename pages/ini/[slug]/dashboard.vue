<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import { CARE_TYPE_OPTIONS } from '~/utils/reimbursement'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const { isMember, canManageMembers } = storeToRefs(authStore)

const totalCount = computed(
  () => membersStore.members.filter((m) => m.status !== 'DEACTIVATED').length,
)

const activeCount = computed(() => membersStore.members.filter((m) => m.status === 'ACTIVE').length)

const inactiveCount = computed(
  () =>
    membersStore.members.filter(
      (m) => m.status === 'INACTIVE' || m.status === 'PENDING_INVITE' || m.status === 'REGISTERED',
    ).length,
)

const pendingMembers = computed(() =>
  membersStore.members.filter((m) => m.status === 'PENDING_INVITE' || m.status === 'REGISTERED'),
)

const noCareTypeMembers = computed(() =>
  membersStore.members.filter((m) => m.status !== 'DEACTIVATED' && !m.careType),
)

const contractEndingSoon = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  return membersStore.members.filter(
    (m) =>
      (m.status === 'ACTIVE' || m.status === 'INACTIVE') &&
      Number(m.contractEnd) === year &&
      month < 7,
  )
})

const deactivatedMembers = computed(() =>
  membersStore.members
    .filter((m) => m.status === 'DEACTIVATED')
    .sort((a, b) => (a.deactivatedAt ?? '').localeCompare(b.deactivatedAt ?? '')),
)

const expiredContractMembers = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  return membersStore.members.filter((m) => {
    if (m.status !== 'ACTIVE' && m.status !== 'INACTIVE') return false
    if (!m.contractEnd) return false
    const endYear = Number(m.contractEnd)
    return endYear < year || (endYear === year && month >= 7)
  })
})

const activeByGroup = computed(() => {
  const map = new Map<string, { active: number; inactive: number }>()
  for (const m of membersStore.members) {
    if (m.status === 'DEACTIVATED') continue
    const key = m.group?.name ?? '–'
    if (key === '–') continue
    const entry = map.get(key) ?? { active: 0, inactive: 0 }
    if (m.status === 'ACTIVE') entry.active++
    else entry.inactive++
    map.set(key, entry)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'))
})

const noGroupMembers = computed(() =>
  membersStore.members.filter((m) => m.status !== 'DEACTIVATED' && !m.groupId),
)

const byCareType = computed(() => {
  const map = new Map<string, { active: number; inactive: number }>()
  for (const m of membersStore.members) {
    if (m.status === 'DEACTIVATED' || !m.careType) continue
    const entry = map.get(m.careType) ?? { active: 0, inactive: 0 }
    if (m.status === 'ACTIVE') entry.active++
    else entry.inactive++
    map.set(m.careType, entry)
  }
  return CARE_TYPE_OPTIONS.filter(({ key }) => map.has(key)).map(
    ({ key, label }) => [label, map.get(key) ?? { active: 0, inactive: 0 }] as const,
  )
})

function deletionDate(deactivatedAt: string) {
  const d = new Date(deactivatedAt)
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(() => membersStore.fetchMembers(slug))
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">
        Willkommen{{ authStore.currentUser?.firstName ? `, ${authStore.currentUser.firstName}` : '' }}!
      </h1>
    </div>

    <div class="space-y-6">
      <DashboardMemberStatus v-if="isMember" :slug="slug" />

      <template v-if="canManageMembers">
        <!-- Stat-Grid -->
        <div class="grid gap-4 desktop:grid-cols-3">
          <div class="card desktop:col-span-2">
            <div class="grid grid-cols-3">
              <div>
                <p class="text-sm font-medium text-gray-500">Angemeldete Kinder</p>
                <p class="mt-1 font-mono text-3xl font-bold text-gray-900">{{ totalCount }}</p>
              </div>
              <div>
                <p class="text-sm font-medium text-green-500">Aktiv</p>
                <p class="mt-1 font-mono text-3xl font-bold text-green-600">{{ activeCount }}</p>
              </div>
              <div>
                <p class="text-sm font-medium text-purple-500">Inaktiv</p>
                <p class="mt-1 font-mono text-3xl font-bold text-purple-800">{{ inactiveCount }}</p>
              </div>
            </div>
            <div v-if="activeByGroup.length > 0" class="mt-6 grid grid-cols-3 gap-y-1">
              <template v-for="[group, counts] in activeByGroup" :key="group">
                <span class="text-xs text-gray-500">{{ group }}</span>
                <span class="text-xs font-medium text-gray-400">{{ counts.active }}</span>
                <span class="text-xs font-medium text-gray-400">{{ counts.inactive || '–' }}</span>
              </template>
            </div>
            <div v-if="byCareType.length > 0" class="mt-4 grid grid-cols-3 gap-y-1">
              <template v-for="[label, counts] in byCareType" :key="label">
                <span class="text-xs text-gray-500">{{ label }}</span>
                <span class="text-xs font-medium text-gray-400">{{ counts.active }}</span>
                <span class="text-xs font-medium text-gray-400">{{ counts.inactive || '–' }}</span>
              </template>
            </div>
            <div v-if="pendingMembers.length > 0 || noGroupMembers.length > 0 || noCareTypeMembers.length > 0" class="mt-8 space-y-3">
              <div v-if="pendingMembers.length > 0">
                <p class="text-xs font-medium text-orange-700">{{ pendingMembers.length === 1 ? '1 wartet auf Aktivierung' : `${pendingMembers.length} warten auf Aktivierung` }}</p>
                <ul class="mt-1 space-y-0">
                  <li v-for="m in pendingMembers" :key="m.id">
                    <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-orange-600 hover:text-orange-800">
                      {{ m.firstName }} {{ m.lastName }} →
                    </NuxtLink>
                  </li>
                </ul>
              </div>
              <div v-if="noGroupMembers.length > 0">
                <p class="text-xs font-medium text-orange-700">{{ noGroupMembers.length === 1 ? '1 ohne Gruppe' : `${noGroupMembers.length} ohne Gruppe` }}</p>
                <ul class="mt-1 space-y-0">
                  <li v-for="m in noGroupMembers" :key="m.id">
                    <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-orange-600 hover:text-orange-800">
                      {{ m.firstName }} {{ m.lastName }} →
                    </NuxtLink>
                  </li>
                </ul>
              </div>
              <div v-if="noCareTypeMembers.length > 0">
                <p class="text-xs font-medium text-orange-700">{{ noCareTypeMembers.length === 1 ? '1 Betreuungsumfang fehlt' : `${noCareTypeMembers.length} Betreuungsumfänge fehlen` }}</p>
                <ul class="mt-1 space-y-0">
                  <li v-for="m in noCareTypeMembers" :key="m.id">
                    <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-orange-600 hover:text-orange-800">
                      {{ m.firstName }} {{ m.lastName }} →
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <div class="card flex-1">
              <p class="text-sm font-medium text-gray-500">Vertragsende in {{ new Date().getFullYear() }}</p>
              <p class="mt-1 font-mono text-3xl font-bold text-orange-500">{{ contractEndingSoon.length }}</p>
              <ul v-if="contractEndingSoon.length > 0" class="mt-5 space-y-1">
                <li v-for="m in contractEndingSoon" :key="m.id" class="flex items-center justify-between gap-1">
                  <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-gray-600 hover:text-gray-900">
                    {{ m.firstName }} {{ m.lastName }} →
                  </NuxtLink>
                  <span class="shrink-0 font-mono text-xs text-gray-400">
                    {{ new Date(m.birthDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                  </span>
                </li>
              </ul>
              <template v-if="expiredContractMembers.length > 0">
                <p class="mt-8 text-xs font-medium text-red-700">Vertragsende überschritten</p>
                <ul class="mt-1 space-y-1">
                  <li v-for="m in expiredContractMembers" :key="m.id">
                    <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-red-600 hover:text-red-800">
                      {{ m.firstName }} {{ m.lastName }} →
                    </NuxtLink>
                  </li>
                </ul>
              </template>
            </div>
            <div class="card flex-1">
              <p class="text-sm font-medium text-gray-500">Abgemeldet</p>
              <p class="mt-1 font-mono text-3xl font-bold text-gray-400">{{ deactivatedMembers.length }}</p>
              <ul v-if="deactivatedMembers.length > 0" class="mt-5 space-y-1">
                <li v-for="m in deactivatedMembers" :key="m.id" class="flex items-center justify-between gap-1">
                  <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-gray-600 hover:text-gray-900">
                    {{ m.firstName }} {{ m.lastName }} →
                  </NuxtLink>
                  <span v-if="m.deactivatedAt" class="text-xs text-gray-400 shrink-0">
                    Löschung am <span class="font-mono">{{ deletionDate(m.deactivatedAt) }}</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </template>

      <template v-if="authStore.currentUser?.role === 'TEAM'">
        <div class="grid gap-4 desktop:grid-cols-3">
          <div class="desktop:col-span-2 desktop:h-full">
            <DashboardGroups :slug="slug" class="h-full" />
          </div>
          <DashboardBirthdays :slug="slug" class="h-full" />
        </div>
      </template>

      <DashboardAktuell :slug="slug" />
      <DashboardDocuments :slug="slug" />
    </div>
  </div>
</template>
