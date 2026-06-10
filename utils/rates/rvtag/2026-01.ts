import type { RvTagRateSet } from '../types'

// Quelle: Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.01.2026 (Version 26.01.2026)
export const rates: RvTagRateSet = {
  validFrom: new Date(2026, 0, 1),
  label: 'RV Tag EKT, ab Jan 2026',
  source: 'Kostenblatt RV Tag EKT, Anlage 2b KFöG, gültig ab 01.01.2026',
  base: {
    '01': {
      full_extended: 2220.71,
      full: 2135.75,
      part: 1660.01,
      half_with_meal: 1280.54,
      half_without_meal: 1192.59,
    },
    '2': {
      full_extended: 1818.6,
      full: 1733.64,
      part: 1439.13,
      half_with_meal: 1167.27,
      half_without_meal: 1079.33,
    },
    '3plus': {
      full_extended: 1133.29,
      full: 1048.33,
      part: 935.06,
      half_with_meal: 827.44,
      half_without_meal: 739.5,
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
      rate: 101.35,
      staffRate: 0.017,
      threshold: 0.4,
    },
    qm: {
      label: 'QM/MSS (sozial benachteiligte Wohngebiete, § 18 VOKitaFöG)',
      rate: 59.62,
      staffRate: 0.01,
    },
    integration_a: {
      label: 'Integration Typ A (SpH, § 16(1) VOKitaFöG)',
      rate: 1696.24,
      staffRate: 0.25,
    },
    integration_b: {
      label: 'Integration Typ B (SpH, § 16(2) VOKitaFöG)',
      rate: 3384.92,
      staffRate: 0.5,
    },
  },
  leadershipRate: 0.0118,
  hoursPerPosition: 39.4,
  mealAllowance: 23,
}
