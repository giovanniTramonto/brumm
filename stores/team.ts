import { defineStore } from 'pinia'
import type { TeamMember } from '~/types'

export const useTeamStore = defineStore('team', () => {
  const team = ref<TeamMember[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let fetchPromise: Promise<void> | null = null

  async function fetchTeam(slug: string): Promise<void> {
    if (team.value.length > 0) return
    if (fetchPromise) return fetchPromise
    isLoading.value = true
    error.value = null
    fetchPromise = $fetch<{ team: TeamMember[] }>(`/api/ini/${slug}/team`)
      .then((data) => {
        team.value = data.team
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

  async function createTeamMember(
    slug: string,
    payload: { name: string; email: string },
  ): Promise<TeamMember> {
    const data = await $fetch<{ member: TeamMember }>(`/api/ini/${slug}/team/create`, {
      method: 'POST',
      body: payload,
    })
    team.value.push(data.member)
    team.value.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return data.member
  }

  async function updateTeamMember(
    slug: string,
    memberId: string,
    payload: { name?: string; email?: string },
  ): Promise<void> {
    await $fetch(`/api/ini/${slug}/team/${memberId}`, { method: 'PATCH', body: payload })
    const index = team.value.findIndex((m) => m.id === memberId)
    if (index !== -1) team.value[index] = { ...team.value[index], ...payload }
  }

  async function deleteTeamMember(slug: string, memberId: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/team/${memberId}/delete`, { method: 'POST' })
    team.value = team.value.filter((m) => m.id !== memberId)
  }

  return { team, isLoading, error, fetchTeam, createTeamMember, updateTeamMember, deleteTeamMember }
})
