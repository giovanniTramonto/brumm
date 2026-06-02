import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.currentUser) {
    const slug = to.params.slug as string | undefined
    if (slug) {
      const ok = await authStore.fetchSession(slug)
      if (!ok) return navigateTo(`/login/${slug}`)
    } else {
      return navigateTo('/register')
    }
  }
})
