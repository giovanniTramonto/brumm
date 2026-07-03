import { useAuthStore } from '~/stores/auth'
import { useDocumentsStore } from '~/stores/documents'
import { useManagersStore } from '~/stores/managers'
import { useMembersStore } from '~/stores/members'
import { useParentJobsStore } from '~/stores/parentJobs'
import { useTeamStore } from '~/stores/team'

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const slug = to.params.slug as string | undefined

  if (!authStore.currentUser) {
    if (slug) {
      const ok = await authStore.fetchSession(slug)
      if (!ok) return navigateTo(`/login/${slug}`)
    } else {
      return navigateTo('/register')
    }
  }

  if (slug && authStore.currentUser) {
    useMembersStore().fetchMembers(slug)
    useTeamStore().fetchTeam(slug)
    useManagersStore().fetchManagers(slug)
    useDocumentsStore().fetchDocuments(slug)
    useParentJobsStore().fetchParentJobs(slug)
  }
})
