import type { RvTagRateSet } from '../types'

// Quelle: Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.04.2026
export const rates: RvTagRateSet = {
  validFrom: new Date(2026, 3, 1),
  label: 'RV Tag EKT, ab Apr 2026',
  source: 'Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.04.2026',
  base: {
    '01': {
      full_extended: 2268.43,
      full: 2181.33,
      part: 1693.51,
      half_with_meal: 1304.42,
      half_without_meal: 1216.48,
    },
    '2': {
      full_extended: 1856.11,
      full: 1769.01,
      part: 1467.02,
      half_with_meal: 1188.27,
      half_without_meal: 1100.33,
    },
    '3plus': {
      full_extended: 1153.43,
      full: 1066.32,
      part: 950.18,
      half_with_meal: 839.84,
      half_without_meal: 751.89,
    },
  },
  staff: {
    '01': {
      full_extended: 0.316,
      full: 0.301,
      part: 0.217,
      half_with_meal: 0.15,
      half_without_meal: 0.15,
    },
    '2': {
      full_extended: 0.245,
      full: 0.23,
      part: 0.178,
      half_with_meal: 0.13,
      half_without_meal: 0.13,
    },
    '3plus': {
      full_extended: 0.124,
      full: 0.109,
      part: 0.089,
      half_with_meal: 0.07,
      half_without_meal: 0.07,
    },
  },
  surcharges: {
    ndh: {
      label: 'ndH (nichtdeutsche Herkunftssprache)',
      rate: 103.92,
      staffRate: 0.017,
      threshold: 0.4,
    },
    qm: {
      label: 'QM/MSS (sozial benachteiligte Wohngebiete, § 18 VOKitaFöG)',
      rate: 61.13,
      staffRate: 0.01,
    },
    integration_a: {
      label: 'Integration Typ A (SpH, § 16(1) VOKitaFöG)',
      rate: 1739.01,
      staffRate: 0.25,
    },
    integration_b: {
      label: 'Integration Typ B (SpH, § 16(2) VOKitaFöG)',
      rate: 3470.45,
      staffRate: 0.5,
    },
  },
  leadershipRate: 0.0118,
  hoursPerPosition: 39.4,
  mealAllowance: 23,
}
