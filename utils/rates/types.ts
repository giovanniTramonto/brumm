export type CareTypeKey = 'full_extended' | 'full' | 'part' | 'half_with_meal' | 'half_without_meal'
export type AgeGroup = '01' | '2' | '3plus'

export interface SurchargeConfig {
  label: string
  rate: number
  staffRate: number
  /** Minimum fraction of qualifying children required (e.g. 0.4 for ndH) */
  threshold?: number
}

export interface RvTagRateSet {
  validFrom: Date
  /** Short label for display in UI */
  label: string
  /** Source document reference */
  source: string
  base: Record<AgeGroup, Record<CareTypeKey, number>>
  staff: Record<AgeGroup, Record<CareTypeKey, number>>
  surcharges: {
    ndh: SurchargeConfig
    qm: SurchargeConfig
    integration_a: SurchargeConfig
    integration_b: SurchargeConfig
  }
  leadershipRate: number
  hoursPerPosition: number
  mealAllowance: number
}
