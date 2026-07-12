<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useFinancialsStore } from '~/stores/financials'
import { useMembersStore } from '~/stores/members'
import type { ExpenseItem, IncomeItem, RecurrenceType } from '~/types'
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
const financialsStore = useFinancialsStore()

const { canManageClub } = storeToRefs(authStore)

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const qYear = computed(() => {
  const y = Number(route.query.year)
  return Number.isFinite(y) && y > 2000 ? y : null
})

const qMonth = computed(() => {
  const m = Number(route.query.month)
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null
})

const showAnnual = computed(() => qYear.value !== null && qMonth.value === null)
const displayYear = computed(() => qYear.value ?? currentYear)
const displayMonth = computed(() => qMonth.value ?? currentMonth)

const minYear = currentYear
const maxYear = currentYear + 1

const canGoPrev = computed(() => displayYear.value > minYear || displayMonth.value > 1)
const canGoNext = computed(() => displayYear.value < maxYear || displayMonth.value < 12)

const prevMonthQuery = computed(() => {
  const m = displayMonth.value === 1 ? 12 : displayMonth.value - 1
  const y = displayMonth.value === 1 ? displayYear.value - 1 : displayYear.value
  return { month: m, year: y }
})
const nextMonthQuery = computed(() => {
  const m = displayMonth.value === 12 ? 1 : displayMonth.value + 1
  const y = displayMonth.value === 12 ? displayYear.value + 1 : displayYear.value
  return { month: m, year: y }
})

// ── Financials (from store) ───────────────────────────────────────────────
const incomeItems = computed(
  () => financialsStore.getMonthly(displayYear.value, displayMonth.value)?.income ?? [],
)
const expenseItems = computed(
  () => financialsStore.getMonthly(displayYear.value, displayMonth.value)?.expenses ?? [],
)
const annualByMonth = computed(() => financialsStore.getAnnual(displayYear.value) ?? null)

// ── Edit mode ─────────────────────────────────────────────────────────────
const isEditing = ref(false)
const editTab = computed<'income' | 'expenses'>(() =>
  route.query.tab === 'expenses' ? 'expenses' : 'income',
)

const mfEditing = ref(false)
const mfInput = ref('')
const mfSaving = ref(false)
const mfError = ref<string | null>(null)

watch(
  () => route.query.edit,
  async (val) => {
    const entering = val === '1'
    if (!entering) {
      mfEditing.value = false
      mfError.value = null
    }
    isEditing.value = entering
    if (!entering && !annualByMonth.value) {
      await financialsStore.fetchAnnual(slug, displayYear.value)
    }
  },
  { immediate: true },
)

watch(
  [displayYear, displayMonth, showAnnual],
  async () => {
    if (!canManageClub.value) return
    if (showAnnual.value) {
      await financialsStore.fetchAnnual(slug, displayYear.value)
    } else {
      await Promise.all([
        financialsStore.fetchMonthly(slug, displayYear.value, displayMonth.value),
        financialsStore.fetchAnnual(slug, displayYear.value),
      ])
    }
  },
  { immediate: true },
)

const isLoadingData = computed(() => {
  if (!canManageClub.value) return false
  if (showAnnual.value) return annualByMonth.value === null
  return financialsStore.getMonthly(displayYear.value, displayMonth.value) === undefined
})

// ── Helpers ───────────────────────────────────────────────────────────────
function displayMonthDate(): string {
  return `${displayYear.value}-${String(displayMonth.value).padStart(2, '0')}-01`
}

function formatStartAt(startAt: string): string {
  const [y, m] = startAt.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
}

function isStartMonth(item: IncomeItem | ExpenseItem): boolean {
  return item.startAt === displayMonthDate()
}

// ── Membership fee (special income item) ─────────────────────────────────
const membershipFeeItem = computed(() => {
  const items = incomeItems.value.filter((i) => i.itemType === 'membership_fee')
  if (items.length === 0) return null
  return items.reduce((best, item) => (item.startAt > best.startAt ? item : best))
})
const membershipFeeAmount = computed(() => membershipFeeItem.value?.amount ?? 0)

function onStartEditMF() {
  mfInput.value = membershipFeeAmount.value ? String(membershipFeeAmount.value) : ''
  mfError.value = null
  mfEditing.value = true
}

function onCancelMF() {
  mfEditing.value = false
  mfError.value = null
}

