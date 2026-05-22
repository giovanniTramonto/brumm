<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
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
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

onMounted(async () => {
  await membersStore.fetchMembers(slug)
})

const canView = computed(() => {
  const role = authStore.currentUser?.role
  return role === 'SUPERUSER' || role === 'MANAGER'
})

const showAnnual = ref(false)

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const reimbursement = computed(() => {
  if (!canView.value || membersStore.isLoading) return null
  return calculateReimbursement(membersStore.members, currentYear, currentMonth)
})

const staffing = computed(() => {
  if (!canView.value || membersStore.isLoading) return null
  return calculateStaffing(membersStore.members, currentYear, currentMonth)
})

const annualReimbursement = computed(() => {
  if (!canView.value || membersStore.isLoading) return null
  return calculateAnnualReimbursement(membersStore.members, currentYear)
})

const annualStaffing = computed(() => {
  if (!canView.value || membersStore.isLoading) return null
  return calculateAnnualStaffing(membersStore.members, currentYear)
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
    style: 'currency',
    currency: 'EUR',
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

const annualMembershipFees = computed(() => {
  const fee = authStore.currentClub?.membershipFee ?? 0
  if (fee === 0) return 0
  return Array.from(
    { length: 12 },
    (_, i) => countContractActiveMembers(membersStore.members, currentYear, i + 1) * fee,
  ).reduce((sum, v) => sum + v, 0)
})

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
      <h1 class="text-2xl font-bold text-gray-900">Rechnung</h1>
    </div>

    <div v-if="!canView" class="rounded-md bg-red-50 p-4 text-sm text-red-700">
      Keine Berechtigung.
    </div>

    <template v-else>
      <div class="mb-4 flex gap-1">
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="!showAnnual ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="showAnnual = false"
        >Aktueller Monat</button>
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="showAnnual ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="showAnnual = true"
        >Gesamtes Jahr</button>
      </div>

      <!-- Monatsansicht -->
      <template v-if="!showAnnual">
        <div class="card min-h-[245px]">
            <h2 class="mb-4 text-sm font-medium text-gray-900">Einnahmen – {{ monthLabel }}</h2>
            <template v-if="reimbursement">
              <div class="flex items-end justify-between">
                <div class="flex gap-6">
                  <div>
                    <p class="text-sm text-gray-500">Aktive Kinder</p>
                    <p class="mt-1 text-3xl font-bold text-gray-900">{{ activeCount }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">0–1 J.</p>
                    <p class="mt-1 text-3xl font-bold text-gray-300">{{ ageBreakdown['01'] }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">2 J.</p>
                    <p class="mt-1 text-3xl font-bold text-gray-300">{{ ageBreakdown['2'] }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">3+ J.</p>
                    <p class="mt-1 text-3xl font-bold text-gray-300">{{ ageBreakdown['3plus'] }}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-500">Gesamteinnahmen</p>
                  <p class="mt-1 text-3xl font-bold text-gray-900">{{ formatEur(reimbursement.total + monthlyMembershipFees) }}</p>
                </div>
              </div>
              <div v-if="reimbursement.baseTotal > 0 || monthlyMembershipFees > 0" class="mt-4 space-y-1 border-t pt-3 text-sm text-gray-600">
                <div class="flex justify-between">
                  <span>Grunderstattung</span>
                  <span>{{ formatEur(reimbursement.baseTotal) }}</span>
                </div>
                <div v-if="reimbursement.ndhSurchargeTotal > 0" class="flex justify-between">
                  <span>ndH-Zuschlag ({{ reimbursement.ndhChildCount }} Kinder)</span>
                  <span>{{ formatEur(reimbursement.ndhSurchargeTotal) }}</span>
                </div>
                <div v-else-if="reimbursement.ndhChildCount > 0" class="text-xs text-gray-400">
                  ndH-Zuschlag nicht angerechnet (unter 40 % Schwellenwert)
                </div>
                <div v-if="monthlyMembershipFees > 0" class="flex justify-between">
                  <span>Mitgliedsbeiträge</span>
                  <span>{{ formatEur(monthlyMembershipFees) }}</span>
                </div>
              </div>
              <p v-if="reimbursement.childCount === 0" class="mt-2 text-sm text-gray-500">
                Kein Kind mit Betreuungsumfang hinterlegt.
              </p>
            </template>
          </div>

        <div class="card mt-4 min-h-[145px]">
          <h2 class="mb-4 text-sm font-medium text-gray-900">Personalschlüssel – {{ monthLabel }}</h2>
          <template v-if="staffing">
            <div class="flex items-end justify-between">
              <div class="flex gap-6">
                <div>
                  <p class="text-sm text-gray-500">Betreuungsstunden</p>
                  <p class="mt-1 text-3xl font-bold text-gray-900">{{ staffing.careHours.toFixed(1) }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Min. Fachstunden</p>
                  <p class="mt-1 text-3xl font-bold text-gray-300">{{ (staffing.careHours * 2 / 3).toFixed(1) }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Max. Quereinsteigerstd.</p>
                  <p class="mt-1 text-3xl font-bold text-gray-300">{{ (staffing.careHours / 3).toFixed(1) }}</p>
                </div>
                <div class="border-l pl-6">
                  <p class="text-sm text-gray-500">Vorstandsstunden</p>
                  <p class="mt-1 text-3xl font-bold text-gray-900">{{ staffing.leadershipHours.toFixed(1) }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500">Gesamt</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ staffing.weeklyHours.toFixed(1) }}</p>
              </div>
            </div>
            <div class="mt-4 border-t pt-3 text-xs text-gray-400">
              {{ staffing.positionsWithLeadership.toFixed(2) }} Stellen gesamt
            </div>
          </template>
        </div>
      </template>

      <!-- Jahresansicht -->
      <template v-else>
        <div class="card min-h-[120px]">
          <template v-if="annualReimbursement">
            <div class="mb-4 flex items-baseline justify-between">
              <h2 class="text-sm font-medium text-gray-900">Einnahmen {{ annualReimbursement.year }}</h2>
              <p class="text-2xl font-bold text-gray-900">{{ formatEur(annualReimbursement.total + annualMembershipFees) }}</p>
            </div>
            <div class="grid grid-cols-12 gap-1 border-t pt-3">
              <div v-for="(m, i) in annualReimbursement.months" :key="i" class="text-center">
                <p class="text-xs text-gray-400">{{ MONTH_LABELS[i] }}</p>
                <p class="mt-0.5 text-xs font-medium text-gray-700">{{ formatEur(m.total + countContractActiveMembers(membersStore.members, currentYear, i + 1) * (authStore.currentClub?.membershipFee ?? 0)) }}</p>
                <p class="mt-0.5 text-xs text-gray-400">{{ countContractActiveMembers(membersStore.members, currentYear, i + 1) }}</p>
              </div>
            </div>
          </template>
        </div>

        <div class="card mt-4 min-h-[120px]">
          <template v-if="annualStaffing">
            <h2 class="mb-4 text-sm font-medium text-gray-900">Personalschlüssel {{ annualStaffing.year }}</h2>
            <div class="flex items-end justify-between">
              <div>
                <p class="text-sm text-gray-500">Ø Betreuungsstunden</p>
                <p class="mt-1 text-2xl font-bold text-gray-900">{{ annualStaffing.averageCareHours.toFixed(1) }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500">Ø Vorstandsstunden</p>
                <p class="mt-1 text-2xl font-bold text-gray-900">{{ annualStaffing.averageLeadershipHours.toFixed(1) }}</p>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-12 gap-1 border-t pt-3">
              <div v-for="(m, i) in annualStaffing.months" :key="i" class="text-center">
                <p class="text-xs text-gray-400">{{ MONTH_LABELS[i] }}</p>
                <p class="mt-0.5 text-xs font-medium text-gray-700">{{ m.careHours.toFixed(1) }}</p>
                <p class="mt-0.5 text-xs text-gray-400">{{ m.leadershipHours.toFixed(1) }}</p>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Mitgliedsbeitrag -->
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="card">
          <h2 class="mb-3 text-sm font-medium text-gray-900">Mitgliedsbeitrag</h2>
          <template v-if="!membershipFeeEditing">
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <p class="text-2xl font-bold text-gray-900">
                  {{ authStore.currentClub?.membershipFee != null ? formatEur(authStore.currentClub.membershipFee) : '–' }}
                </p>
                <p v-if="authStore.currentClub?.membershipFee != null" class="text-sm text-gray-400">
                  {{ formatEur(authStore.currentClub.membershipFee + getMealAllowance()) }} inkl. Essen
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
      <div class="mt-8 border-t border-ini-300 pt-4">
        <p class="mb-2 text-xs font-medium text-ini-800">Hinweise zur Berechnung</p>
        <ul class="list-disc space-y-1 pl-4 text-xs text-ini-800">
          <li>Einnahmezahlen auf volle Euro gerundet</li>
          <li>Inkl. gesetzliche Elternbeteiligung an Verpflegungskosten ({{ getMealAllowance() }} €)</li>
          <li>Inkl. Krippenschlüsselverbesserung (2 Stufen im Januar und August 2026) nach KitaFöG</li>
          <li>Unter Berücksichtigung von Sachkostensteigerungen im Januar und August 2026 (nach Verbraucherpreisindex und gesonderter Aufholung) nach RV Tag</li>
          <li>Unter Berücksichtigung des Tarifabschlusses im TV-L</li>
          <li>Inkl. Zahlung für Praxisunterstützungssystem (3,75 €/Kind/Monat)</li>
        </ul>
        <p class="mt-2 text-xs text-ini-700">Quelle: Roland Kern, DaKS e.V. (Stand 27.3.26)</p>
      </div>
    </template>
  </div>
</template>
