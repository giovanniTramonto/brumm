import type { Member } from '~/types'
import type { AgeGroup, CareTypeKey } from './rates'
import { getRatesForDate } from './rates'

export type { CareTypeKey }

export const CARE_TYPE_OPTIONS: { key: CareTypeKey; label: string }[] = [
  { key: 'full_extended', label: 'Ganztags erweitert' },
  { key: 'full', label: 'Ganztags' },
  { key: 'part', label: 'Teilzeit' },
  { key: 'half_with_meal', label: 'Halbtags mit Essen' },
  { key: 'half_without_meal', label: 'Halbtags ohne Essen' },
]

// Contract year ends July 31 — contractEnd "2026" means active through month 7 of 2026
function isContractActive(contractEnd: string | null, year: number, month: number): boolean {
  if (!contractEnd) return true
  const endYear = Number.parseInt(contractEnd, 10)
  if (Number.isNaN(endYear)) return true
  if (endYear > year) return true
  if (endYear === year) return month <= 7
  return false
}

// contractStart "2026-09" means the contract begins in September 2026
export function isContractStarted(
  contractStart: string | null,
  year: number,
  month: number,
): boolean {
  if (!contractStart) return true
  const [startYear, startMonth] = contractStart.split('-').map(Number)
  if (Number.isNaN(startYear) || Number.isNaN(startMonth)) return true
  return year > startYear || (year === startYear && month >= startMonth)
}

function isContractInPeriod(
  member: { contractEnd: string | null; contractStart: string | null },
  year: number,
  month: number,
): boolean {
  return (
    isContractActive(member.contractEnd, year, month) &&
    isContractStarted(member.contractStart, year, month)
  )
}

function isOnOrAfterMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return year > y || (year === y && month >= m)
}

function isOnOrBeforeMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return year < y || (year === y && month <= m)
}

