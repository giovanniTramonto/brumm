<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import { getRateIndex, getRatesForDate } from '~/utils/rates'
import {
  calculateAnnualReimbursement,
  calculateAnnualStaffing,
  calculateReimbursement,
  calculateStaffing,
  countContractActiveMembers,
  getAgeGroupBreakdown,
  getMealAllowance,
} from '~/utils/reimbursement'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const { canManageClub } = storeToRefs(authStore)

type View = 'month' | 'year' | 'next-year'
const VALID_VIEWS: View[] = ['month', 'year', 'next-year']
const initialView = VALID_VIEWS.includes(route.query.view as View)
  ? (route.query.view as View)
  : 'month'
const view = ref<View>(initialView)

watch(view, (v) => router.replace({ query: { ...route.query, view: v } }))
const showAnnual = computed(() => view.value === 'year' || view.value === 'next-year')
const displayYear = computed(() => (view.value === 'next-year' ? currentYear + 1 : currentYear))

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const currentRateSource = computed(() => {
  const date = new Date(currentYear, currentMonth - 1, 1)
  const r = getRatesForDate(date)
  const color = RATE_PERIOD_COLORS[getRateIndex(date) % RATE_PERIOD_COLORS.length]
  return { label: r.label, source: r.source, color }
})

const RATE_PERIOD_COLORS = ['bg-blue-200', 'bg-emerald-200', 'bg-orange-200', 'bg-purple-200']

const annualRateSources = computed(() => {
  const ratesets = Array.from({ length: 12 }, (_, i) =>
    getRatesForDate(new Date(displayYear.value, i, 1)),
  )
  const perMonth = ratesets.map(
    (_, i) =>
      RATE_PERIOD_COLORS[
        getRateIndex(new Date(displayYear.value, i, 1)) % RATE_PERIOD_COLORS.length
      ],
  )
  const uniqueLabels = [...new Set(ratesets.map((r) => r.label))]

  const periods: {
    startCol: number
    span: number
    label: string
    source: string
    color: string
  }[] = []
  let i = 0
  while (i < 12) {
    const color = perMonth[i]
    let span = 1
    while (i + span < 12 && perMonth[i + span] === color) span++
    periods.push({
      startCol: i + 1,
      span,
      label: ratesets[i].label,
      source: ratesets[i].source,
      color,
    })
    i += span
  }

  return { perMonth, periods }
})

const reimbursement = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateReimbursement(membersStore.members, currentYear, currentMonth)
})

const staffing = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateStaffing(membersStore.members, currentYear, currentMonth)
})

const annualReimbursement = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateAnnualReimbursement(membersStore.members, displayYear.value)
})

const annualStaffing = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateAnnualStaffing(membersStore.members, displayYear.value)
})

const monthLabel = computed(() => {
  if (!reimbursement.value) return ''
  return new Date(currentYear, currentMonth - 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })
})

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

