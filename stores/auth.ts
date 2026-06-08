import { defineStore } from 'pinia'
import type { AuthUser, Club } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthUser | null>(null)
  const currentClub = ref<Club | null>(null)
  const isLoading = ref(false)

  async function login(slug: string, email: string, pin?: string): Promise<void> {
    isLoading.value = true
    try {
      await $fetch(`/api/ini/${slug}/auth/magic-link`, {
        method: 'POST',
        body: { email, ...(pin ? { pin } : {}) },
      })
    } finally {
      isLoading.value = false
    }
  }

  async function checkDevice(slug: string): Promise<{ hasDevice: boolean; isLocked: boolean }> {
    try {
      return await $fetch(`/api/ini/${slug}/auth/device`)
    } catch {
      return { hasDevice: false, isLocked: false }
    }
  }

  async function loginWithPin(slug: string, pin: string): Promise<void> {
    isLoading.value = true
    try {
      const data = await $fetch<{ user: AuthUser; club: Club }>(`/api/ini/${slug}/auth/pin`, {
        method: 'POST',
        body: { pin },
      })
      currentUser.value = data.user
      currentClub.value = data.club
    } finally {
      isLoading.value = false
    }
  }

  async function removeDevice(slug: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/auth/device`, { method: 'DELETE' })
  }

  async function verifyToken(slug: string, token: string): Promise<void> {
    isLoading.value = true
    try {
      const data = await $fetch<{ user: AuthUser; club: Club }>(
        `/api/ini/${slug}/auth/verify/${token}`,
      )
      currentUser.value = data.user
      currentClub.value = data.club
    } finally {
      isLoading.value = false
    }
  }

  async function logout(slug: string): Promise<void> {
    await $fetch(`/api/ini/${slug}/auth/logout`, { method: 'POST' }).catch(() => {})
  }

  async function fetchSession(slug: string): Promise<boolean> {
    try {
      const data = await $fetch<{ user: AuthUser; club: Club }>(`/api/ini/${slug}/auth/me`)
      currentUser.value = data.user
      currentClub.value = data.club
      return true
    } catch {
      return false
    }
  }

  const isMember = computed(() => currentUser.value?.role === 'MEMBER')
  const isTeam = computed(() => currentUser.value?.role === 'TEAM')
  const isSuperUser = computed(() => currentUser.value?.role === 'SUPERUSER')
  const canManageMembers = computed(() => {
    const user = currentUser.value
    return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
  })
  const canManageClub = computed(
    () => currentUser.value?.role === 'SUPERUSER' || currentUser.value?.role === 'MANAGER',
  )

  function clearAuth(): void {
    currentUser.value = null
    currentClub.value = null
  }

  return {
    currentUser,
    currentClub,
    isLoading,
    isMember,
    isTeam,
    isSuperUser,
    canManageMembers,
    canManageClub,
    login,
    verifyToken,
    logout,
    fetchSession,
    clearAuth,
    checkDevice,
    loginWithPin,
    removeDevice,
  }
})