// A member only counts for months within their actual active window:
// from the month they were activated (activatedAt) through the month they
// were deregistered (deactivatedAt, inclusive) — a deregistered (DEACTIVATED)
// child still counts for past months up to and including the one they left
// in, so past calculations stay unchanged. INACTIVE stays excluded always —
// it's a deliberate simulation toggle. Members activated before this field
// existed have activatedAt = null, so no lower bound applies to them.
function wasActiveInPeriod(
  member: { status: string; activatedAt: string | null; deactivatedAt: string | null },
  year: number,
  month: number,
): boolean {
  if (member.status !== 'ACTIVE' && member.status !== 'DEACTIVATED') return false
  if (member.activatedAt && !isOnOrAfterMonth(member.activatedAt, year, month)) return false
  if (member.status === 'ACTIVE') return true
  return !!member.deactivatedAt && isOnOrBeforeMonth(member.deactivatedAt, year, month)
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

export function getMealAllowance(year: number, month: number): number {
  return getRatesForDate(new Date(year, month - 1, 1)).mealAllowance
}

export function countContractActiveMembers(members: Member[], year: number, month: number): number {
  return members.filter(
    (m) => wasActiveInPeriod(m, year, month) && isContractInPeriod(m, year, month),
  ).length
}

export function getAgeGroupBreakdown(
  members: Member[],
  year: number,
  month: number,
): { '01': number; '2': number; '3plus': number } {
  const counts = { '01': 0, '2': 0, '3plus': 0 }
  for (const m of members) {
    if (!wasActiveInPeriod(m, year, month) || !isContractInPeriod(m, year, month)) continue
    counts[getAgeGroup(m.birthDate, year, month)]++
  }
  return counts
}

export interface ReimbursementResult {
  baseTotal: number
  mealTotal: number
  ndhSurchargeTotal: number
  qmSurchargeTotal: number
  integrationASurchargeTotal: number
  integrationBSurchargeTotal: number
  surchargeTotal: number
  total: number
  month: number
  year: number
  childCount: number
  ndhChildCount: number
  qmChildCount: number
  integrationAChildCount: number
  integrationBChildCount: number
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
  const rates = getRatesForDate(new Date(year, month - 1, 1))
  const activeMembers = members.filter(
    (m) => wasActiveInPeriod(m, year, month) && isContractInPeriod(m, year, month),
  )

  let positions = 0
  let childCount = 0
  let ndhChildCount = 0
  let integrationACount = 0
  let integrationBCount = 0
  let qmCount = 0

  for (const m of activeMembers) {
    if (!m.careType) continue
    const ageGroup = getAgeGroup(m.birthDate, year, month)
    const staffRate = rates.staff[ageGroup][m.careType as CareTypeKey]
    if (!staffRate) continue
    positions += staffRate
    childCount++
    if (m.surcharges.includes('ndhs')) ndhChildCount++
    if (m.surcharges.includes('integration_a')) integrationACount++
    if (m.surcharges.includes('integration_b')) integrationBCount++
    if (m.surcharges.includes('qm')) qmCount++
  }

  const ndhQualifies =
    childCount > 0 && ndhChildCount / childCount >= (rates.surcharges.ndh.threshold ?? 0)
  if (ndhQualifies) positions += ndhChildCount * rates.surcharges.ndh.staffRate
  positions += integrationACount * rates.surcharges.integration_a.staffRate
  positions += integrationBCount * rates.surcharges.integration_b.staffRate
  positions += qmCount * rates.surcharges.qm.staffRate

  const leadershipPositions = rates.leadershipRate * childCount
  const positionsWithLeadership = positions + leadershipPositions

  return {
    positionsWithoutLeadership: positions,
    positionsWithLeadership,
    careHours: positions * rates.hoursPerPosition,
    leadershipHours: leadershipPositions * rates.hoursPerPosition,
    weeklyHours: positionsWithLeadership * rates.hoursPerPosition,
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
    averageWeeklyHours: avgPositions * getRatesForDate(new Date(year, 0, 1)).hoursPerPosition,
    peakWeeklyHours: peakPositions * getRatesForDate(new Date(year, 0, 1)).hoursPerPosition,
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
  const rates = getRatesForDate(new Date(year, month - 1, 1))
  const activeMembers = members.filter(
    (m) => wasActiveInPeriod(m, year, month) && isContractInPeriod(m, year, month),
  )

  let baseTotal = 0
  let childCount = 0
  let ndhChildCount = 0
  let qmChildCount = 0
  let integrationAChildCount = 0
  let integrationBChildCount = 0
  let unknownCareCount = 0

  for (const m of activeMembers) {
    if (!m.careType) {
      unknownCareCount++
      continue
    }
    const ageGroup = getAgeGroup(m.birthDate, year, month)
    const baseRate = rates.base[ageGroup][m.careType as CareTypeKey]
    if (!baseRate) {
      unknownCareCount++
      continue
    }
    baseTotal += baseRate - rates.mealAllowance
    childCount++
    if (m.surcharges.includes('ndhs')) ndhChildCount++
    if (m.surcharges.includes('qm')) qmChildCount++
    if (m.surcharges.includes('integration_a')) integrationAChildCount++
    if (m.surcharges.includes('integration_b')) integrationBChildCount++
  }

  const ndhQualifies =
    childCount > 0 && ndhChildCount / childCount >= (rates.surcharges.ndh.threshold ?? 0)
  const ndhSurchargeTotal = ndhQualifies ? ndhChildCount * rates.surcharges.ndh.rate : 0
  const qmSurchargeTotal = qmChildCount * rates.surcharges.qm.rate
  const integrationASurchargeTotal = integrationAChildCount * rates.surcharges.integration_a.rate
  const integrationBSurchargeTotal = integrationBChildCount * rates.surcharges.integration_b.rate
  const surchargeTotal =
    ndhSurchargeTotal + qmSurchargeTotal + integrationASurchargeTotal + integrationBSurchargeTotal
  const mealTotal = childCount * rates.mealAllowance

  return {
    baseTotal,
    mealTotal,
    ndhSurchargeTotal,
    qmSurchargeTotal,
    integrationASurchargeTotal,
    integrationBSurchargeTotal,
    surchargeTotal,
    total: baseTotal + surchargeTotal,
    month,
    year,
    childCount,
    ndhChildCount,
    qmChildCount,
    integrationAChildCount,
    integrationBChildCount,
    ndhQualifies,
    unknownCareCount,
  }
}
