import type { Member } from '~/types'

export type CareTypeKey = 'full_extended' | 'full' | 'part' | 'half_with_meal' | 'half_without_meal'

export const CARE_TYPE_OPTIONS: { key: CareTypeKey; label: string }[] = [
  { key: 'full_extended', label: 'Ganztags erweitert' },
  { key: 'full', label: 'Ganztags' },
  { key: 'part', label: 'Teilzeit' },
  { key: 'half_with_meal', label: 'Halbtags mit Essen' },
  { key: 'half_without_meal', label: 'Halbtags ohne Essen' },
]

type AgeGroup = '01' | '2' | '3plus'
// Rates indexed by time period: 0=Jan–Mar, 1=Apr–Jul, 2=Aug–Dec
type Rates = [number, number, number]

const BASE_RATES: Record<AgeGroup, Record<CareTypeKey, Rates>> = {
  '01': {
    full_extended: [2220.71, 2268.43, 2582.03],
    full: [2135.75, 2181.33, 2494.91],
    part: [1660.01, 1693.51, 1850.31],
    half_with_meal: [1280.54, 1304.42, 1379.92],
    half_without_meal: [1192.59, 1216.48, 1291.98],
  },
  '2': {
    full_extended: [1818.6, 1856.11, 2036.14],
    full: [1733.64, 1769.01, 1949.03],
    part: [1439.13, 1467.02, 1565.75],
    half_with_meal: [1167.27, 1188.27, 1246.35],
    half_without_meal: [1079.33, 1100.33, 1158.41],
  },
  '3plus': {
    full_extended: [1133.29, 1153.43, 1153.43],
    full: [1048.33, 1066.32, 1066.32],
    part: [935.06, 950.18, 950.18],
    half_with_meal: [827.44, 839.84, 839.84],
    half_without_meal: [739.5, 751.89, 751.89],
  },
}

// ndH (non-German family language) surcharge per qualifying child
const NDH_SURCHARGE_RATES: Rates = [101.35, 103.92, 103.92]
// ndH additional staff positions per qualifying child (same rate for both periods)
const NDH_STAFF_RATE = 0.017

// Staff ratio per child (FTE positions) — two periods: Jan–Jul, Aug–Dez
type StaffRates = [number, number]

const STAFF_RATES: Record<AgeGroup, Record<CareTypeKey, StaffRates>> = {
  '01': {
    full_extended: [0.316, 0.37],
    full: [0.301, 0.355],
    part: [0.217, 0.244],
    half_with_meal: [0.15, 0.163],
    half_without_meal: [0.15, 0.163],
  },
  '2': {
    full_extended: [0.245, 0.276],
    full: [0.23, 0.261],
    part: [0.178, 0.195],
    half_with_meal: [0.13, 0.14],
    half_without_meal: [0.13, 0.14],
  },
  '3plus': {
    full_extended: [0.124, 0.124],
    full: [0.109, 0.109],
    part: [0.089, 0.089],
    half_with_meal: [0.07, 0.07],
    half_without_meal: [0.07, 0.07],
  },
}

const LEADERSHIP_RATE = 0.0118
const HOURS_PER_POSITION = 39.4
const MEAL_ALLOWANCE = 23

export function getMealAllowance(): number {
  return MEAL_ALLOWANCE
}

function getTimePeriodIndex(month: number): number {
  if (month <= 3) return 0
  if (month <= 7) return 1
  return 2
}

// Contract year ends July 31 — contractEnd "2026" means active through month 7 of 2026
function isContractActive(contractEnd: string | null, year: number, month: number): boolean {
  if (!contractEnd) return true
  const endYear = Number.parseInt(contractEnd, 10)
  if (Number.isNaN(endYear)) return true
  if (endYear > year) return true
  if (endYear === year) return month <= 7
  return false
}

export function countContractActiveMembers(members: Member[], year: number, month: number): number {
  return members.filter(
    (m) => m.status === 'ACTIVE' && isContractActive(m.contractEnd, year, month),
  ).length
}

export function getAgeGroupBreakdown(
  members: Member[],
  year: number,
  month: number,
): { '01': number; '2': number; '3plus': number } {
  const counts = { '01': 0, '2': 0, '3plus': 0 }
  for (const m of members) {
    if (m.status !== 'ACTIVE' || !isContractActive(m.contractEnd, year, month)) continue
    counts[getAgeGroup(m.birthDate, year, month)]++
  }
  return counts
}

// Age group changes in the month AFTER the birthday (per KitaFöG calculation rules)
function getAgeGroup(birthDate: string, year: number, month: number): AgeGroup {
  const birth = new Date(birthDate)
  const birthYear = birth.getFullYear()
  const birthMonth = birth.getMonth() + 1
  const age = year - birthYear - (month <= birthMonth ? 1 : 0)
  if (age <= 1) return '01'
  if (age === 2) return '2'
  return '3plus'
}

