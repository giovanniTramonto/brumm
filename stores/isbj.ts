import { defineStore } from 'pinia'
import type { ISBJConnectionResponse, ISBJContract, ISBJContractsResponse } from '~/types'

// Same as the server's ISBJ client cache: re-checking more often would only hit the cached client
const CONNECTION_TTL_MS = 5 * 60_000

export type ISBJConnectionStatus = 'unknown' | 'not_configured' | 'connected' | 'error'

function toErrorMessage(err: unknown, fallback: string): string {
  return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}

// Contracts are loaded live from ISBJ (many requests per load), so they are cached per session only
export const useIsbjStore = defineStore('isbj', () => {
  const contracts = ref<ISBJContract[]>([])
  const isConfigured = ref(false)
  const voucherError = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let loadedSlug: string | null = null
  let fetchPromise: Promise<void> | null = null

  // --- Connection status (navigation indicator) ---
  const connectionStatus = ref<ISBJConnectionStatus>('unknown')
  const connectionError = ref<string | null>(null)
  const isCheckingConnection = ref(false)

  let connectionSlug: string | null = null
  let connectionCheckedAt = 0
  let connectionPromise: Promise<void> | null = null

  function setConnection(slug: string, status: ISBJConnectionStatus, message: string | null) {
    connectionSlug = slug
    connectionCheckedAt = Date.now()
    connectionStatus.value = status
    connectionError.value = message
  }

  async function checkConnection(slug: string, { force = false } = {}): Promise<void> {
    const isFresh = connectionSlug === slug && Date.now() - connectionCheckedAt < CONNECTION_TTL_MS
    if (isFresh && !force) return
    if (connectionPromise) return connectionPromise
    if (connectionSlug !== slug) connectionStatus.value = 'unknown'
    isCheckingConnection.value = true
    connectionPromise = $fetch<ISBJConnectionResponse>(`/api/ini/${slug}/isbj/connection`)
      .then((data) => {
        if (!data.isConfigured) setConnection(slug, 'not_configured', null)
        else if (data.isConnected) setConnection(slug, 'connected', null)
        else setConnection(slug, 'error', data.error)
      })
      .catch((err) => {
        setConnection(
          slug,
          'error',
          toErrorMessage(err, 'ISBJ-Status konnte nicht geprüft werden.'),
        )
      })
      .finally(() => {
        isCheckingConnection.value = false
        connectionPromise = null
      })
    return connectionPromise
  }

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
        // A successful load is also a successful connection check
        setConnection(slug, data.isConfigured ? 'connected' : 'not_configured', null)
      })
      .catch((err) => {
        isConfigured.value = true
        error.value = toErrorMessage(err, 'ISBJ-Verträge konnten nicht geladen werden.')
        setConnection(slug, 'error', error.value)
      })
      .finally(() => {
        isLoading.value = false
        fetchPromise = null
      })
    return fetchPromise
  }

  // After the ISBJ settings changed: drop cached contracts and re-check the connection right away
  function onConfigChanged(slug: string): Promise<void> {
    loadedSlug = null
    contracts.value = []
    return checkConnection(slug, { force: true })
  }

  return {
    contracts,
    isConfigured,
    voucherError,
    isLoading,
    error,
    fetchContracts,
    connectionStatus,
    connectionError,
    isCheckingConnection,
    checkConnection,
    onConfigChanged,
  }
})