function formatEur(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const activeCount = computed(() =>
  countContractActiveMembers(membersStore.members, currentYear, currentMonth),
)

const ageBreakdown = computed(() =>
  getAgeGroupBreakdown(membersStore.members, currentYear, currentMonth),
)

const monthlyMembershipFees = computed(
  () => activeCount.value * (authStore.currentClub?.membershipFee ?? 0),
)

const monthlyMealFees = computed(() => reimbursement.value?.mealTotal ?? 0)

const annualMembershipFees = computed(() => {
  const fee = authStore.currentClub?.membershipFee ?? 0
  if (fee === 0) return 0
  return Array.from(
    { length: 12 },
    (_, i) => countContractActiveMembers(membersStore.members, displayYear.value, i + 1) * fee,
  ).reduce((sum, v) => sum + v, 0)
})

const annualMealFees = computed(
  () => annualReimbursement.value?.months.reduce((sum, m) => sum + m.mealTotal, 0) ?? 0,
)

const membershipFeeInput = ref<string>(
  authStore.currentClub?.membershipFee != null ? String(authStore.currentClub.membershipFee) : '',
)
const membershipFeeEditing = ref(false)
const membershipFeeSaving = ref(false)
const membershipFeeError = ref<string | null>(null)

function onEditMembershipFee() {
  membershipFeeInput.value =
    authStore.currentClub?.membershipFee != null ? String(authStore.currentClub.membershipFee) : ''
  membershipFeeError.value = null
  membershipFeeEditing.value = true
}

function onCancelMembershipFee() {
  membershipFeeEditing.value = false
  membershipFeeError.value = null
}

async function onSaveMembershipFee() {
  membershipFeeError.value = null
  const raw = membershipFeeInput.value.trim().replace(',', '.')
  const value = raw === '' ? null : Number(raw)
  if (raw !== '' && (Number.isNaN(value) || (value ?? 0) < 0)) {
    membershipFeeError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  membershipFeeSaving.value = true
  try {
    await $fetch(`/api/ini/${slug}/settings/membership-fee`, {
      method: 'PATCH',
      body: { membershipFee: value },
    })
    if (authStore.currentClub) authStore.currentClub.membershipFee = value
    membershipFeeEditing.value = false
  } catch {
    membershipFeeError.value = 'Fehler beim Speichern.'
  } finally {
    membershipFeeSaving.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Berechnung</h1>
    </div>

    <div v-if="!canManageClub" class="rounded-md bg-red-50 p-4 text-sm text-red-700">
      Keine Berechtigung.
    </div>

    <template v-else>
      <div class="mb-4 flex gap-1">
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="view === 'month' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="view = 'month'"
        >Aktueller Monat</button>
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="view === 'year' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="view = 'year'"
        >{{ currentYear }}</button>
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="view === 'next-year' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="view = 'next-year'"
        >{{ currentYear + 1 }}</button>
      </div>

      <!-- Monatsansicht -->
      <template v-if="!showAnnual">
        <div class="card min-h-[290px]">
            <div class="mb-4">
              <h2 class="text-sm font-medium text-gray-900">Einnahmen – {{ monthLabel }}</h2>
              <div class="mt-0.5 flex items-center gap-1.5">
                <div :class="[currentRateSource.color, 'h-2 w-4 flex-shrink-0 rounded-sm']" />
                <p class="text-xs text-gray-400">{{ currentRateSource.source }}</p>
              </div>
            </div>
            <template v-if="reimbursement">
              <div class="mb-4 flex flex-wrap gap-4 mobile:gap-6">
                <div>
                  <p class="text-sm text-gray-500">Aktive Kinder</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-900">{{ activeCount }}</p>
                </div>
                <div class="hidden mobile:block">
                  <p class="text-sm text-gray-500">0–1 J.</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-300">{{ ageBreakdown['01'] }}</p>
                </div>
                <div class="hidden mobile:block">
                  <p class="text-sm text-gray-500">2 J.</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-300">{{ ageBreakdown['2'] }}</p>
                </div>
                <div class="hidden mobile:block">
                  <p class="text-sm text-gray-500">3+ J.</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-300">{{ ageBreakdown['3plus'] }}</p>
                </div>
              </div>
              <div v-if="reimbursement.baseTotal > 0 || monthlyMembershipFees > 0" class="space-y-3 border-t pt-3 text-sm text-gray-600">

                <!-- Erstattungen -->
                <div class="space-y-1">
                  <p class="font-medium text-gray-700">Erstattungen</p>
                  <div class="flex justify-between pl-3 text-gray-500">
                    <span><span class="mr-1 text-gray-300">└</span>Grunderstattung (Land Berlin)</span>
                    <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.baseTotal) }}<span class="pl-1">€</span></span>
                  </div>
                  <template v-if="reimbursement.surchargeTotal > 0 || reimbursement.ndhChildCount > 0">
                    <div class="flex justify-between pl-3 text-gray-500">
                      <span><span class="mr-1 text-gray-300">└</span>Zuschläge</span>
                      <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.surchargeTotal) }}<span class="pl-1">€</span></span>
                    </div>
                    <div v-if="reimbursement.ndhSurchargeTotal > 0" class="flex justify-between pl-6 text-xs text-gray-500">
                      <span><span class="mr-1 text-gray-300">└</span>ndH ({{ reimbursement.ndhChildCount }} {{ reimbursement.ndhChildCount === 1 ? 'Kind' : 'Kinder' }})</span>
                      <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.ndhSurchargeTotal) }}<span class="pl-1">€</span></span>
                    </div>
                    <div v-else-if="reimbursement.ndhChildCount > 0" class="pl-6 text-xs text-gray-400">
                      <span class="mr-1 text-gray-300">└</span>ndH nicht angerechnet (unter 40 % Schwellenwert)
                    </div>
                    <div v-if="reimbursement.qmSurchargeTotal > 0" class="flex justify-between pl-6 text-xs text-gray-500">
                      <span><span class="mr-1 text-gray-300">└</span>QM/MSS ({{ reimbursement.qmChildCount }} {{ reimbursement.qmChildCount === 1 ? 'Kind' : 'Kinder' }})</span>
                      <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.qmSurchargeTotal) }}<span class="pl-1">€</span></span>
                    </div>
                    <div v-if="reimbursement.integrationASurchargeTotal > 0" class="flex justify-between pl-6 text-xs text-gray-500">
                      <span><span class="mr-1 text-gray-300">└</span>Integration Typ A ({{ reimbursement.integrationAChildCount }} {{ reimbursement.integrationAChildCount === 1 ? 'Kind' : 'Kinder' }})</span>
                      <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.integrationASurchargeTotal) }}<span class="pl-1">€</span></span>
                    </div>
                    <div v-if="reimbursement.integrationBSurchargeTotal > 0" class="flex justify-between pl-6 text-xs text-gray-500">
                      <span><span class="mr-1 text-gray-300">└</span>Integration Typ B ({{ reimbursement.integrationBChildCount }} {{ reimbursement.integrationBChildCount === 1 ? 'Kind' : 'Kinder' }})</span>
                      <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(reimbursement.integrationBSurchargeTotal) }}<span class="pl-1">€</span></span>
                    </div>
                  </template>
                  <div class="flex justify-between text-gray-500">
                    <span>Gesamt</span>
                    <span class="font-mono whitespace-nowrap font-bold">{{ formatEur(reimbursement.total) }}<span class="pl-1">€</span></span>
                  </div>
                </div>

                <!-- Beteiligung -->
                <div v-if="monthlyMembershipFees > 0 || monthlyMealFees > 0" class="space-y-1 border-t pt-3">
                  <p class="font-medium text-gray-700">Beteiligung</p>
                  <div v-if="monthlyMembershipFees > 0" class="flex justify-between pl-3 text-xs text-gray-500">
                    <span><span class="mr-1 text-gray-300">└</span>Mitgliedsbeitrag</span>
                    <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(monthlyMembershipFees) }}<span class="pl-1">€</span></span>
                  </div>
                  <div v-if="monthlyMealFees > 0" class="flex justify-between pl-3 text-xs text-gray-500">
                    <span><span class="mr-1 text-gray-300">└</span>23&nbsp;€ Beteiligung an Verpflegung ({{ reimbursement.childCount }} {{ reimbursement.childCount === 1 ? 'Kind' : 'Kinder' }})</span>
                    <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(monthlyMealFees) }}<span class="pl-1">€</span></span>
                  </div>
                  <div class="flex justify-between text-gray-500">
                    <span>Gesamt</span>
                    <span class="font-mono whitespace-nowrap font-bold">{{ formatEur(monthlyMembershipFees + monthlyMealFees) }}<span class="pl-1">€</span></span>
                  </div>
                </div>

              </div>
              <p v-if="reimbursement.childCount === 0" class="mt-2 text-sm text-gray-500">
                Kein Kind mit Betreuungsumfang hinterlegt.
              </p>
              <div class="mt-4 flex items-end justify-between border-t pt-3">
                <p class="text-sm text-gray-500">Gesamteinnahmen</p>
                <p class="font-mono text-3xl font-bold text-gray-900">{{ formatEur(reimbursement.total + monthlyMembershipFees + monthlyMealFees) }}<span class="pl-1">€</span></p>
              </div>
            </template>
          </div>

        <div class="card mt-4 min-h-[190px]">
          <h2 class="mb-4 text-sm font-medium text-gray-900">Personalschlüssel – {{ monthLabel }}</h2>
          <template v-if="staffing">
            <div class="flex flex-wrap items-end justify-between gap-y-2">
              <div class="flex flex-wrap gap-4 mobile:gap-6">
                <div class="hidden mobile:block">
                  <p class="text-sm text-gray-500">Betreuungsstunden</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-900">{{ staffing.careHours.toFixed(1) }}</p>
                </div>
                <div class="hidden mobile:block">
                  <p class="text-sm text-gray-500">Leitungsstunden</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-900">{{ staffing.leadershipHours.toFixed(1) }}</p>
                </div>
                <div class="hidden border-l pl-6 tablet:block">
                  <p class="text-sm text-gray-500">Min. Fachstunden</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-300">{{ (staffing.weeklyHours * 2 / 3).toFixed(1) }}</p>
                </div>
                <div class="hidden tablet:block">
                  <p class="text-sm text-gray-500">Max. Quereinsteigerstd.</p>
                  <p class="mt-1 font-mono text-3xl font-bold text-gray-300">{{ (staffing.weeklyHours / 3).toFixed(1) }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500">Gesamtstunden</p>
                <p class="mt-1 font-mono text-3xl font-bold text-gray-900">{{ staffing.weeklyHours.toFixed(1) }}</p>
              </div>
            </div>
            <div class="mt-4 border-t pt-3 text-xs text-gray-400">
              <span class="font-mono whitespace-nowrap">{{ staffing.positionsWithLeadership.toFixed(2) }}</span> Stellen mit Leitung gesamt
            </div>
          </template>
        </div>
      </template>

      <!-- Jahresansicht -->
      <template v-else>
        <div class="card min-h-[195px]">
          <template v-if="annualReimbursement">
            <div class="mb-4 flex items-baseline justify-between">
              <h2 class="text-sm font-medium text-gray-900">Einnahmen {{ annualReimbursement.year }}</h2>
              <p class="font-mono text-2xl font-bold text-gray-900">{{ formatEur(annualReimbursement.total + annualMembershipFees + annualMealFees) }}<span class="pl-1">€</span></p>
            </div>
            <div class="overflow-x-auto">
            <div class="annual-grid grid grid-cols-12 gap-1 border-t pt-3">
              <div v-for="(m, i) in annualReimbursement.months" :key="i" class="text-center">
                <p class="text-xs text-gray-400">{{ MONTH_LABELS[i] }}</p>
                <p class="mt-0.5 text-xs font-medium text-gray-700">{{ formatEur(m.total + m.mealTotal + countContractActiveMembers(membersStore.members, displayYear, i + 1) * (authStore.currentClub?.membershipFee ?? 0)) }}<span class="pl-1">€</span></p>
                <p class="mt-0.5 text-xs text-gray-400">{{ countContractActiveMembers(membersStore.members, displayYear, i + 1) }}</p>
                <div :class="[annualRateSources.perMonth[i], 'mt-1.5 h-1 rounded-full']" />
              </div>
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
          </template>
        </div>

        <div class="card mt-4 min-h-[235px]">
          <template v-if="annualStaffing">
            <h2 class="mb-4 text-sm font-medium text-gray-900">Personalschlüssel {{ annualStaffing.year }}</h2>
            <div class="flex items-end justify-between">
              <div>
                <p class="text-sm text-gray-500">Ø Betreuungsstunden</p>
                <p class="mt-1 font-mono text-2xl font-bold text-gray-900">{{ annualStaffing.averageCareHours.toFixed(1) }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500">Ø Leitungsstunden</p>
                <p class="mt-1 font-mono text-2xl font-bold text-gray-900">{{ annualStaffing.averageLeadershipHours.toFixed(1) }}</p>
              </div>
            </div>
            <div class="mt-4 overflow-x-auto">
            <div class="annual-grid grid grid-cols-12 gap-1 border-t pt-3">
              <div v-for="(m, i) in annualStaffing.months" :key="i" class="text-center">
                <p class="text-xs text-gray-400">{{ MONTH_LABELS[i] }}</p>
                <p class="mt-0.5 text-xs font-medium text-gray-700">{{ m.careHours.toFixed(1) }}</p>
                <p class="mt-0.5 text-xs text-gray-400">{{ m.leadershipHours.toFixed(1) }}</p>
                <div :class="[annualRateSources.perMonth[i], 'mt-1.5 h-1 rounded-full']" />
              </div>
            </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Mitgliedsbeitrag -->
      <div class="mt-4 grid grid-cols-1 gap-4 desktop:grid-cols-3">
        <div class="card">
          <h2 class="mb-3 text-sm font-medium text-gray-900">Mitgliedsbeitrag</h2>
          <template v-if="!membershipFeeEditing">
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <p class="font-mono text-2xl font-bold text-gray-900">
                  {{ authStore.currentClub?.membershipFee != null ? formatEur(authStore.currentClub.membershipFee) : '–' }}
                </p>
                <p v-if="authStore.currentClub?.membershipFee != null" class="text-sm text-gray-400">
                  <span class="font-mono whitespace-nowrap">{{ formatEur(authStore.currentClub.membershipFee + getMealAllowance(currentYear, currentMonth)) }}<span class="pl-1">€</span></span> inkl. Essen
                </p>
              </div>
              <button class="btn-secondary text-sm" @click="onEditMembershipFee">Ändern</button>
            </div>
            <p class="mt-2 text-xs text-gray-400">Monatlicher Beitrag</p>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  v-model="membershipFeeInput"
                  type="text"
                  inputmode="decimal"
                  class="input pr-8"
                  placeholder="0"
                  @keydown.enter="onSaveMembershipFee"
                />
                <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
              <button class="btn-primary shrink-0" :disabled="membershipFeeSaving" @click="onSaveMembershipFee">
                {{ membershipFeeSaving ? '…' : 'Speichern' }}
              </button>
              <button class="btn-secondary shrink-0" :disabled="membershipFeeSaving" @click="onCancelMembershipFee">
                Abbrechen
              </button>
            </div>
            <p v-if="membershipFeeError" class="mt-1.5 text-xs text-red-600">{{ membershipFeeError }}</p>
          </template>
        </div>
      </div>

      <!-- Quellenhinweise -->
      <FootnoteCard>
        <p class="mb-2 text-xs font-medium">Hinweise zur Berechnung</p>
        <ul class="list-disc space-y-1 pl-4 text-xs">
          <li>Einnahmezahlen auf volle Euro gerundet</li>
          <li>Sätze gemäß jeweiligem RV Tag (siehe Periodenmarkierung in der Jahresansicht)</li>
          <li>Die Grunderstattung enthält die Zahlung für Praxisunterstützungssystem (3,75 €/Kind/Monat)</li>
          <li>Kalkulation nach Roland Kern, DaKS e.V. (Stand 27.3.26)</li>
        </ul>
      </FootnoteCard>
    </template>
  </div>
</template>

<style scoped>
.annual-grid {
  min-width: 540px;
}
</style>
