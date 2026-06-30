import { defineStore } from 'pinia'

export type WallEntry = {
  id: string
  name: string
  order: number
  type: string
  url: string | null
  createdAt: string
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<WallEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let isLoaded = false
  let fetchPromise: Promise<void> | null = null

  async function fetchDocuments(slug: string): Promise<void> {
    if (isLoaded) return
    if (fetchPromise) return fetchPromise
    isLoading.value = true
    error.value = null
    fetchPromise = $fetch<{ documents: WallEntry[] }>(`/api/ini/${slug}/documents`)
      .then((data) => {
        documents.value = data.documents
        isLoaded = true
      })
      .catch((err) => {
        const d = (err as { data?: { statusMessage?: string; message?: string } })?.data
        const sm = d?.statusMessage
        const m = d?.message
        error.value = sm ? (m && m !== sm ? `${sm} (${m})` : sm) : 'Fehler beim Laden'
      })
      .finally(() => {
        isLoading.value = false
        fetchPromise = null
      })
    return fetchPromise
  }

  function addDocument(doc: WallEntry): void {
    documents.value = [...documents.value, doc]
  }

  function updateDocument(id: string, doc: WallEntry): void {
    documents.value = documents.value.map((d) => (d.id === id ? doc : d))
  }

  function removeDocument(id: string): void {
    documents.value = documents.value.filter((d) => d.id !== id)
  }

  function reorder(ids: string[]): void {
    const map = new Map(documents.value.map((d) => [d.id, d]))
    documents.value = ids.flatMap((id, i) => {
      const doc = map.get(id)
      return doc ? [{ ...doc, order: i }] : []
    })
  }

  function invalidate(): void {
    documents.value = []
    isLoaded = false
    fetchPromise = null
  }

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    addDocument,
    updateDocument,
    removeDocument,
    reorder,
    invalidate,
  }
})
