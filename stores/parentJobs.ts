import { defineStore } from 'pinia'
import type { ParentJob } from '~/types'

export const useParentJobsStore = defineStore('parentJobs', () => {
  const parentJobs = ref<ParentJob[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let isLoaded = false
  let fetchPromise: Promise<void> | null = null

  async function fetchParentJobs(slug: string): Promise<void> {
    if (isLoaded) return
    if (fetchPromise) return fetchPromise
    isLoading.value = true
    error.value = null
    fetchPromise = $fetch<{ parentJobs: ParentJob[] }>(`/api/ini/${slug}/parent-jobs`)
      .then((data) => {
        parentJobs.value = data.parentJobs
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

  function addParentJob(job: ParentJob): void {
    parentJobs.value = [...parentJobs.value, job].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }

  function updateParentJob(updated: ParentJob): void {
    parentJobs.value = parentJobs.value
      .map((j) => (j.id === updated.id ? { ...j, ...updated } : j))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }

  function removeParentJob(jobId: string): void {
    parentJobs.value = parentJobs.value.filter((j) => j.id !== jobId)
  }

  function invalidate(): void {
    parentJobs.value = []
    isLoaded = false
    fetchPromise = null
  }

  return {
    parentJobs,
    isLoading,
    error,
    fetchParentJobs,
    addParentJob,
    updateParentJob,
    removeParentJob,
    invalidate,
  }
})
