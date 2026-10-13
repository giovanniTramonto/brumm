import type { ISBJContract, ISBJSurcharge } from '~/types'
import { SURCHARGE_OPTIONS } from './config'
import { CARE_TYPE_OPTIONS, type CareTypeKey } from './reimbursement'

// Mapping between ISBJ contract data and Brumm member fields, shared by client and server.

// ISBJ sends betreuungsumfang as plain text ("Ganztags"), the developer guide shows enum style
// ("GANZTAGS") — normalizing to lowercase letters covers both. Unlisted values count as unknown.
const CARE_SCOPES: Record<string, 'half' | 'part' | 'full' | 'full_extended'> = {
  halbtags: 'half',
  teilzeit: 'part',
  ganztags: 'full',
  erweitert: 'full_extended',
  ganztagserweitert: 'full_extended',
}

// NDH is confirmed in production, QM is assumed; the integration codes are not known yet
const SURCHARGE_KEYS: Record<string, string> = {
  NDH: 'ndhs',
  QM: 'qm',
}
// Brumm surcharges that ISBJ data can confirm or overwrite; the others are left untouched
export const SYNCABLE_SURCHARGES = new Set(Object.values(SURCHARGE_KEYS))

export function mapIsbjCareType(
  careScope: string | null,
  withMeal: boolean | null,
): CareTypeKey | null {
  if (!careScope) return null
  const scope = CARE_SCOPES[careScope.toLowerCase().replace(/[^a-zäöüß]/g, '')]
  if (!scope) return null
  if (scope !== 'half') return scope
  if (withMeal === null) return null
  return withMeal ? 'half_with_meal' : 'half_without_meal'
}

// Request values for vertragRegistrieren. The guide only shows "HALBTAGS"; the other spellings
// still have to be verified against the ISBJ acceptance system.
export function mapCareTypeToIsbj(
  careType: string | null,
): { careScope: string; withMeal: boolean } | null {
  switch (careType) {
    case 'full_extended':
      return { careScope: 'ERWEITERT', withMeal: true }
    case 'full':
      return { careScope: 'GANZTAGS', withMeal: true }
    case 'part':
      return { careScope: 'TEILZEIT', withMeal: true }
    case 'half_with_meal':
      return { careScope: 'HALBTAGS', withMeal: true }
    case 'half_without_meal':
      return { careScope: 'HALBTAGS', withMeal: false }
    default:
      return null
  }
}

export function careTypeLabel(key: string | null): string {
  if (!key) return '–'
  return CARE_TYPE_OPTIONS.find((o) => o.key === key)?.label ?? key
}

export function surchargeLabel(key: string): string {
  return SURCHARGE_OPTIONS.find((o) => o.key === key)?.label ?? key
}

// today: "YYYY-MM-DD"
export function isSurchargeValidOn(s: ISBJSurcharge, today: string): boolean {
  return (!s.validFrom || s.validFrom <= today) && (!s.validTo || s.validTo >= today)
}

export function mapIsbjSurcharges(
  surcharges: ISBJSurcharge[],
  today: string,
): { keys: string[]; unknownTypes: string[] } {
  const keys = new Set<string>()
  const unknownTypes: string[] = []
  for (const s of surcharges.filter((s) => isSurchargeValidOn(s, today))) {
    const key = SURCHARGE_KEYS[s.type.toUpperCase()]
    if (key) keys.add(key)
    else unknownTypes.push(s.type)
  }
  return { keys: [...keys], unknownTypes }
}

export function isContractRunning(c: ISBJContract, today: string): boolean {
  return !!c.startDate && c.startDate <= today && (!c.endDate || c.endDate >= today)
}

// The contract that describes the child now: the running one, otherwise the next upcoming one.
// Ended contracts of the same voucher say nothing about the current data.
export function selectCurrentContract(
  contracts: ISBJContract[],
  today: string,
): ISBJContract | null {
  const running = contracts.find((c) => isContractRunning(c, today))
  if (running) return running
  const upcoming = contracts
    .filter((c) => c.startDate && c.startDate > today)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  return upcoming[0] ?? null
}

export interface IsbjSyncPatch {
  careType?: CareTypeKey
  surcharges?: string[]
}

// What "ISBJ Aktualisieren" would write into Brumm; empty when Brumm already matches ISBJ.
// Unknown ISBJ values are skipped, Brumm surcharges ISBJ cannot confirm (integration) are kept.
export function getIsbjSyncPatch(
  contract: ISBJContract,
  member: { careType: string | null; surcharges: string[] | null },
  today: string,
): IsbjSyncPatch {
  const patch: IsbjSyncPatch = {}

  const careType = mapIsbjCareType(contract.careScope, contract.withMeal)
  if (careType && careType !== member.careType) patch.careType = careType

  if (contract.surcharges !== null) {
    const current = member.surcharges ?? []
    const { keys } = mapIsbjSurcharges(contract.surcharges, today)
    const next = [...current.filter((k) => !SYNCABLE_SURCHARGES.has(k)), ...keys]
    const isSame = next.length === current.length && next.every((k) => current.includes(k))
    if (!isSame) patch.surcharges = next
  }

  return patch
}

// "YYYY-MM-DD" → "DD.MM.YYYY"
export function formatIsbjDate(date: string | null): string {
  if (!date) return '–'
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}