export interface ReimbursementResult {
  baseTotal: number
  ndhSurchargeTotal: number
  total: number
  month: number
  year: number
  childCount: number
  ndhChildCount: number
  ndhQualifies: boolean
  unknownCareCount: number
}

export interface StaffingResult {
  positionsWithoutLeadership: number
  positionsWithLeadership: number
  careHours: number
  leadershipHours: number
  weeklyHours: number
  month: number
  year: number
}

export function calculateStaffing(members: Member[], year: number, month: number): StaffingResult {
  const activeMembers = members.filter(
    (m) => m.status === 'ACTIVE' && isContractActive(m.contractEnd, year, month),
  )
  const periodIndex = month <= 7 ? 0 : 1

  let positions = 0
  let childCount = 0
  let ndhChildCount = 0

  for (const m of activeMembers) {
    if (!m.careType) continue
    const ageGroup = getAgeGroup(m.birthDate, year, month)
    const rates = STAFF_RATES[ageGroup][m.careType as CareTypeKey]
    if (!rates) continue
    positions += rates[periodIndex]
    childCount++
    if (m.surcharges.includes('ndhs')) ndhChildCount++
  }

  // ndH staff positions apply when ndH children make up ≥ 40% of occupied places
  const ndhQualifies = childCount > 0 && ndhChildCount / childCount >= 0.4
  if (ndhQualifies) positions += ndhChildCount * NDH_STAFF_RATE

  const leadershipPositions = LEADERSHIP_RATE * childCount
  const positionsWithLeadership = positions + leadershipPositions

  return {
    positionsWithoutLeadership: positions,
    positionsWithLeadership,
    careHours: positions * HOURS_PER_POSITION,
    leadershipHours: leadershipPositions * HOURS_PER_POSITION,
    weeklyHours: positionsWithLeadership * HOURS_PER_POSITION,
    month,
    year,
  }
}

export interface AnnualReimbursementResult {
  total: number
  months: ReimbursementResult[]
  year: number
}

export function calculateAnnualReimbursement(
  members: Member[],
  year: number,
): AnnualReimbursementResult {
  const months = Array.from({ length: 12 }, (_, i) => calculateReimbursement(members, year, i + 1))
  return { total: months.reduce((sum, m) => sum + m.total, 0), months, year }
}

export interface AnnualStaffingResult {
  averagePositionsWithLeadership: number
  peakPositionsWithLeadership: number
  averageWeeklyHours: number
  peakWeeklyHours: number
  averageCareHours: number
  averageLeadershipHours: number
  months: StaffingResult[]
  year: number
}

export function calculateAnnualStaffing(members: Member[], year: number): AnnualStaffingResult {
  const months = Array.from({ length: 12 }, (_, i) => calculateStaffing(members, year, i + 1))
  const avgPositions = months.reduce((sum, m) => sum + m.positionsWithLeadership, 0) / 12
  const peakPositions = Math.max(...months.map((m) => m.positionsWithLeadership))
  const avgCareHours = months.reduce((sum, m) => sum + m.careHours, 0) / 12
  const avgLeadershipHours = months.reduce((sum, m) => sum + m.leadershipHours, 0) / 12
  return {
    averagePositionsWithLeadership: avgPositions,
    peakPositionsWithLeadership: peakPositions,
    averageWeeklyHours: avgPositions * HOURS_PER_POSITION,
    peakWeeklyHours: peakPositions * HOURS_PER_POSITION,
    averageCareHours: avgCareHours,
    averageLeadershipHours: avgLeadershipHours,
    months,
    year,
  }
}

export function calculateReimbursement(
  members: Member[],
  year: number,
  month: number,
): ReimbursementResult {
  const activeMembers = members.filter(
    (m) => m.status === 'ACTIVE' && isContractActive(m.contractEnd, year, month),
  )
  const periodIndex = getTimePeriodIndex(month)

  let baseTotal = 0
  let childCount = 0
  let ndhChildCount = 0
  let unknownCareCount = 0

  for (const m of activeMembers) {
    if (!m.careType) {
      unknownCareCount++
      continue
    }
    const ageGroup = getAgeGroup(m.birthDate, year, month)
    const rates = BASE_RATES[ageGroup][m.careType as CareTypeKey]
    if (!rates) {
      unknownCareCount++
      continue
    }
    baseTotal += rates[periodIndex]
    childCount++
    if (m.surcharges.includes('ndhs')) ndhChildCount++
  }

  // ndH surcharge applies only if ndH children make up at least 40% of occupied places
  const ndhQualifies = childCount > 0 && ndhChildCount / childCount >= 0.4
  const ndhSurchargeTotal = ndhQualifies ? ndhChildCount * NDH_SURCHARGE_RATES[periodIndex] : 0

  return {
    baseTotal,
    ndhSurchargeTotal,
    total: baseTotal + ndhSurchargeTotal,
    month,
    year,
    childCount,
    ndhChildCount,
    ndhQualifies,
    unknownCareCount,
  }
}
