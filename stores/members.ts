import { defineStore } from "pinia"
import type { User } from "~/types"

export const useMembersStore = defineStore("members", () => {
  const members = ref<User[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers(slug: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ members: User[] }>(`/api/ini/${slug}/members`)
      members.value = data.members
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Fehler beim Laden"
    } finally {
      isLoading.value = false
    }
  }

  async function createMember(
    slug: string,
    payload: {
      firstName: string
      lastName: string
      birthDate: string
      guardian1Name?: string
      guardian2Name?: string
      email1: string
      email2?: string
      groupId?: string
    }
  ): Promise<User> {
    isLoading.value = true
    try {
      const data = await $fetch<{ user: User }>(`/api/ini/${slug}/members/create`, {
        method: "POST",
        body: payload,
      })
      members.value.push(data.user)
      return data.user
    } finally {
      isLoading.value = false
    }
  }

  async function activateMember(slug: string, memberId: string): Promise<void> {
    const data = await $fetch<{ member: User }>(`/api/ini/${slug}/members/${memberId}/activate`, {
      method: "POST",
    })
    const index = members.value.findIndex((m) => m.id === memberId)
    if (index !== -1) members.value[index] = data.member
  }

  async function deactivateMember(slug: string, memberId: string): Promise<void> {
    const data = await $fetch<{ member: User }>(`/api/ini/${slug}/members/${memberId}/deactivate`, {
      method: "POST",
    })
    const index = members.value.findIndex((m) => m.id === memberId)
    if (index !== -1) members.value[index] = data.member
  }

  return {
    members,
    isLoading,
    error,
    fetchMembers,
    createMember,
    activateMember,
    deactivateMember,
  }
})
