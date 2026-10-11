<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import { CARE_TYPE_OPTIONS } from '~/utils/reimbursement'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

// The list already filters while typing; submitting just closes the on-screen keyboard
function onSearchSubmit() {
  searchInput.value?.blur()
}

// New contractEnd values are "YYYY-MM"; legacy ones are a plain "YYYY" year.
function formatContractEnd(contractEnd: string): string {
  const match = contractEnd.match(/^(\d{4})-(\d{2})$/)
  if (!match) return contractEnd
  return `${match[2]}/${match[1]}`
}

type SortKey = 'name' | 'group' | 'careType' | 'birthDate' | 'contractEnd' | 'status'
const SORT_KEYS: SortKey[] = ['name', 'group', 'careType', 'birthDate', 'contractEnd', 'status']

const sortKey = computed<SortKey>(() =>
  SORT_KEYS.includes(route.query.sort as SortKey) ? (route.query.sort as SortKey) : 'name',
)
const sortDir = computed<'asc' | 'desc'>(() => (route.query.dir === 'desc' ? 'desc' : 'asc'))

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0,
  INACTIVE: 1,
  REGISTERED: 2,
  PENDING_INVITE: 3,
  DEACTIVATED: 4,
}

// Shared by the status column and the counters next to the title
const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: 'Aktiv', class: 'bg-green-100 text-green-800' },
  INACTIVE: { label: 'Inaktiv', class: 'bg-purple-100 text-purple-800' },
  REGISTERED: { label: 'Bestätigt', class: 'bg-blue-100 text-blue-800' },
  PENDING_INVITE: { label: 'Ausstehend', class: 'bg-orange-100 text-orange-800' },
  DEACTIVATED: { label: 'Abgemeldet', class: 'bg-gray-100 text-gray-600' },
}

function toggleSort(key: string) {
  const dir = sortKey.value === key && sortDir.value === 'asc' ? 'desc' : 'asc'
  router.replace({ query: { ...route.query, sort: key, dir } })
}

const { isMember, canManageMembers } = storeToRefs(authStore)

const showNoMemberManagerHint = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'MANAGER' && !user?.isMemberManager
})

const visibleMembers = computed(() =>
  (isMember.value ? membersStore.members.filter((m) => m.isOwnChild) : membersStore.members).filter(
    (m) => !m.deletedAt,
  ),
)

// Counts per status (independent of the search), only statuses that occur, in STATUS_ORDER
const statusCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const m of visibleMembers.value) counts.set(m.status, (counts.get(m.status) ?? 0) + 1)
  return Object.keys(STATUS_ORDER)
    .filter((status) => counts.has(status))
    .map((status) => ({ status, count: counts.get(status) ?? 0, ...STATUS_BADGES[status] }))
})