async function onSaveMF() {
  mfError.value = null
  const raw = mfInput.value.trim().replace(',', '.')
  const value = Number(raw)
  if (raw === '' || Number.isNaN(value) || value < 0) {
    mfError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  mfSaving.value = true
  try {
    const existing = membershipFeeItem.value
    if (existing && !isStartMonth(existing)) {
      const { item } = await $fetch<{ item: IncomeItem }>(`/api/ini/${slug}/income`, {
        method: 'POST',
        body: {
          name: existing.name,
          amount: value,
          recurrenceType: 'recurring',
          startAt: displayMonthDate(),
          itemType: 'membership_fee',
        },
      })
      financialsStore.patchMonthlyIncome(displayYear.value, displayMonth.value, item)
      financialsStore.invalidateAnnual(displayYear.value)
    } else if (existing) {
      const { item } = await $fetch<{ item: IncomeItem }>(
        `/api/ini/${slug}/income/${existing.id}`,
        { method: 'PATCH', body: { amount: value } },
      )
      financialsStore.patchMonthlyIncome(displayYear.value, displayMonth.value, item)
      financialsStore.invalidateAnnual(displayYear.value)
    } else {
      const { item } = await $fetch<{ item: IncomeItem }>(`/api/ini/${slug}/income`, {
        method: 'POST',
        body: {
          name: 'Mitgliedsbeitrag',
          amount: value,
          recurrenceType: 'recurring',
          startAt: displayMonthDate(),
          itemType: 'membership_fee',
        },
      })
      financialsStore.patchMonthlyIncome(displayYear.value, displayMonth.value, item)
      financialsStore.invalidateAnnual(displayYear.value)
    }
    mfInput.value = ''
    mfEditing.value = false
  } catch {
    mfError.value = 'Fehler beim Speichern.'
  } finally {
    mfSaving.value = false
  }
}

async function onDeleteMF(item: IncomeItem) {
  if (!confirm(`Mitgliedsbeitrag ab ${formatStartAt(item.startAt)} löschen?`)) return
  await $fetch(`/api/ini/${slug}/income/${item.id}`, { method: 'DELETE' })
  financialsStore.invalidateAllMonths()
  await financialsStore.fetchMonthly(slug, displayYear.value, displayMonth.value)
}

// ── Extra income CRUD ─────────────────────────────────────────────────────
const extraIncomeItems = computed(() =>
  incomeItems.value.filter((i) => i.itemType !== 'membership_fee'),
)

const incomeEditId = ref<string | null>(null)
const incomeEditName = ref('')
const incomeEditAmount = ref('')
const incomeEditRecurrenceType = ref<RecurrenceType>('once')
const incomeEditStartAt = ref('')
const incomeEditEndAt = ref('')
const incomeSaving = ref(false)
const incomeError = ref<string | null>(null)

const newIncomeVisible = ref(false)
const newIncomeName = ref('')
const newIncomeAmount = ref('')
const newIncomeRecurrenceType = ref<RecurrenceType>('once')
const newIncomeStartAt = ref('')
const newIncomeEndAt = ref('')
const newIncomeAdding = ref(false)
const newIncomeError = ref<string | null>(null)

function onStartEditIncome(item: IncomeItem) {
  incomeEditId.value = item.id
  incomeEditName.value = item.name
  incomeEditAmount.value = String(item.amount)
  incomeEditRecurrenceType.value = item.recurrenceType
  incomeEditStartAt.value = isStartMonth(item)
    ? item.startAt.slice(0, 7)
    : displayMonthDate().slice(0, 7)
  incomeEditEndAt.value = item.endAt ? item.endAt.slice(0, 7) : ''
  incomeError.value = null
}
function onCancelEditIncome() {
  incomeEditId.value = null
  incomeError.value = null
}

async function onSaveEditIncome(item: IncomeItem) {
  const name = incomeEditName.value.trim()
  const amount = Number(incomeEditAmount.value.replace(',', '.'))
  if (!name) {
    incomeError.value = 'Bitte eine Bezeichnung eingeben.'
    return
  }
  if (!incomeEditAmount.value.trim() || Number.isNaN(amount) || amount < 0) {
    incomeError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  incomeSaving.value = true
  try {
    const isPeriod = incomeEditRecurrenceType.value === 'period'
    const startAt =
      isPeriod && incomeEditStartAt.value ? `${incomeEditStartAt.value}-01` : undefined
    const endAt = isPeriod && incomeEditEndAt.value ? `${incomeEditEndAt.value}-01` : null
    const { item: updated } = await $fetch<{ item: IncomeItem }>(
      `/api/ini/${slug}/income/${item.id}`,
      {
        method: 'PATCH',
        body: { name, amount, recurrenceType: incomeEditRecurrenceType.value, startAt, endAt },
      },
    )
    financialsStore.patchMonthlyIncome(displayYear.value, displayMonth.value, updated)
    financialsStore.invalidateAnnual(displayYear.value)
    if (incomeEditRecurrenceType.value !== 'once' || item.recurrenceType !== 'once') {
      financialsStore.invalidateOtherMonths(displayYear.value, displayMonth.value)
    }
    incomeEditId.value = null
  } catch {
    incomeError.value = 'Fehler beim Speichern.'
  } finally {
    incomeSaving.value = false
  }
}

async function onDeleteIncome(item: IncomeItem) {
  if (!confirm(`„${item.name}" löschen?`)) return
  await $fetch(`/api/ini/${slug}/income/${item.id}`, { method: 'DELETE' })
  if (item.recurrenceType !== 'once') {
    financialsStore.invalidateAllMonths()
    await financialsStore.fetchMonthly(slug, displayYear.value, displayMonth.value)
  } else {
    financialsStore.removeMonthlyIncome(displayYear.value, displayMonth.value, item.id)
    financialsStore.invalidateAnnual(displayYear.value)
  }
}

async function onAddIncome() {
  const name = newIncomeName.value.trim()
  const amount = Number(newIncomeAmount.value.replace(',', '.'))
  if (!name) {
    newIncomeError.value = 'Bitte eine Bezeichnung eingeben.'
    return
  }
  if (!newIncomeAmount.value.trim() || Number.isNaN(amount) || amount < 0) {
    newIncomeError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  newIncomeAdding.value = true
  try {
    const isPeriod = newIncomeRecurrenceType.value === 'period'
    const startAt =
      isPeriod && newIncomeStartAt.value ? `${newIncomeStartAt.value}-01` : displayMonthDate()
    const endAt = isPeriod && newIncomeEndAt.value ? `${newIncomeEndAt.value}-01` : null
    const { item } = await $fetch<{ item: IncomeItem }>(`/api/ini/${slug}/income`, {
      method: 'POST',
      body: {
        name,
        amount,
        recurrenceType: newIncomeRecurrenceType.value,
        startAt,
        endAt,
        itemType: null,
      },
    })
    financialsStore.patchMonthlyIncome(displayYear.value, displayMonth.value, item)
    financialsStore.invalidateAnnual(displayYear.value)
    if (newIncomeRecurrenceType.value !== 'once') {
      financialsStore.invalidateOtherMonths(displayYear.value, displayMonth.value)
    }
    newIncomeName.value = ''
    newIncomeAmount.value = ''
    newIncomeRecurrenceType.value = 'once'
    newIncomeStartAt.value = ''
    newIncomeEndAt.value = ''
    newIncomeVisible.value = false
  } catch {
    newIncomeError.value = 'Fehler beim Hinzufügen.'
  } finally {
    newIncomeAdding.value = false
  }
}

// ── Expenses CRUD ─────────────────────────────────────────────────────────
const expenseEditId = ref<string | null>(null)
const expenseEditName = ref('')
const expenseEditAmount = ref('')
const expenseEditRecurrenceType = ref<RecurrenceType>('once')
const expenseEditStartAt = ref('')
const expenseEditEndAt = ref('')
const expenseSaving = ref(false)
const expenseError = ref<string | null>(null)

const newExpenseVisible = ref(false)
const newExpenseName = ref('')
const newExpenseAmount = ref('')
const newExpenseRecurrenceType = ref<RecurrenceType>('once')
const newExpenseStartAt = ref('')
const newExpenseEndAt = ref('')
const newExpenseAdding = ref(false)
const newExpenseError = ref<string | null>(null)

function onStartEditExpense(item: ExpenseItem) {
  expenseEditId.value = item.id
  expenseEditName.value = item.name
  expenseEditAmount.value = String(item.amount)
  expenseEditRecurrenceType.value = item.recurrenceType
  expenseEditStartAt.value = isStartMonth(item)
    ? item.startAt.slice(0, 7)
    : displayMonthDate().slice(0, 7)
  expenseEditEndAt.value = item.endAt ? item.endAt.slice(0, 7) : ''
  expenseError.value = null
}
function onCancelEditExpense() {
  expenseEditId.value = null
  expenseError.value = null
}

async function onSaveEditExpense(item: ExpenseItem) {
  const name = expenseEditName.value.trim()
  const amount = Number(expenseEditAmount.value.replace(',', '.'))
  if (!name) {
    expenseError.value = 'Bitte eine Bezeichnung eingeben.'
    return
  }
  if (!expenseEditAmount.value.trim() || Number.isNaN(amount) || amount < 0) {
    expenseError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  expenseSaving.value = true
  try {
    const isPeriod = expenseEditRecurrenceType.value === 'period'
    const startAt =
      isPeriod && expenseEditStartAt.value ? `${expenseEditStartAt.value}-01` : undefined
    const endAt = isPeriod && expenseEditEndAt.value ? `${expenseEditEndAt.value}-01` : null
    const { item: updated } = await $fetch<{ item: ExpenseItem }>(
      `/api/ini/${slug}/expenses/${item.id}`,
      {
        method: 'PATCH',
        body: { name, amount, recurrenceType: expenseEditRecurrenceType.value, startAt, endAt },
      },
    )
    financialsStore.patchMonthlyExpense(displayYear.value, displayMonth.value, updated)
    financialsStore.invalidateAnnual(displayYear.value)
    if (expenseEditRecurrenceType.value !== 'once' || item.recurrenceType !== 'once') {
      financialsStore.invalidateOtherMonths(displayYear.value, displayMonth.value)
    }
    expenseEditId.value = null
  } catch {
    expenseError.value = 'Fehler beim Speichern.'
  } finally {
    expenseSaving.value = false
  }
}

async function onDeleteExpense(item: ExpenseItem) {
  if (!confirm(`„${item.name}" löschen?`)) return
  await $fetch(`/api/ini/${slug}/expenses/${item.id}`, { method: 'DELETE' })
  if (item.recurrenceType !== 'once') {
    financialsStore.invalidateAllMonths()
    await financialsStore.fetchMonthly(slug, displayYear.value, displayMonth.value)
  } else {
    financialsStore.removeMonthlyExpense(displayYear.value, displayMonth.value, item.id)
    financialsStore.invalidateAnnual(displayYear.value)
  }
}

async function onAddExpense() {
  const name = newExpenseName.value.trim()
  const amount = Number(newExpenseAmount.value.replace(',', '.'))
  if (!name) {
    newExpenseError.value = 'Bitte eine Bezeichnung eingeben.'
    return
  }
  if (!newExpenseAmount.value.trim() || Number.isNaN(amount) || amount < 0) {
    newExpenseError.value = 'Bitte einen gültigen Betrag eingeben.'
    return
  }
  newExpenseAdding.value = true
  try {
    const isPeriod = newExpenseRecurrenceType.value === 'period'
    const startAt =
      isPeriod && newExpenseStartAt.value ? `${newExpenseStartAt.value}-01` : displayMonthDate()
    const endAt = isPeriod && newExpenseEndAt.value ? `${newExpenseEndAt.value}-01` : null
    const { item } = await $fetch<{ item: ExpenseItem }>(`/api/ini/${slug}/expenses`, {
      method: 'POST',
      body: {
        name,
        amount,
        recurrenceType: newExpenseRecurrenceType.value,
        startAt,
        endAt,
      },
    })
    financialsStore.patchMonthlyExpense(displayYear.value, displayMonth.value, item)
    financialsStore.invalidateAnnual(displayYear.value)
    if (newExpenseRecurrenceType.value !== 'once') {
      financialsStore.invalidateOtherMonths(displayYear.value, displayMonth.value)
    }
    newExpenseName.value = ''
    newExpenseAmount.value = ''
    newExpenseRecurrenceType.value = 'once'
    newExpenseStartAt.value = ''
    newExpenseEndAt.value = ''
    newExpenseVisible.value = false
  } catch {
    newExpenseError.value = 'Fehler beim Hinzufügen.'
  } finally {
    newExpenseAdding.value = false
  }
}

// ── Rates ─────────────────────────────────────────────────────────────────
const RATE_PERIOD_COLORS = ['bg-blue-200', 'bg-emerald-200', 'bg-orange-200', 'bg-purple-200']

const currentRateSource = computed(() => {
  const date = new Date(displayYear.value, displayMonth.value - 1, 1)
  const r = getRatesForDate(date)
  const color = RATE_PERIOD_COLORS[getRateIndex(date) % RATE_PERIOD_COLORS.length]
  return { label: r.label, source: r.source, color }
})

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

// ── Reimbursement / staffing ──────────────────────────────────────────────
const reimbursement = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateReimbursement(membersStore.members, displayYear.value, displayMonth.value)
})

const staffing = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateStaffing(membersStore.members, displayYear.value, displayMonth.value)
})

