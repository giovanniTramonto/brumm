import { defineStore } from 'pinia'
import type { Member } from '~/types'

export const useMembersStore = defineStore('members', () => {
  const members = ref<Member[]>([])
  const hasAnyMemberManager = ref(false)
  const memberManagerNames = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers(slug: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{
        members: Member[]
        hasAnyMemberManager: boolean
        memberManagerNames: string[]
      }>(`/api/ini/${slug}/members`)
      members.value = data.members
      hasAnyMemberManager.value = data.hasAnyMemberManager
      memberManagerNames.value = data.memberManagerNames
    } catch (err) {
      const d = (err as { data?: { statusMessage?: string; message?: string } })?.data
      const sm = d?.statusMessage
      const m = d?.message
      error.value = sm
        ? m && m !== sm
          ? `${sm} (${m})`
          : sm
        : 'Fehler beim Laden'
    } finally {
      isLoading.value = false
    }
  }

  async function activateMember(slug: string, memberId: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/members/${memberId}/activate`, { method: 'POST' })
    const index = members.value.findIndex((m) => m.id === memberId)
    if (index !== -1) members.value[index] = { ...members.value[index], isActive: true }
  }

  async function deactivateMember(slug: string, memberId: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/members/${memberId}/deactivate`, { method: 'POST' })
    const index = members.value.findIndex((m) => m.id === memberId)
    if (index !== -1)
      members.value[index] = {
        ...members.value[index],
        isActive: false,
        deactivatedAt: new Date().toISOString(),
      }
  }

  return {
    members,
    hasAnyMemberManager,
    memberManagerNames,
    isLoading,
    error,
    fetchMembers,
    activateMember,
    deactivateMember,
  }
})
