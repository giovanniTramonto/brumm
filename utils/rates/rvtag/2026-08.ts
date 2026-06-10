import type { RvTagRateSet } from '../types'

// Quelle: Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.08.2026
export const rates: RvTagRateSet = {
  validFrom: new Date(2026, 7, 1),
  label: 'RV Tag EKT, ab Aug 2026',
  source: 'Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.08.2026',
  base: {
    '01': {
      full_extended: 2582.03,
      full: 2494.91,
      part: 1850.31,
      half_with_meal: 1379.92,
      half_without_meal: 1291.98,
    },
    '2': {
      full_extended: 2036.14,
      full: 1949.03,
      part: 1565.75,
      half_with_meal: 1246.35,
      half_without_meal: 1158.41,
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
      full_extended: 0.37,
      full: 0.355,
      part: 0.244,
      half_with_meal: 0.163,
      half_without_meal: 0.163,
    },
    '2': {
      full_extended: 0.276,
      full: 0.261,
      part: 0.195,
      half_with_meal: 0.14,
      half_without_meal: 0.14,
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
