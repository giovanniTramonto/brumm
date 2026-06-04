<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import { CARE_TYPE_OPTIONS } from '~/utils/reimbursement'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const search = ref('')

type SortKey = 'name' | 'group' | 'careType' | 'contractEnd' | 'status'
const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0,
  INACTIVE: 1,
  REGISTERED: 2,
  PENDING_INVITE: 3,
  DEACTIVATED: 4,
}

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key as SortKey
    sortDir.value = 'asc'
  }
}

const canManageMembers = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
})

const isMember = computed(() => authStore.currentUser?.role === 'MEMBER')

const showNoMemberManagerHint = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'MANAGER' && !user?.isMemberManager
})

onMounted(() => membersStore.fetchMembers(slug))

const filteredMembers = computed(() => {
  const q = search.value.toLowerCase()
  const filtered = membersStore.members.filter(
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
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Kinder</h1>
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
        >
          Kind anlegen
        </NuxtLink>
        <span
          v-else
          class="btn-primary cursor-not-allowed opacity-50"
          aria-disabled="true"
          role="link"
        >
          Kind anlegen
        </span>
      </div>
    </div>

    <div v-if="showNoMemberManagerHint" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <template v-if="membersStore.hasAnyMemberManager">
        Kinder können nur von <span class="font-semibold">{{ membersStore.memberManagerNames.join(', ') }}</span> verwaltet werden.
      </template>
      <template v-else>
        Es gibt noch keinen Vorstand, der Zugriff auf die Kinderverwaltung hat. Frage beim Admin nach.
      </template>
    </div>

    <div v-if="authStore.currentUser?.role === 'SUPERUSER' || authStore.currentUser?.role === 'MANAGER'" class="mb-4">
      <input
        v-model="search"
        type="search"
        class="input max-w-sm"
        placeholder="Suche nach Name…"
      />
    </div>

    <LoadingBrumm v-if="membersStore.isLoading" />

    <StoreError v-else-if="membersStore.error" :error="membersStore.error" :slug="slug" />

    <div v-else-if="filteredMembers.length === 0" class="card">
      <p class="text-sm text-gray-500">Keine Kinder gefunden.</p>
    </div>

    <div v-else class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <SortableTableHeader label="Name" columnKey="name" :activeSortKey="sortKey" :activeSortDir="sortDir" class="w-1/2" @sort="toggleSort" />
            <SortableTableHeader label="Gruppe" columnKey="group" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader v-if="canManageMembers || isMember" label="Betreuungsumfang" columnKey="careType" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader label="Vertragsende" columnKey="contractEnd" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <SortableTableHeader label="Status" columnKey="status" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
            <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="member in filteredMembers" :key="member.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink :to="`/ini/${slug}/members/${member.id}`" class="font-medium text-gray-900 hover:text-primary-700">
                {{ member.lastName }}, {{ member.firstName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ member.group?.name ?? "–" }}</td>
            <td v-if="canManageMembers || isMember" class="px-4 py-3 text-sm">
              <span v-if="member.careType" class="text-gray-600">
                {{ CARE_TYPE_OPTIONS.find(o => o.key === member.careType)?.label ?? member.careType }}
              </span>
              <span v-else-if="member.status === 'ACTIVE'" class="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">fehlt</span>
              <span v-else class="text-gray-400">–</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ member.contractEnd ?? '–' }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : member.status === 'INACTIVE' ? 'bg-orange-100 text-orange-700' : member.status === 'DEACTIVATED' ? 'bg-gray-100 text-gray-600' : member.status === 'PENDING_INVITE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
              >
                {{ member.status === 'ACTIVE' ? "Aktiv" : member.status === 'INACTIVE' ? "Inaktiv" : member.status === 'DEACTIVATED' ? "Abgemeldet" : member.status === 'PENDING_INVITE' ? "Ausstehend" : "Bestätigt" }}
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
