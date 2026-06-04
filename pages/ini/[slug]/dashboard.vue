<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const isMember = computed(() => authStore.currentUser?.role === 'MEMBER')
const isSuperUser = computed(() => authStore.currentUser?.role === 'SUPERUSER')
const canManageDocuments = computed(() => {
  const role = authStore.currentUser?.role
  return role === 'SUPERUSER' || role === 'MANAGER'
})

const pendingCount = computed(
  () =>
    membersStore.members.filter((m) => m.status === 'PENDING_INVITE' || m.status === 'REGISTERED')
      .length,
)

onMounted(() => membersStore.fetchMembers(slug))
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">
        Willkommen{{ authStore.currentUser?.firstName ? `, ${authStore.currentUser.firstName}` : '' }}!
      </h1>
    </div>

    <DashboardStats v-if="!isMember" />

    <DashboardMemberStatus v-if="isMember" :slug="slug" />

    <div v-if="pendingCount > 0 && isSuperUser" class="mt-6">
      <div class="rounded-md bg-amber-50 p-4">
        <p class="text-sm text-amber-800">
          <strong>{{ pendingCount }}</strong> Kind{{ pendingCount !== 1 ? "er" : "" }}
          warte{{ pendingCount !== 1 ? "n" : "t" }} auf Freischaltung.
        </p>
        <NuxtLink :to="`/ini/${slug}/members`" class="mt-2 inline-block text-sm font-medium text-amber-700 hover:text-amber-900">
          Zur Kinderliste →
        </NuxtLink>
      </div>
    </div>

    <DashboardAktuell :slug="slug" />

    <DashboardDocuments v-if="canManageDocuments" :slug="slug" />
  </div>
</template>