const filteredMembers = computed(() => {
  const q = search.value.toLowerCase()
  const filtered = visibleMembers.value.filter(
    (m) => m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q),
  )
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    switch (sortKey.value) {
      case 'name':
        return (
          dir * `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'de')
        )
      case 'group':
        return dir * (a.group?.name ?? '').localeCompare(b.group?.name ?? '', 'de')
      case 'careType':
        return dir * (a.careType ?? '').localeCompare(b.careType ?? '', 'de')
      case 'birthDate':
        return dir * (a.birthDate ?? '').localeCompare(b.birthDate ?? '')
      case 'contractEnd':
        return dir * (a.contractEnd ?? '').localeCompare(b.contractEnd ?? '')
      case 'status':
        return dir * ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
      default:
        return 0
    }
  })
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900">Kinder</h1>
        <!-- Counters only from tablet on, phones are too narrow -->
        <template v-if="!membersStore.isLoading && !membersStore.error">
          <span
            v-for="s in statusCounts"
            :key="s.status"
            class="hidden rounded-full px-2.5 py-0.5 text-sm font-medium tablet:inline-flex"
            :class="s.class"
          >
            <span class="font-mono">{{ s.count }}</span>&nbsp;{{ s.label.toLowerCase() }}
          </span>
        </template>
      </div>
      <div v-if="authStore.currentUser?.role !== 'MEMBER'" class="flex gap-3">
        <NuxtLink
          v-if="canManageMembers"
          :to="`/ini/${slug}/contract-templates`"
          class="btn-secondary"
        >
          Vertragsvorlagen
        </NuxtLink>
<NuxtLink
          v-if="canManageMembers || isMember"
          :to="`/ini/${slug}/members/create`"
          class="btn-primary"
          aria-label="Kind anlegen"
        >
          <span class="inline-flex items-center gap-1 tablet:hidden" aria-hidden="true">
            <AppIcon name="plus" class="h-4 w-4" />
            Kind
          </span>
          <span class="hidden tablet:inline">Kind anlegen</span>
        </NuxtLink>
      </div>
    </div>

    <div v-if="showNoMemberManagerHint" class="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
      <template v-if="membersStore.hasAnyMemberManager">
        Kinder können nur von <span class="font-semibold">{{ membersStore.memberManagerNames.join(', ') }}</span> verwaltet werden.
      </template>
      <template v-else>
        Es gibt noch keinen Vorstand, der Zugriff auf die Kinderverwaltung hat. Frage beim Admin nach.
      </template>
    </div>

    <form
      v-if="authStore.currentUser?.role === 'SUPERUSER' || authStore.currentUser?.role === 'MANAGER'"
      role="search"
      class="card mb-4 flex max-w-full gap-2"
      @submit.prevent="onSearchSubmit"
    >
      <input
        ref="searchInput"
        v-model="search"
        type="search"
        class="input max-w-sm"
        aria-label="Kinder nach Name suchen"
        placeholder="Suche nach Name…"
      />
      <button type="submit" class="btn-secondary shrink-0" aria-label="Suchen">
        <AppIcon name="search" class="h-5 w-5" />
      </button>
    </form>

    <LoadingBrumm v-if="membersStore.isLoading" />

    <StoreError v-else-if="membersStore.error" :error="membersStore.error" :slug="slug" />

    <div v-else-if="filteredMembers.length === 0" class="card">
      <p class="text-sm text-gray-500">Keine Kinder gefunden.</p>
    </div>

    <div v-else class="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <SortableTableHeader label="Name" columnKey="name" :activeSortKey="sortKey" :activeSortDir="sortDir" class="w-1/2" @sort="toggleSort" />
            <SortableTableHeader label="Geburtsdatum" columnKey="birthDate" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader label="Gruppe" columnKey="group" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader v-if="canManageMembers || isMember" label="Betreuungsumfang" columnKey="careType" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader label="Vertragsende" columnKey="contractEnd" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader label="Status" columnKey="status" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="member in filteredMembers" :key="member.id" class="hover:bg-gray-50" :class="{ 'bg-gray-50/50': member.status === 'DEACTIVATED' }">
            <td class="px-4 py-3">
              <NuxtLink :to="`/ini/${slug}/members/${member.id}`" class="font-medium hover:text-primary-700" :class="member.status === 'DEACTIVATED' ? 'text-gray-500' : 'text-gray-900'">
                {{ member.lastName }}, {{ member.firstName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ new Date(member.birthDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
            </td>
            <td class="px-4 py-3 text-sm">
              <span v-if="member.group?.name" class="text-gray-600">{{ member.group.name }}</span>
              <span v-else class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">fehlt</span>
            </td>
            <td v-if="canManageMembers || isMember" class="px-4 py-3 text-sm">
              <span v-if="member.careType" class="text-gray-600">
                {{ CARE_TYPE_OPTIONS.find(o => o.key === member.careType)?.label ?? member.careType }}
              </span>
              <span v-else class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">fehlt</span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span v-if="member.contractEnd" class="text-gray-600">{{ formatContractEnd(member.contractEnd) }}</span>
              <span v-else class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">fehlt</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGES[member.status]?.class"
              >
                {{ STATUS_BADGES[member.status]?.label }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <NuxtLink
                :to="`/ini/${slug}/members/${member.id}`"
                class="btn-secondary py-1 text-xs"
              >
                Ansehen
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
