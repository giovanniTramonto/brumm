import { defineStore } from 'pinia'
import type { Group } from '~/types'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchGroups(slug: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`)
      groups.value = data.groups
    } catch (err) {
      const d = (err as { data?: { statusMessage?: string; message?: string } })?.data
      const sm = d?.statusMessage
      const m = d?.message
      error.value = sm ? (m && m !== sm ? `${sm} (${m})` : sm) : 'Fehler beim Laden'
    } finally {
      isLoading.value = false
    }
  }

  async function createGroup(
    slug: string,
    payload: { name: string; email?: string },
  ): Promise<Group> {
    const data = await $fetch<{ group: Group }>(`/api/ini/${slug}/groups/create`, {
      method: 'POST',
      body: payload,
    })
    groups.value.push(data.group)
    return data.group
  }

  async function updateGroup(
    slug: string,
    groupId: string,
    payload: { name?: string; email?: string | null },
  ): Promise<Group> {
    const data = await $fetch<{ group: Group }>(`/api/ini/${slug}/groups/${groupId}`, {
      method: 'PATCH',
      body: payload,
    })
    const index = groups.value.findIndex((g) => g.id === groupId)
    if (index !== -1) groups.value[index] = data.group
    return data.group
  }

  async function deleteGroup(slug: string, groupId: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/groups/${groupId}`, { method: 'DELETE' })
    groups.value = groups.value.filter((g) => g.id !== groupId)
  }

  return {
    groups,
    isLoading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
  }
})
