import { defineStore } from 'pinia'
import type { ISBJContract, ISBJContractsResponse } from '~/types'

// Contracts are loaded live from ISBJ (many requests per load), so they are cached per session only
export const useIsbjStore = defineStore('isbj', () => {
  const contracts = ref<ISBJContract[]>([])
  const isConfigured = ref(false)
  const voucherError = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let loadedSlug: string | null = null
  let fetchPromise: Promise<void> | null = null

  async function fetchContracts(slug: string, { force = false } = {}): Promise<void> {
    if (loadedSlug === slug && !force) return
    if (fetchPromise) return fetchPromise
    isLoading.value = true
    error.value = null
    fetchPromise = $fetch<ISBJContractsResponse>(`/api/ini/${slug}/isbj/contracts`)
      .then((data) => {
        contracts.value = data.contracts
        isConfigured.value = data.isConfigured
        voucherError.value = data.voucherError
        loadedSlug = slug
      })
      .catch((err) => {
        isConfigured.value = true
        error.value =
          (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
          'ISBJ-Verträge konnten nicht geladen werden.'
      })
      .finally(() => {
        isLoading.value = false
        fetchPromise = null
      })
    return fetchPromise
  }

  return { contracts, isConfigured, voucherError, isLoading, error, fetchContracts }
})
