<script setup lang="ts">
import type { Member, MemberISBJResponse, MemberISBJSyncResponse } from '~/types'
import {
  careTypeLabel,
  formatIsbjDate,
  getIsbjSyncPatch,
  isContractRunning,
  mapCareTypeToIsbj,
  mapIsbjCareType,
  mapIsbjSurcharges,
  selectCurrentContract,
  surchargeLabel,
} from '~/utils/isbjMatching'

// ISBJ part of the "Gutschein" section (only when ISBJ is configured): key facts of the current
// ISBJ contract, the stored Brumm fields (default slot, read-only) next to the ISBJ values,
// "ISBJ Aktualisieren" to copy ISBJ → Brumm, and a read-only preview of what "ISBJ Anmelden" would send.
const props = defineProps<{
  slug: string
  member: Member
  isbj: MemberISBJResponse
  isLocked: boolean
}>()

const emit = defineEmits<{ synced: [result: MemberISBJSyncResponse] }>()

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })

const contract = computed(() => selectCurrentContract(props.isbj.contracts, today))
const hasEndedContracts = computed(() =>
  props.isbj.contracts.some((c) => c.endDate && c.endDate < today),
)

const isbjCareType = computed(() =>
  contract.value ? mapIsbjCareType(contract.value.careScope, contract.value.withMeal) : null,
)
const isbjSurcharges = computed(() =>
  contract.value?.surcharges ? mapIsbjSurcharges(contract.value.surcharges, today) : null,
)

const syncPatch = computed(() =>
  contract.value ? getIsbjSyncPatch(contract.value, props.member, today) : {},
)
const hasDifferences = computed(() => !!syncPatch.value.careType || !!syncPatch.value.surcharges)

const isSyncing = ref(false)
const syncError = ref<string | null>(null)

async function onSync() {
  if (!confirm('Betreuungsumfang und Zuschläge aus ISBJ in Brumm übernehmen?')) return
  isSyncing.value = true
  syncError.value = null
  try {
    const result = await $fetch<MemberISBJSyncResponse>(
      `/api/ini/${props.slug}/members/${props.member.id}/isbj/sync`,
      { method: 'POST', body: { lastEditedAt: props.member.lastEditedAt } },
    )
    emit('synced', result)
  } catch (err) {
    syncError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Übernahme aus ISBJ fehlgeschlagen.'
  } finally {
    isSyncing.value = false
  }
}

// --- "ISBJ Anmelden" preview (nothing is sent yet) ---
const isPreviewOpen = ref(false)

function lastDayOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const day = new Date(year as number, m as number, 0).getDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

// Brumm keeps contract start/end per month: start = 1st, end = last day (legacy year = July 31)
const registration = computed(() => {
  const m = props.member
  const contractEnd =
    m.contractEnd && /^\d{4}$/.test(m.contractEnd) ? `${m.contractEnd}-07` : m.contractEnd
  const care = mapCareTypeToIsbj(m.careType)
  return [
    { label: 'Gutscheinnummer', value: props.isbj.voucherNumber },
    { label: 'Nachname', value: m.lastName || null },
    { label: 'Vorname', value: m.firstName || null },
    { label: 'Geburtsdatum', value: m.birthDate ? formatIsbjDate(m.birthDate.slice(0, 10)) : null },
    {
      label: 'Vertragsabschluss',
      value: m.contractSignedOn ? formatIsbjDate(m.contractSignedOn) : null,
    },
    {
      label: 'Vertragsbeginn',
      value: m.contractStart ? formatIsbjDate(`${m.contractStart}-01`) : null,
    },
    {
      label: 'Vertragsende',
      value: contractEnd ? formatIsbjDate(lastDayOfMonth(contractEnd)) : null,
    },
    { label: 'Betreuungsumfang', value: care ? careTypeLabel(m.careType) : null },
    { label: 'Mit Essen', value: care ? (care.withMeal ? 'ja' : 'nein') : null },
    { label: 'Einrichtungsnummer', value: props.isbj.facilityNumber },
  ]
})
const missingCount = computed(() => registration.value.filter((f) => !f.value).length)
</script>

