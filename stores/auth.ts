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

  async function checkDevice(slug: string): Promise<{
    sessions: { userId: string; displayName: string; role: string; isLocked: boolean }[]
  }> {
    try {
      const url = `/api/ini/${slug}/auth/device` as string
      return await $fetch<{
        sessions: { userId: string; displayName: string; role: string; isLocked: boolean }[]
      }>(url)
    } catch {
      return { sessions: [] }
    }
  }

  async function loginWithPin(slug: string, pin: string, userId?: string): Promise<void> {
    isLoading.value = true
    try {
      const data = await $fetch<{ user: AuthUser; club: Club }>(`/api/ini/${slug}/auth/pin`, {
        method: 'POST',
        body: { pin, ...(userId ? { userId } : {}) },
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

  async function verifyOtp(slug: string, code: string): Promise<void> {
    const data = await $fetch<{ user: AuthUser; club: Club }>(`/api/ini/${slug}/auth/verify-otp`, {
      method: 'POST',
      body: { code },
    })
    currentUser.value = data.user
    currentClub.value = data.club
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
  const isManager = computed(() => currentUser.value?.role === 'MANAGER')
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
    isManager,
    isSuperUser,
    canManageMembers,
    canManageClub,
    login,
    verifyToken,
    verifyOtp,
    logout,
    fetchSession,
    clearAuth,
    checkDevice,
    loginWithPin,
    removeDevice,
  }
})
