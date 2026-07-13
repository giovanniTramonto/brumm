<script setup lang="ts">
import type { AnnualFinancialsByMonth, Member } from '~/types'
import { countContractActiveMembers } from '~/utils/reimbursement'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mrz',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
]

type RatePeriod = { startCol: number; span: number; label: string; source: string; color: string }

const props = defineProps<{
  title: string
  titleSuffix?: string
  displayYear: number
  displayMonth?: number
  annualMonthlyIncome: number[]
  annualByMonth: AnnualFinancialsByMonth[]
  annualChartMax: number
  annualMonthlySaldos: number[]
  annualRateSources: { perMonth: string[]; periods: RatePeriod[] }
  members: Member[]
}>()

const scrollContainer = ref<HTMLElement | null>(null)

function scrollToMonth() {
  const container = scrollContainer.value
  if (props.displayMonth == null || !container) return
  const col = container.querySelector<HTMLElement>(`[data-month-index="${props.displayMonth - 1}"]`)
  col?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' })
}

onMounted(scrollToMonth)
watch(() => props.displayMonth, scrollToMonth)

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div class="card mb-4">
    <!-- Header + Stats (slot) -->
    <div class="flex min-h-[115px] flex-col gap-4">
      <div class="relative flex min-h-[32px] items-start justify-between">
        <h2 class="text-lg font-semibold text-gray-900">{{ title }}<span v-if="titleSuffix" class="ml-1 font-normal text-gray-400">{{ titleSuffix }}</span></h2>
        <slot name="center" />
        <slot name="action" />
      </div>
      <slot />
    </div>

    <!-- Chart + Monatsgrid (ein gemeinsamer Scroll-Container) -->
    <div ref="scrollContainer" class="mt-4 overflow-x-auto overflow-y-hidden border-t pb-2 pt-3">
      <div class="month-grid grid grid-cols-12 gap-1">
        <NuxtLink
          v-for="(_, i) in annualByMonth"
          :key="i"
          :data-month-index="i"
          :to="{ query: { year: displayYear, month: i + 1 } }"
          class="group relative flex flex-col items-center gap-1 rounded border border-transparent p-0.5 hover:border-primary-200 hover:bg-primary-50"
          :class="displayMonth === i + 1 ? 'border-primary-200 bg-primary-50' : ''"
        >
          <div class="relative h-10 w-full overflow-hidden rounded-sm">
            <div
              class="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all"
              :class="displayMonth === i + 1 ? 'bg-gray-600 opacity-80' : 'bg-gray-400 opacity-50'"
              :style="`height: ${(Math.max(0, annualMonthlyIncome[i]) / annualChartMax) * 100}%`"
            />
            <div
              class="absolute bottom-0 left-0 right-0 rounded-t-sm transition-opacity"
              :class="displayMonth === i + 1 ? 'opacity-0' : 'opacity-50'"
              :style="`height: ${((annualByMonth[i]?.expenses ?? 0) / annualChartMax) * 100}%; background: repeating-linear-gradient(-45deg, #6b7280 0, #6b7280 2px, transparent 0, transparent 50%) 0 / 5px 5px`"
            />
            <div
              class="absolute bottom-0 left-0 right-0 rounded-t-sm transition-opacity"
              :class="displayMonth === i + 1 ? 'opacity-80' : 'opacity-0'"
              :style="`height: ${((annualByMonth[i]?.expenses ?? 0) / annualChartMax) * 100}%; background: repeating-linear-gradient(-45deg, #ef4444 0, #ef4444 2px, transparent 0, transparent 50%) 0 / 5px 5px`"
            />
          </div>
          <span
            class="text-[10px] leading-none"
            :class="displayMonth === i + 1 ? 'font-semibold text-gray-700' : 'text-gray-400'"
          >{{ MONTH_LABELS[i] }}</span>
          <p class="text-xs font-medium" :class="annualMonthlySaldos[i] > 0 ? 'text-gray-700' : annualMonthlySaldos[i] < 0 ? 'text-expense-700' : 'text-gray-300'">{{ formatEur(annualMonthlySaldos[i]) }}<span class="pl-0.5 text-[10px]">€</span></p>
          <p class="text-xs text-gray-400">{{ countContractActiveMembers(members, displayYear, i + 1) }}</p>
          <div :class="[annualRateSources.perMonth[i], 'mt-0.5 h-1 w-full rounded-full']" />
        </NuxtLink>
        <div
          v-for="period in annualRateSources.periods"
          :key="period.startCol"
          :style="`grid-column: ${period.startCol} / span ${period.span}`"
          class="mt-0.5 flex items-center gap-1.5 overflow-hidden"
          :title="period.source"
        >
          <div :class="[period.color, 'h-2 w-4 flex-shrink-0 rounded-sm']" />
          <span class="truncate text-xs text-gray-400">{{ period.label }}</span>
        </div>
      </div>
    </div>

    <!-- Footer (z.B. Jahres-Einnahmen/Ausgaben) -->
    <slot name="footer" />
  </div>
</template>

<style scoped>
.month-grid {
  grid-template-columns: repeat(12, minmax(5rem, 1fr));
}
</style>