const annualReimbursement = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateAnnualReimbursement(membersStore.members, displayYear.value)
})

const annualStaffing = computed(() => {
  if (!canManageClub.value || membersStore.isLoading) return null
  return calculateAnnualStaffing(membersStore.members, displayYear.value)
})

// ── Month totals ──────────────────────────────────────────────────────────
const activeCount = computed(() =>
  countContractActiveMembers(membersStore.members, displayYear.value, displayMonth.value),
)

const ageBreakdown = computed(() =>
  getAgeGroupBreakdown(membersStore.members, displayYear.value, displayMonth.value),
)

const monthlyMembershipFees = computed(() => activeCount.value * membershipFeeAmount.value)
const monthlyMealFees = computed(() => reimbursement.value?.mealTotal ?? 0)
const extraMonthlyIncome = computed(() =>
  extraIncomeItems.value.reduce((sum, i) => sum + i.amount, 0),
)
const monthlyExpensesTotal = computed(() =>
  expenseItems.value.reduce((sum, e) => sum + e.amount, 0),
)
const monthlyIncomeTotal = computed(() =>
  reimbursement.value
    ? reimbursement.value.total +
      monthlyMembershipFees.value +
      monthlyMealFees.value +
      extraMonthlyIncome.value
    : 0,
)
const monthlySaldo = computed(() => monthlyIncomeTotal.value - monthlyExpensesTotal.value)

