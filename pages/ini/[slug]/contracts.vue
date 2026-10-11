<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useIsbjStore } from '~/stores/isbj'
import { useMembersStore } from '~/stores/members'
import type { ISBJContract, Member } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string
const authStore = useAuthStore()
const { canManageClub, isSuperUser } = storeToRefs(authStore)

// Same text color as FootnoteCard; only MANAGER and SUPERUSER can open this page
const roleTextClass = computed(() => (isSuperUser.value ? 'text-admin-800' : 'text-ini-800'))
const isbjStore = useIsbjStore()
const { contracts, isConfigured, voucherError, isLoading, error } = storeToRefs(isbjStore)
const membersStore = useMembersStore()

// Voucher numbers are typed in by hand, so ignore whitespace and case when matching
function normalizeVoucherNumber(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

const membersByVoucherNumber = computed(() => {
  const map = new Map<string, Member[]>()
  for (const m of membersStore.members) {
    if (m.deletedAt || !m.voucherNumber) continue
    const key = normalizeVoucherNumber(m.voucherNumber)
    map.set(key, [...(map.get(key) ?? []), m])
  }
  return map
})

function getMembers(c: ISBJContract): Member[] {
  if (!c.voucherNumber) return []
  return membersByVoucherNumber.value.get(normalizeVoucherNumber(c.voucherNumber)) ?? []
}

onMounted(() => {
  if (canManageClub.value) isbjStore.fetchContracts(slug)
})

function onReload() {
  isbjStore.fetchContracts(slug, { force: true })
}

type SortKey =
  | 'voucherNumber'
  | 'member'
  | 'startDate'
  | 'careScope'
  | 'expectedEndDate'
  | 'surcharges'
const SORT_KEYS: SortKey[] = [
  'voucherNumber',
  'member',
  'startDate',
  'careScope',
  'expectedEndDate',
  'surcharges',
]

// Default: newest contract start first
const hasSortQuery = computed(() => SORT_KEYS.includes(route.query.sort as SortKey))
const sortKey = computed<SortKey>(() =>
  hasSortQuery.value ? (route.query.sort as SortKey) : 'startDate',
)
const sortDir = computed<'asc' | 'desc'>(() => {
  if (!hasSortQuery.value) return 'desc'
  return route.query.dir === 'desc' ? 'desc' : 'asc'
})

function toggleSort(key: string) {
  const dir = sortKey.value === key && sortDir.value === 'asc' ? 'desc' : 'asc'
  router.replace({ query: { ...route.query, sort: key, dir } })
}

function getSortValue(c: ISBJContract, key: SortKey): string {
  if (key === 'member')
    return getMembers(c)
      .map((m) => `${m.lastName}, ${m.firstName}`)
      .join(' / ')
  if (key === 'surcharges') return (c.surcharges ?? []).map((s) => s.type).join(', ')
  return c[key] ?? ''
}

// Empty values always sort last, independent of the direction
const sortedContracts = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...contracts.value].sort((a, b) => {
    const aValue = getSortValue(a, sortKey.value)
    const bValue = getSortValue(b, sortKey.value)
    if (!aValue && bValue) return 1
    if (aValue && !bValue) return -1
    return aValue.localeCompare(bValue, 'de') * dir
  })
})

// ISBJ's aktiv=true only means "not cancelled" — a contract is running if today is within its term
const today = new Date().toLocaleDateString('sv-SE')
function isRunning(c: ISBJContract): boolean {
  return !!c.startDate && c.startDate <= today && (!c.endDate || c.endDate >= today)
}

