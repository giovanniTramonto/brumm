import { useAuthStore } from "~/stores/auth"

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.currentUser) {
    const slug = to.params.slug as string | undefined
    const loginPath = slug ? `/ini/${slug}/login` : "/register"
    return navigateTo(loginPath)
  }
})
