import { defineStore } from 'pinia'
import type { Manager } from '~/types'

export const useManagersStore = defineStore('managers', () => {
  const managers = ref<Manager[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let fetchPromise: Promise<void> | null = null

  async function fetchManagers(slug: string): Promise<void> {
    if (managers.value.length > 0) return
    if (fetchPromise) return fetchPromise
    isLoading.value = true
    error.value = null
    fetchPromise = $fetch<{ managers: Manager[] }>(`/api/ini/${slug}/managers`)
      .then((data) => {
        managers.value = data.managers
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

  async function createManager(
    slug: string,
    payload: { name: string; email: string; isMemberManager?: boolean },
  ): Promise<Manager> {
    const data = await $fetch<{ manager: Manager }>(`/api/ini/${slug}/managers/create`, {
      method: 'POST',
      body: payload,
    })
    managers.value.push(data.manager)
    managers.value.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return data.manager
  }

  async function updateManager(
    slug: string,
    managerId: string,
    payload: { name?: string; email?: string; isMemberManager?: boolean },
  ): Promise<void> {
    await $fetch(`/api/ini/${slug}/managers/${managerId}`, { method: 'PATCH', body: payload })
    const index = managers.value.findIndex((m) => m.id === managerId)
    if (index !== -1) managers.value[index] = { ...managers.value[index], ...payload }
  }

  async function deleteManager(slug: string, managerId: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/managers/${managerId}/delete`, { method: 'POST' })
    managers.value = managers.value.filter((m) => m.id !== managerId)
  }

  return { managers, isLoading, error, fetchManagers, createManager, updateManager, deleteManager }
})
