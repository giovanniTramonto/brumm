import { defineStore } from 'pinia'
import type { AuthUser, Club } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthUser | null>(null)
  const currentClub = ref<Club | null>(null)
  const isLoading = ref(false)

  async function login(slug: string, email: string): Promise<void> {
    isLoading.value = true
    try {
      await $fetch(`/api/ini/${slug}/auth/magic-link`, {
        method: 'POST',
        body: { email },
      })
    } finally {
      isLoading.value = false
    }
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
    isLoading.value = true
    try {
      await $fetch(`/api/ini/${slug}/auth/logout`, { method: 'POST' })
    } finally {
      currentUser.value = null
      currentClub.value = null
      isLoading.value = false
    }
  }

  function setUser(user: AuthUser, club: Club): void {
    currentUser.value = user
    currentClub.value = club
  }

  function clearAuth(): void {
    currentUser.value = null
    currentClub.value = null
  }

  return {
    currentUser,
    currentClub,
    isLoading,
    login,
    verifyToken,
    logout,
    setUser,
    clearAuth,
  }
})
