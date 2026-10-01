<script setup lang="ts">
import { useIsbjStore } from '~/stores/isbj'

// Not async on purpose: loading from ISBJ takes seconds and must not block the dashboard's <Suspense>
const props = defineProps<{ slug: string }>()
const isbjStore = useIsbjStore()
const { contracts, isConfigured, voucherError, isLoading, error } = storeToRefs(isbjStore)

onMounted(() => {
  isbjStore.fetchContracts(props.slug)
})

function onReload() {
  isbjStore.fetchContracts(props.slug, { force: true })
}

const isVisible = computed(() => isLoading.value || isConfigured.value)

function formatDate(date: string | null): string {
  if (!date) return '–'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}
</script>

<template>
  <div v-if="isVisible" class="card">
    <div class="mb-3 flex items-center justify-between gap-4">
      <h2 class="text-sm font-medium text-gray-900">
        ISBJ-Verträge<span v-if="!isLoading && !error" class="ml-2 font-mono text-gray-400">{{ contracts.length }}</span>
      </h2>
      <button v-if="!isLoading" type="button" class="btn-secondary text-xs" @click="onReload">Neu laden</button>
    </div>

    <p v-if="isLoading" class="text-sm text-gray-500" aria-live="polite">Lade Verträge aus dem ISBJ-Trägerportal …</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <template v-else>
      <p v-if="contracts.length === 0" class="text-sm text-gray-500">Keine aktiven Verträge in ISBJ.</p>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200 text-left font-medium uppercase tracking-wide text-gray-500">
              <th class="pb-2 pr-6">Vertrag</th>
              <th class="pb-2 pr-6">Laufzeit</th>
              <th class="pb-2 pr-6">Umfang</th>
              <th class="pb-2 pr-6">Vorauss. Ende</th>
              <th class="pb-2 pr-6">Zuschläge</th>
              <th class="pb-2">Kind-ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in contracts" :key="c.contractNumber" class="border-t border-gray-100 whitespace-nowrap">
              <td class="py-2 pr-6 font-mono text-gray-900">{{ c.contractNumber }}</td>
              <td class="py-2 pr-6 text-gray-600">{{ formatDate(c.startDate) }} – {{ formatDate(c.endDate) }}</td>
              <td class="py-2 pr-6 text-gray-600">
                {{ c.careScope ?? '–' }}<span v-if="c.withMeal" class="text-gray-400"> · mit Essen</span>
              </td>
              <td class="py-2 pr-6 text-gray-600">
                {{ formatDate(c.expectedEndDate) }}
                <span v-if="c.expectedEndReason" class="text-gray-400">({{ c.expectedEndReason }})</span>
              </td>
              <td class="py-2 pr-6 text-gray-600">
                <template v-if="c.surcharges === null">?</template>
                <template v-else-if="c.surcharges.length === 0">–</template>
                <template v-else>{{ c.surcharges.map((s) => s.type).join(', ') }}</template>
              </td>
              <td class="py-2 font-mono text-gray-400">{{ c.childId ?? '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="voucherError" class="mt-3 text-xs text-gray-500">
        Gutscheindaten (Zuschläge, Kind-ID) nicht verfügbar: {{ voucherError }}
      </p>
    </template>
    <p class="mt-3 text-xs text-gray-400">Live aus dem ISBJ-Trägerportal geladen, nicht gespeichert.</p>
  </div>
</template>
