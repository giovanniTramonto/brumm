import { defineStore } from 'pinia'
import type { Manager } from '~/types'

export const useManagersStore = defineStore('managers', () => {
  const managers = ref<Manager[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchManagers(slug: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ managers: Manager[] }>(`/api/ini/${slug}/managers`)
      managers.value = data.managers
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Fehler beim Laden'
    } finally {
      isLoading.value = false
    }
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