function formatDate(date: string | null): string {
  if (!date) return '–'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">
        Verträge<span v-if="isConfigured && !isLoading && !error" class="ml-2 inline-flex rounded-full bg-white px-2.5 py-0.5 align-middle font-mono text-sm font-medium text-gray-900 shadow-sm ring-1 ring-gray-900/5">{{ contracts.length }}</span>
      </h1>
      <button v-if="canManageClub && isConfigured && !isLoading" type="button" class="btn-secondary text-sm" @click="onReload">
        Neu laden
      </button>
    </div>

    <div v-if="!canManageClub" class="rounded-md bg-red-50 p-4 text-sm text-red-700">
      Keine Berechtigung.
    </div>

    <template v-else>
      <div v-if="isLoading" aria-live="polite">
        <LoadingBrumm />
        <p class="text-center text-sm" :class="roleTextClass">Lade Verträge aus dem ISBJ-Trägerportal …</p>
      </div>

      <div v-else-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

      <div v-else-if="!isConfigured" class="card text-sm text-gray-500">
        Es ist keine Verbindung zum ISBJ-Trägerportal eingerichtet.
        <template v-if="isSuperUser">
          Die Verbindung kann unter
          <NuxtLink :to="`/ini/${slug}/settings`" class="text-blue-600 hover:underline">Einstellungen</NuxtLink>
          konfiguriert werden.
        </template>
      </div>

      <div v-else-if="contracts.length === 0" class="card">
        <p class="text-sm text-gray-500">Keine aktiven Verträge in ISBJ.</p>
      </div>

      <template v-else>
        <div class="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <SortableTableHeader label="Gutschein" columnKey="voucherNumber" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
                <SortableTableHeader label="Kind" columnKey="member" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
                <SortableTableHeader label="Laufzeit" columnKey="startDate" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
                <SortableTableHeader label="Umfang" columnKey="careScope" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
                <SortableTableHeader label="Vorauss. Ende" columnKey="expectedEndDate" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
                <SortableTableHeader label="Zuschläge" columnKey="surcharges" class="max-w-[200px]" :activeSortKey="sortKey" :activeSortDir="sortDir" @sort="toggleSort" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="c in sortedContracts" :key="c.contractNumber" class="whitespace-nowrap hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">
                  <span
                    v-if="c.voucherNumber"
                    class="inline-flex rounded-full px-2 py-0.5 font-mono text-xs font-medium"
                    :class="isRunning(c) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
                  >{{ c.voucherNumber }}</span>
                  <span v-else class="text-gray-400">–</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="getMembers(c).length > 0" class="flex flex-col">
                    <NuxtLink
                      v-for="m in getMembers(c)"
                      :key="m.id"
                      :to="`/ini/${slug}/members/${m.id}`"
                      class="font-medium text-gray-900 hover:text-primary-700"
                    >{{ m.lastName }}, {{ m.firstName }}</NuxtLink>
                  </div>
                  <span v-else-if="membersStore.isLoading" class="text-gray-400">…</span>
                  <span v-else-if="isRunning(c)" class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">nicht zugeordnet</span>
                  <span v-else class="text-gray-400">–</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ formatDate(c.startDate) }} – {{ formatDate(c.endDate) }}</td>
                <td class="px-4 py-3 text-sm">
                  <span v-if="c.careScope" class="text-gray-600">
                    {{ c.careScope }}<span v-if="c.withMeal" class="text-gray-400"> · mit Essen</span>
                  </span>
                  <span v-else class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">fehlt</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ formatDate(c.expectedEndDate) }}
                  <span v-if="c.expectedEndReason" class="text-gray-400">({{ c.expectedEndReason }})</span>
                </td>
                <td class="max-w-[200px] whitespace-normal px-4 py-3 text-sm">
                  <span v-if="c.surcharges === null" class="text-gray-400">?</span>
                  <span v-else-if="c.surcharges.length === 0" class="text-gray-400">–</span>
                  <span v-else class="flex flex-wrap gap-1">
                    <span
                      v-for="s in c.surcharges"
                      :key="s.type"
                      class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                    >{{ s.type }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="voucherError" class="mt-3 text-xs text-gray-500">
          Gutscheindaten (Zuschläge) nicht verfügbar: {{ voucherError }}
        </p>
      </template>

      <FootnoteCard v-if="isConfigured">
        <p class="mb-2 text-xs font-medium">Hinweise zu den Verträgen</p>
        <ul class="list-disc space-y-1 pl-4 text-xs">
          <li>Live aus dem ISBJ-Trägerportal geladen, nicht gespeichert</li>
          <li>Grün markierte Verträge laufen aktuell (heute innerhalb der Laufzeit)</li>
          <li>Die Zuordnung zum Kind erfolgt über die Gutscheinnummer, die beim Kind hinterlegt ist</li>
        </ul>
      </FootnoteCard>
    </template>
  </div>
</template>