// ── Annual totals ─────────────────────────────────────────────────────────
const annualMealFees = computed(
  () => annualReimbursement.value?.months.reduce((sum, m) => sum + m.mealTotal, 0) ?? 0,
)

const annualMembershipFees = computed(() => {
  if (!annualByMonth.value) return 0
  return annualByMonth.value.reduce((sum, fin, i) => {
    return (
      sum +
      fin.membershipFee * countContractActiveMembers(membersStore.members, displayYear.value, i + 1)
    )
  }, 0)
})

const annualExtraIncome = computed(
  () => annualByMonth.value?.reduce((sum, m) => sum + m.extraIncome, 0) ?? 0,
)

const annualExpensesTotal = computed(
  () => annualByMonth.value?.reduce((sum, m) => sum + m.expenses, 0) ?? 0,
)
const annualIncomeTotal = computed(() =>
  annualReimbursement.value
    ? annualReimbursement.value.total +
      annualMealFees.value +
      annualMembershipFees.value +
      annualExtraIncome.value
    : 0,
)
const annualSaldo = computed(() => annualIncomeTotal.value - annualExpensesTotal.value)

const annualMonthlySaldos = computed(() => {
  const reimbursement = annualReimbursement.value
  const byMonth = annualByMonth.value
  if (!reimbursement || !byMonth) return Array(12).fill(0) as number[]
  return reimbursement.months.map((m, i) => {
    const count = countContractActiveMembers(membersStore.members, displayYear.value, i + 1)
    const fin = byMonth[i]
    const income = m.total + m.mealTotal + fin.membershipFee * count + fin.extraIncome
    return income - fin.expenses
  })
})

const annualMonthlyIncome = computed(() => {
  if (!annualReimbursement.value || !annualByMonth.value) return Array(12).fill(0) as number[]
  return annualReimbursement.value.months.map((m, i) => {
    const count = countContractActiveMembers(membersStore.members, displayYear.value, i + 1)
    const fin = annualByMonth.value?.[i]
    if (!fin) return 0
    return m.total + m.mealTotal + fin.membershipFee * count + fin.extraIncome
  })
})

const annualChartMax = computed(() => {
  const incomes = annualMonthlyIncome.value
  const expenses = annualByMonth.value?.map((m) => m.expenses) ?? []
  return Math.max(...incomes, ...expenses, 1)
})

