import { rates as rvtag202601 } from './rvtag/2026-01'
import { rates as rvtag202604 } from './rvtag/2026-04'
import { rates as rvtag202608 } from './rvtag/2026-08'
import type { RvTagRateSet } from './types'

const RVTAG_RATES: RvTagRateSet[] = [rvtag202601, rvtag202604, rvtag202608].sort(
  (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
)

export function getRatesForDate(date: Date): RvTagRateSet {
  const valid = RVTAG_RATES.filter((r) => r.validFrom <= date)
  return valid.at(-1) ?? RVTAG_RATES[0]
}

export function getRateIndex(date: Date): number {
  const rates = getRatesForDate(date)
  return RVTAG_RATES.findIndex((r) => r.label === rates.label)
}

export type { AgeGroup, CareTypeKey } from './types'
export type { RvTagRateSet }
