import { useAuthStore } from '~/stores/auth'
import type { Role } from '~/types'

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPERUSER: 3,
  MANAGER: 2,
  TEAM: 2,
  MEMBER: 1,
}

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  const user = authStore.currentUser

  if (!user) return

  const requiredRole = to.meta.requiredRole as Role | undefined
  if (!requiredRole) return

  const userLevel = ROLE_HIERARCHY[user.role]
  const requiredLevel = ROLE_HIERARCHY[requiredRole]

  if (userLevel < requiredLevel) {
    const slug = to.params.slug as string | undefined
    return navigateTo(slug ? `/ini/${slug}/dashboard` : '/')
  }
})