// ── Misc ──────────────────────────────────────────────────────────────────
const monthLabel = computed(() =>
  new Date(displayYear.value, displayMonth.value - 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  }),
)

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
  return value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
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
      <!-- View tabs -->
      <div class="mb-4 flex gap-1">
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="!qYear ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="router.replace({ query: {} })"
        >Aktueller Monat</button>
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="qYear === currentYear ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="router.replace({ query: { year: currentYear } })"
        >{{ currentYear }}</button>
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="qYear === currentYear + 1 ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'"
          @click="router.replace({ query: { year: currentYear + 1 } })"
        >{{ currentYear + 1 }}</button>
      </div>

      <LoadingBrumm v-if="isLoadingData" />

      <!-- ── Monatsansicht: Bearbeiten-Modus ────────────────────────────── -->
      <template v-else-if="!showAnnual && isEditing">
        <!-- Titel -->
        <MonthTitleCard
          :month-label="monthLabel"
          :prev-month-query="prevMonthQuery"
          :next-month-query="nextMonthQuery"
          :display-year="displayYear"
          :is-editing="true"
          :edit-tab="route.query.tab as string | undefined"
          :can-go-prev="canGoPrev"
          :can-go-next="canGoNext"
          @action="router.replace({ query: { ...route.query, edit: undefined } })"
        />

        <!-- Tab-Content -->
        <div class="card">
          <!-- Tabs -->
          <div class="mb-4 flex gap-1 border-b">
            <button
              type="button"
              class="px-3 py-2 text-sm font-medium transition-colors"
              :class="editTab === 'income' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'"
              @click="router.replace({ query: { ...route.query, tab: undefined } })"
            >Einnahmen</button>
            <button
              type="button"
              class="px-3 py-2 text-sm font-medium transition-colors"
              :class="editTab === 'expenses' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'"
              @click="router.replace({ query: { ...route.query, tab: 'expenses' } })"
            >Ausgaben</button>
          </div>

          <!-- Einnahmen Tab -->
          <template v-if="editTab === 'income'">
            <!-- Beteiligung -->
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Beteiligung</p>
            <div class="mb-6 rounded-lg bg-gray-50 p-4">
              <p class="mb-2 text-sm font-medium text-gray-700">Mitgliedsbeitrag</p>
              <template v-if="!mfEditing">
                <div class="flex items-center justify-between">
                  <div class="flex items-baseline gap-3">
                    <p class="font-mono text-2xl font-bold text-gray-900">
                      {{ membershipFeeAmount > 0 ? formatEur(membershipFeeAmount) : '–' }}
                    </p>
                    <p v-if="membershipFeeAmount > 0" class="text-sm text-gray-400">
                      <span class="font-mono whitespace-nowrap">{{ formatEur(membershipFeeAmount + getMealAllowance(displayYear, displayMonth)) }}<span class="pl-1">€</span></span> inkl. Essen
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" class="btn-secondary text-sm" @click="onStartEditMF">{{ !membershipFeeItem || isStartMonth(membershipFeeItem) ? 'Bearbeiten' : 'Anpassen' }}</button>
                    <button v-if="membershipFeeItem && isStartMonth(membershipFeeItem)" type="button" class="btn-secondary text-sm text-red-600 hover:text-red-700" @click="onDeleteMF(membershipFeeItem)">Löschen</button>
                  </div>
                </div>
                <p class="mt-2 text-xs text-gray-400">
                  Monatlicher Beitrag pro Kind<template v-if="membershipFeeItem && !isStartMonth(membershipFeeItem)"> · seit <NuxtLink :to="{ query: { year: Number(membershipFeeItem.startAt.slice(0, 4)), month: Number(membershipFeeItem.startAt.slice(5, 7)), edit: '1' } }" class="inline-flex items-center gap-0.5 text-blue-600 hover:underline">{{ formatStartAt(membershipFeeItem.startAt) }}<AppIcon name="pencil" class="size-3" /></NuxtLink></template>
                </p>
              </template>
              <template v-else>
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <input v-model="mfInput" type="text" inputmode="decimal" class="input pr-8" placeholder="" @keydown.enter="onSaveMF" />
                    <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
                  </div>
                  <button type="button" class="btn-primary shrink-0" :disabled="mfSaving" @click="onSaveMF">{{ mfSaving ? '…' : 'Speichern' }}</button>
                  <button type="button" class="btn-secondary shrink-0" :disabled="mfSaving" @click="onCancelMF">Abbrechen</button>
                </div>
                <p v-if="mfError" class="mt-1.5 text-xs text-red-600">{{ mfError }}</p>
              </template>
            </div>

            <!-- Weitere Einnahmen -->
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Weitere Einnahmen</p>
            <div v-if="extraIncomeItems.length > 0" class="mb-3 divide-y rounded-lg border">
              <div v-for="item in extraIncomeItems" :key="item.id">
                <div v-if="incomeEditId === item.id" class="flex flex-col gap-2 p-3">
                  <div class="flex gap-2">
                    <input v-model="incomeEditName" type="text" class="input flex-1 text-sm" placeholder="Bezeichnung" />
                    <div class="relative w-44">
                      <input v-model="incomeEditAmount" type="text" inputmode="decimal" class="input pr-8 text-sm" placeholder="0" />
                      <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <select v-model="incomeEditRecurrenceType" class="input w-64 shrink-0 text-xs">
                      <option value="once">Einmalig</option>
                      <option value="recurring">Monatlich</option>
                      <option value="period">Zeitraum</option>
                    </select>
                    <template v-if="incomeEditRecurrenceType === 'period'">
                      <input v-model="incomeEditStartAt" type="month" class="input text-xs" disabled />
                      <span class="text-xs text-gray-400">–</span>
                      <input v-model="incomeEditEndAt" type="month" class="input text-xs" />
                    </template>
                  </div>
                  <p v-if="incomeError" class="rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ incomeError }}</p>
                  <div class="flex gap-2">
                    <button type="button" class="btn-primary py-1 text-xs" :disabled="incomeSaving" @click="onSaveEditIncome(item)">{{ incomeSaving ? '…' : 'Speichern' }}</button>
                    <button type="button" class="btn-secondary py-1 text-xs" @click="onCancelEditIncome">Abbrechen</button>
                  </div>
                </div>
                <div v-else class="flex items-center gap-3 p-3">
                  <span class="flex-1 py-1 text-sm text-gray-900">
                    {{ item.name }}
                    <span v-if="item.recurrenceType === 'recurring'" class="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">monatlich</span>
                    <span v-else-if="item.recurrenceType === 'period'" class="ml-1.5 text-xs text-gray-400"><NuxtLink v-if="!isStartMonth(item)" :to="{ query: { year: Number(item.startAt.slice(0, 4)), month: Number(item.startAt.slice(5, 7)), edit: '1', tab: editTab } }" class="inline-flex items-center gap-0.5 text-blue-600 hover:underline">{{ formatStartAt(item.startAt) }}<AppIcon name="pencil" class="size-3" /></NuxtLink><template v-else>{{ formatStartAt(item.startAt) }}</template> – {{ item.endAt ? formatStartAt(item.endAt) : '…' }}</span>
                    <span v-if="item.recurrenceType === 'recurring' && !isStartMonth(item)" class="ml-1.5 text-xs text-gray-400">seit <NuxtLink :to="{ query: { year: Number(item.startAt.slice(0, 4)), month: Number(item.startAt.slice(5, 7)), edit: '1', tab: editTab } }" class="inline-flex items-center gap-0.5 text-blue-600 hover:underline">{{ formatStartAt(item.startAt) }}<AppIcon name="pencil" class="size-3" /></NuxtLink></span>
                  </span>
                  <span class="font-mono text-sm text-gray-700">{{ formatEur(item.amount) }} €</span>
                  <button v-if="isStartMonth(item)" type="button" class="btn-secondary py-1 text-xs" @click="onStartEditIncome(item)">Bearbeiten</button>
                  <button v-if="isStartMonth(item)" type="button" class="btn-secondary py-1 text-xs text-red-600" @click="onDeleteIncome(item)">Löschen</button>
                </div>
              </div>
            </div>
            <div v-if="newIncomeVisible" class="mb-3 flex flex-col gap-2 rounded-lg border p-3">
              <div class="flex gap-2">
                <input v-model="newIncomeName" type="text" class="input flex-1 text-sm" placeholder="Bezeichnung" @keydown.enter="onAddIncome" />
                <div class="relative w-44">
                  <input v-model="newIncomeAmount" type="text" inputmode="decimal" class="input pr-8 text-sm" placeholder="0" @keydown.enter="onAddIncome" />
                  <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <select v-model="newIncomeRecurrenceType" class="input w-64 text-xs">
                  <option value="once">Einmalig</option>
                  <option value="recurring">Monatlich</option>
                  <option value="period">Zeitraum</option>
                </select>
                <template v-if="newIncomeRecurrenceType === 'period'">
                  <input v-model="newIncomeStartAt" type="month" class="input text-xs" />
                  <span class="text-xs text-gray-400">–</span>
                  <input v-model="newIncomeEndAt" type="month" class="input text-xs" />
                </template>
              </div>
              <p v-if="newIncomeError" class="rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ newIncomeError }}</p>
              <div class="flex gap-2">
                <button type="button" class="btn-primary py-1 text-xs" :disabled="newIncomeAdding" @click="onAddIncome">{{ newIncomeAdding ? '…' : 'Hinzufügen' }}</button>
                <button type="button" class="btn-secondary py-1 text-xs" @click="newIncomeVisible = false; newIncomeError = null">Abbrechen</button>
              </div>
            </div>
            <button v-else type="button" class="btn-secondary text-sm" @click="newIncomeVisible = true; newIncomeStartAt = `${displayYear}-${String(displayMonth).padStart(2, '0')}`">+ Eintrag hinzufügen</button>
          </template>

          <!-- Ausgaben Tab -->
          <template v-else>
            <div v-if="expenseItems.length > 0" class="mb-3 divide-y rounded-lg border">
              <div v-for="item in expenseItems" :key="item.id">
                <div v-if="expenseEditId === item.id" class="flex flex-col gap-2 p-3">
                  <div class="flex gap-2">
                    <input v-model="expenseEditName" type="text" class="input flex-1 text-sm" placeholder="Bezeichnung" />
                    <div class="relative w-44">
                      <input v-model="expenseEditAmount" type="text" inputmode="decimal" class="input pr-8 text-sm" placeholder="0" />
                      <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <select v-model="expenseEditRecurrenceType" class="input w-64 shrink-0 text-xs">
                      <option value="once">Einmalig</option>
                      <option value="recurring">Monatlich</option>
                      <option value="period">Zeitraum</option>
                    </select>
                    <template v-if="expenseEditRecurrenceType === 'period'">
                      <input v-model="expenseEditStartAt" type="month" class="input text-xs" disabled />
                      <span class="text-xs text-gray-400">–</span>
                      <input v-model="expenseEditEndAt" type="month" class="input text-xs" />
                    </template>
                  </div>
                  <p v-if="expenseError" class="rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ expenseError }}</p>
                  <div class="flex gap-2">
                    <button type="button" class="btn-primary py-1 text-xs" :disabled="expenseSaving" @click="onSaveEditExpense(item)">{{ expenseSaving ? '…' : 'Speichern' }}</button>
                    <button type="button" class="btn-secondary py-1 text-xs" @click="onCancelEditExpense">Abbrechen</button>
                  </div>
                </div>
                <div v-else class="flex items-center gap-3 p-3">
                  <span class="flex-1 py-1 text-sm text-gray-900">
                    {{ item.name }}
                    <span v-if="item.recurrenceType === 'recurring'" class="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">monatlich</span>
                    <span v-else-if="item.recurrenceType === 'period'" class="ml-1.5 text-xs text-gray-400"><NuxtLink v-if="!isStartMonth(item)" :to="{ query: { year: Number(item.startAt.slice(0, 4)), month: Number(item.startAt.slice(5, 7)), edit: '1', tab: editTab } }" class="inline-flex items-center gap-0.5 text-blue-600 hover:underline">{{ formatStartAt(item.startAt) }}<AppIcon name="pencil" class="size-3" /></NuxtLink><template v-else>{{ formatStartAt(item.startAt) }}</template> – {{ item.endAt ? formatStartAt(item.endAt) : '…' }}</span>
                    <span v-if="item.recurrenceType === 'recurring' && !isStartMonth(item)" class="ml-1.5 text-xs text-gray-400">seit <NuxtLink :to="{ query: { year: Number(item.startAt.slice(0, 4)), month: Number(item.startAt.slice(5, 7)), edit: '1', tab: editTab } }" class="inline-flex items-center gap-0.5 text-blue-600 hover:underline">{{ formatStartAt(item.startAt) }}<AppIcon name="pencil" class="size-3" /></NuxtLink></span>
                  </span>
                  <span class="font-mono text-sm text-expense-700">{{ formatEur(item.amount) }} €</span>
                  <button v-if="isStartMonth(item)" type="button" class="btn-secondary py-1 text-xs" @click="onStartEditExpense(item)">Bearbeiten</button>
                  <button v-if="isStartMonth(item)" type="button" class="btn-secondary py-1 text-xs text-red-600" @click="onDeleteExpense(item)">Löschen</button>
                </div>
              </div>
            </div>
            <p v-else-if="!newExpenseVisible" class="mb-3 text-sm text-gray-400">Noch keine Ausgaben für diesen Monat.</p>
            <div v-if="newExpenseVisible" class="mb-3 flex flex-col gap-2 rounded-lg border p-3">
              <div class="flex gap-2">
                <input v-model="newExpenseName" type="text" class="input flex-1 text-sm" placeholder="Bezeichnung" @keydown.enter="onAddExpense" />
                <div class="relative w-44">
                  <input v-model="newExpenseAmount" type="text" inputmode="decimal" class="input pr-8 text-sm" placeholder="0" @keydown.enter="onAddExpense" />
                  <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <select v-model="newExpenseRecurrenceType" class="input w-64 text-xs">
                  <option value="once">Einmalig</option>
                  <option value="recurring">Monatlich</option>
                  <option value="period">Zeitraum</option>
                </select>
                <template v-if="newExpenseRecurrenceType === 'period'">
                  <input v-model="newExpenseStartAt" type="month" class="input text-xs" />
                  <span class="text-xs text-gray-400">–</span>
                  <input v-model="newExpenseEndAt" type="month" class="input text-xs" />
                </template>
              </div>
              <p v-if="newExpenseError" class="rounded bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ newExpenseError }}</p>
              <div class="flex gap-2">
                <button type="button" class="btn-primary py-1 text-xs" :disabled="newExpenseAdding" @click="onAddExpense">{{ newExpenseAdding ? '…' : 'Hinzufügen' }}</button>
                <button type="button" class="btn-secondary py-1 text-xs" @click="newExpenseVisible = false; newExpenseError = null">Abbrechen</button>
              </div>
            </div>
            <button v-else type="button" class="btn-secondary text-sm" @click="newExpenseVisible = true; newExpenseStartAt = `${displayYear}-${String(displayMonth).padStart(2, '0')}`">+ Eintrag hinzufügen</button>
          </template>
        </div>
      </template>

      <!-- ── Monatsansicht: Lese-Modus ──────────────────────────────────── -->
      <template v-else-if="!showAnnual && !isEditing">
        <!-- Monat Header (mit Chart) -->
        <CalculationsTitleCard
          v-if="annualReimbursement && annualByMonth"
          :title="monthLabel"
          :display-year="displayYear"
          :display-month="displayMonth"
          :annual-monthly-income="annualMonthlyIncome"
          :annual-by-month="annualByMonth"
          :annual-chart-max="annualChartMax"
          :annual-monthly-saldos="annualMonthlySaldos"
          :annual-rate-sources="annualRateSources"
          :members="membersStore.members"
        >
          <template #center>
            <NuxtLink :to="{ query: { year: displayYear } }" class="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <AppIcon name="calendar" class="size-3" />Jahresansicht
            </NuxtLink>
          </template>
          <template #action>
            <button type="button" class="btn-secondary text-xs" @click="router.replace({ query: { ...route.query, edit: '1' } })">Bearbeiten</button>
          </template>
          <div class="flex flex-wrap items-start gap-4 mobile:gap-6">
            <template v-if="reimbursement">
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
            </template>
            <div class="ml-auto text-right">
              <p class="text-sm text-gray-500">Saldo</p>
              <p class="mt-1 font-mono text-3xl font-bold" :class="monthlySaldo > 0 ? 'text-gray-900' : monthlySaldo < 0 ? 'text-expense-700' : 'text-gray-300'">{{ formatEur(monthlySaldo) }}<span class="pl-1">€</span></p>
            </div>
          </div>
        </CalculationsTitleCard>

        <!-- Einnahmen -->
        <div class="card min-h-[290px]">
          <div class="mb-4 flex items-start justify-between">
            <div>
              <h2 class="text-sm font-medium text-gray-900">Einnahmen</h2>
              <div class="mt-0.5 flex items-center gap-1.5">
                <div :class="[currentRateSource.color, 'h-2 w-4 flex-shrink-0 rounded-sm']" />
                <p class="text-xs text-gray-400">{{ currentRateSource.source }}</p>
              </div>
            </div>
            <NuxtLink :to="{ query: { ...route.query, edit: '1', tab: undefined } }" class="text-gray-400 hover:text-gray-600">
              <AppIcon name="pencil" class="h-4 w-4" />
            </NuxtLink>
          </div>
          <template v-if="reimbursement">
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
                  <span><span class="mr-1 text-gray-300">└</span>Mitgliedsbeitrag ({{ activeCount }} × {{ formatEur(membershipFeeAmount) }}&nbsp;€)</span>
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

              <!-- Weitere Einnahmen -->
              <div v-if="extraIncomeItems.length > 0" class="space-y-1 border-t pt-3">
                <p class="font-medium text-gray-700">Weitere Einnahmen</p>
                <div v-for="item in extraIncomeItems" :key="item.id" class="flex justify-between pl-3 text-xs text-gray-500">
                  <span><span class="mr-1 text-gray-300">└</span>{{ item.name }}<template v-if="item.recurrenceType === 'recurring'"> (monatlich)</template><template v-else-if="item.recurrenceType === 'period'"> ({{ formatStartAt(item.startAt) }} – {{ item.endAt ? formatStartAt(item.endAt) : '…' }})</template></span>
                  <span class="font-mono whitespace-nowrap text-gray-400">{{ formatEur(item.amount) }}<span class="pl-1">€</span></span>
                </div>
                <div class="flex justify-between text-gray-500">
                  <span>Gesamt</span>
                  <span class="font-mono whitespace-nowrap font-bold">{{ formatEur(extraMonthlyIncome) }}<span class="pl-1">€</span></span>
                </div>
              </div>

            </div>
            <p v-if="reimbursement.childCount === 0" class="mt-2 text-sm text-gray-500">
              Kein Kind mit Betreuungsumfang hinterlegt.
            </p>
            <div class="mt-4 flex items-center justify-between border-t pt-3 text-gray-700">
              <span class="font-medium">Gesamteinnahmen</span>
              <span class="font-mono whitespace-nowrap font-bold">{{ formatEur(monthlyIncomeTotal) }}<span class="pl-1">€</span></span>
            </div>
          </template>
        </div>

        <!-- Ausgaben -->
        <div v-if="expenseItems.length > 0" class="card mt-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-medium text-gray-900">Ausgaben</h2>
            <NuxtLink :to="{ query: { ...route.query, edit: '1', tab: 'expenses' } }" class="text-gray-400 hover:text-gray-600">
              <AppIcon name="pencil" class="h-4 w-4" />
            </NuxtLink>
          </div>
          <div class="space-y-1 text-sm">
            <div v-for="item in expenseItems" :key="item.id" class="flex justify-between text-gray-500">
              <span>
                {{ item.name }}
                <template v-if="item.recurrenceType === 'recurring'"> (monatlich)</template>
                <template v-else-if="item.recurrenceType === 'period'"> ({{ formatStartAt(item.startAt) }} – {{ item.endAt ? formatStartAt(item.endAt) : '…' }})</template>
              </span>
              <span class="font-mono whitespace-nowrap text-expense-700">{{ formatEur(item.amount) }}<span class="pl-1">€</span></span>
            </div>
            <div class="flex justify-between border-t pt-2 text-gray-700">
              <span class="font-medium">Gesamt</span>
              <span class="font-mono whitespace-nowrap font-bold text-expense-700">{{ formatEur(monthlyExpensesTotal) }}<span class="pl-1">€</span></span>
            </div>
          </div>
        </div>

        <!-- Personalschlüssel -->
        <div class="card mt-4 min-h-[190px]">
          <h2 class="mb-4 text-sm font-medium text-gray-900">Personalschlüssel</h2>
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

      <!-- ── Jahresansicht ───────────────────────────────────────────────── -->
      <template v-else-if="showAnnual">
        <!-- Jahres Header (mit Chart) -->
        <CalculationsTitleCard
          v-if="annualReimbursement && annualByMonth"
          :title="`Jahresansicht ${displayYear}`"
          :display-year="displayYear"
          :annual-monthly-income="annualMonthlyIncome"
          :annual-by-month="annualByMonth"
          :annual-chart-max="annualChartMax"
          :annual-monthly-saldos="annualMonthlySaldos"
          :annual-rate-sources="annualRateSources"
          :members="membersStore.members"
        >
          <div class="ml-auto text-right">
            <p class="text-sm text-gray-500">Saldo</p>
            <p class="mt-1 font-mono text-3xl font-bold" :class="annualSaldo > 0 ? 'text-gray-900' : annualSaldo < 0 ? 'text-expense-700' : 'text-gray-300'">{{ formatEur(annualSaldo) }}<span class="pl-1">€</span></p>
          </div>
          <template #footer>
            <div class="mt-3 space-y-1 border-t pt-3">
              <div class="flex items-baseline justify-between">
                <p class="text-sm text-gray-500">Einnahmen</p>
                <p class="font-mono text-sm font-bold text-gray-900">{{ formatEur(annualIncomeTotal) }}<span class="pl-1">€</span></p>
              </div>
              <div v-if="annualExpensesTotal > 0" class="flex items-baseline justify-between">
                <p class="text-sm text-gray-500">Ausgaben</p>
                <p class="font-mono text-sm font-bold text-expense-700">−{{ formatEur(annualExpensesTotal) }}<span class="pl-1">€</span></p>
              </div>
            </div>
          </template>
        </CalculationsTitleCard>

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
                <div
                  v-for="(m, i) in annualStaffing.months"
                  :key="i"
                  class="p-1 text-center"
                >
                  <p class="text-xs text-gray-400">{{ MONTH_LABELS[i] }}</p>
                  <p class="mt-0.5 text-xs font-medium text-gray-700">{{ m.careHours.toFixed(1) }}</p>
                  <p class="mt-0.5 text-xs text-gray-400">{{ m.leadershipHours.toFixed(1) }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

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
  grid-template-columns: repeat(12, minmax(4rem, 1fr));
}
</style>