<template>
  <div class="space-y-4">
    <p v-if="isbj.error" role="alert" class="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
      ISBJ-Daten konnten nicht geladen werden: {{ isbj.error }}
    </p>

    <p v-else-if="!isbj.voucherNumber" class="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-500">
      Gutscheinnummer eintragen und speichern, um den Vertrag aus ISBJ zu laden.
    </p>

    <!-- Key facts of the voucher and its current contract -->
    <template v-else>
      <dl
        v-if="isbj.voucher || contract"
        class="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-gray-50 p-3 text-sm tablet:grid-cols-[8rem_1fr]"
      >
        <template v-if="isbj.voucher">
          <dt class="text-gray-500">Gutschein</dt>
          <dd class="text-gray-900">
            gültig {{ formatIsbjDate(isbj.voucher.validFrom) }} – {{ formatIsbjDate(isbj.voucher.validTo) }}
            <span
              v-if="isbj.voucher.isRedeemable === false"
              class="ml-1 inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700"
            >nicht einlösbar</span>
          </dd>
        </template>
        <template v-if="contract">
          <dt class="text-gray-500">Vertrag</dt>
          <dd class="text-gray-900">
            <span class="font-mono">{{ contract.contractNumber }}</span>
            · {{ formatIsbjDate(contract.startDate) }} – {{ formatIsbjDate(contract.endDate) }}
            <span
              class="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-xs"
              :class="isContractRunning(contract, today) ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'"
            >{{ isContractRunning(contract, today) ? 'läuft' : 'künftig' }}</span>
          </dd>
          <template v-if="contract.expectedEndDate">
            <dt class="text-gray-500">Vorauss. Ende</dt>
            <dd class="text-gray-900">
              {{ formatIsbjDate(contract.expectedEndDate) }}
              <span v-if="contract.expectedEndReason" class="text-gray-400">({{ contract.expectedEndReason }})</span>
            </dd>
          </template>
        </template>
      </dl>

      <p v-if="!contract" class="rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
        In ISBJ gibt es für diesen Gutschein noch keinen laufenden oder künftigen Vertrag<template v-if="hasEndedContracts"> (nur bereits beendete)</template>.
      </p>
    </template>

    <!-- Brumm (stored values, passed in as slot) next to ISBJ -->
    <div class="grid gap-6" :class="contract && 'tablet:grid-cols-2'">
      <div class="space-y-4">
        <p v-if="contract" class="text-xs font-medium uppercase tracking-wide text-gray-500">In Brumm</p>
        <slot />
      </div>

      <div v-if="contract" class="space-y-4">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">In ISBJ</p>
        <div>
          <p class="label">Betreuungsumfang</p>
          <p class="mt-1 py-1.5 text-sm" :class="syncPatch.careType ? 'font-medium text-orange-700' : 'text-gray-900'">
            {{ isbjCareType ? careTypeLabel(isbjCareType) : (contract.careScope ?? '–') }}
            <span v-if="!isbjCareType && contract.careScope" class="text-xs font-normal text-gray-400">(unbekannter ISBJ-Wert)</span>
          </p>
        </div>
        <div>
          <p class="label">Zuschläge</p>
          <p v-if="!isbjSurcharges" class="mt-1 text-sm text-gray-500">nicht verfügbar</p>
          <p
            v-else-if="isbjSurcharges.keys.length === 0 && isbjSurcharges.unknownTypes.length === 0"
            class="mt-1 text-sm"
            :class="syncPatch.surcharges ? 'font-medium text-orange-700' : 'text-gray-900'"
          >keine</p>
          <div v-else class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="key in isbjSurcharges.keys"
              :key="key"
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="syncPatch.surcharges ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'"
            >{{ surchargeLabel(key) }}</span>
            <span
              v-for="type in isbjSurcharges.unknownTypes"
              :key="type"
              class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400"
              :title="`Unbekannter ISBJ-Zuschlag ${type} – wird nicht übernommen`"
            >{{ type }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="isbj.voucherNumber && !isbj.error" class="flex flex-wrap items-center gap-3 border-t pt-4">
      <button
        v-if="contract"
        type="button"
        class="btn-secondary text-sm"
        :disabled="!hasDifferences || isSyncing || isLocked"
        @click="onSync"
      >
        {{ isSyncing ? 'Wird übernommen…' : 'ISBJ Aktualisieren' }}
      </button>
      <button
        v-else
        type="button"
        class="btn-secondary text-sm"
        :aria-expanded="isPreviewOpen"
        aria-controls="isbj-registration-preview"
        @click="isPreviewOpen = !isPreviewOpen"
      >
        ISBJ Anmelden
      </button>
      <span v-if="contract && hasDifferences" class="text-xs text-orange-700">
        Brumm weicht von ISBJ ab – „ISBJ Aktualisieren“ übernimmt die ISBJ-Werte.
      </span>
      <span v-else-if="contract" class="text-xs text-gray-500">Brumm stimmt mit ISBJ überein.</span>
    </div>
    <p v-if="syncError" role="alert" class="text-xs text-red-600">{{ syncError }}</p>

    <div
      v-if="isPreviewOpen && !contract"
      id="isbj-registration-preview"
      class="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4"
    >
      <p class="text-sm font-medium text-gray-900">Vorschau: Vertrag in ISBJ anmelden</p>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm tablet:grid-cols-[10rem_1fr]">
        <template v-for="field in registration" :key="field.label">
          <dt class="text-gray-500">{{ field.label }}</dt>
          <dd>
            <span v-if="field.value" class="text-gray-900">{{ field.value }}</span>
            <span v-else class="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">fehlt</span>
          </dd>
        </template>
      </dl>
      <p v-if="missingCount > 0" class="text-xs text-orange-700">
        {{ missingCount }} {{ missingCount === 1 ? 'Angabe fehlt' : 'Angaben fehlen' }} noch.
      </p>
      <p class="text-xs text-gray-500">
        Gespeicherte Werte. Beginn und Ende sind monatsgenau hinterlegt (1. bzw. Monatsletzter). Das Senden an ISBJ ist noch nicht freigeschaltet.
      </p>
    </div>
  </div>
</template>
