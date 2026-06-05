<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const { isMember, canManageMembers } = storeToRefs(authStore)

const pendingMembers = computed(() =>
  membersStore.members.filter(
    (m) => (m.status === 'PENDING_INVITE' || m.status === 'REGISTERED') && m.hasSubmittedDocuments,
  ),
)

const noCareTypeMembers = computed(() =>
  membersStore.members.filter(
    (m) => (m.status === 'ACTIVE' || m.status === 'INACTIVE') && !m.careType,
  ),
)

const contractEndingSoon = computed(() => {
  const year = new Date().getFullYear()
  return membersStore.members.filter(
    (m) => (m.status === 'ACTIVE' || m.status === 'INACTIVE') && Number(m.contractEnd) === year,
  )
})

const deactivatedMembers = computed(() =>
  membersStore.members
    .filter((m) => m.status === 'DEACTIVATED')
    .sort((a, b) => (a.deactivatedAt ?? '').localeCompare(b.deactivatedAt ?? '')),
)

const expiredContractMembers = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed: Juli=6, August=7
  return membersStore.members.filter((m) => {
    if (m.status !== 'ACTIVE' && m.status !== 'INACTIVE') return false
    if (!m.contractEnd) return false
    const endYear = Number(m.contractEnd)
    return endYear < year || (endYear === year && month >= 7)
  })
})

const noGroupMembers = computed(() =>
  membersStore.members.filter(
    (m) => (m.status === 'ACTIVE' || m.status === 'INACTIVE') && !m.groupId,
  ),
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

    <div class="space-y-6">
      <DashboardMemberStatus v-if="isMember" :slug="slug" />

      <template v-if="canManageMembers">
        <!-- Stat-Grid -->
        <div class="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
          <div class="card">
            <p class="text-sm font-medium text-gray-500">Aktive Kinder</p>
            <p class="mt-1 text-3xl font-bold text-gray-900">
              {{ membersStore.members.filter(m => m.status === 'ACTIVE' || m.status === 'INACTIVE').length }}
            </p>
            <template v-if="pendingMembers.length > 0">
              <p class="mt-5 text-xs font-medium text-amber-700">Warten auf Freischaltung</p>
              <ul class="mt-1 space-y-1">
                <li v-for="m in pendingMembers" :key="m.id">
                  <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-amber-600 hover:text-amber-800">
                    {{ m.firstName }} {{ m.lastName }} →
                  </NuxtLink>
                </li>
              </ul>
            </template>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-gray-500">Vertragsende in {{ new Date().getFullYear() }}</p>
            <p class="mt-1 text-3xl font-bold text-orange-500">{{ contractEndingSoon.length }}</p>
            <ul v-if="contractEndingSoon.length > 0" class="mt-5 space-y-0">
              <li v-for="m in contractEndingSoon" :key="m.id" class="flex items-center justify-between gap-1">
                <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-gray-600 hover:text-gray-900">
                  {{ m.firstName }} {{ m.lastName }} →
                </NuxtLink>
                <span class="text-xs text-gray-400 shrink-0">
                  {{ new Date(m.birthDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                </span>
              </li>
            </ul>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-gray-500">Abgemeldet</p>
            <p class="mt-1 text-3xl font-bold text-gray-400">{{ deactivatedMembers.length }}</p>
            <ul v-if="deactivatedMembers.length > 0" class="mt-5 space-y-1">
              <li v-for="m in deactivatedMembers" :key="m.id" class="flex items-center justify-between gap-1">
                <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-gray-600 hover:text-gray-900">
                  {{ m.firstName }} {{ m.lastName }} →
                </NuxtLink>
                <span v-if="m.deactivatedAt" class="text-xs text-gray-400 shrink-0">
                  Löschung am {{ new Date(new Date(m.deactivatedAt).setFullYear(new Date(m.deactivatedAt).getFullYear() + 1)).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                </span>
              </li>
            </ul>
            <template v-if="expiredContractMembers.length > 0">
              <p class="mt-5 text-xs font-medium text-red-700">Vertragsende überschritten</p>
              <ul class="mt-1 space-y-0">
                <li v-for="m in expiredContractMembers" :key="m.id">
                  <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-xs text-red-600 hover:text-red-800">
                    {{ m.firstName }} {{ m.lastName }} →
                  </NuxtLink>
                </li>
              </ul>
            </template>
          </div>
        </div>

        <!-- Hinweis-Grid -->
        <div v-if="noGroupMembers.length > 0 || noCareTypeMembers.length > 0" class="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
          <div v-if="noGroupMembers.length > 0" class="card border-orange-200">
            <p class="mb-2 text-sm font-medium text-orange-700">Ohne Gruppe</p>
            <ul class="space-y-1">
              <li v-for="m in noGroupMembers" :key="m.id">
                <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-sm text-orange-600 hover:text-orange-800">
                  {{ m.firstName }} {{ m.lastName }} →
                </NuxtLink>
              </li>
            </ul>
          </div>
          <div v-if="noCareTypeMembers.length > 0" class="card border-orange-200">
            <p class="mb-2 text-sm font-medium text-orange-700">Betreuungsumfang fehlt</p>
            <ul class="space-y-1">
              <li v-for="m in noCareTypeMembers" :key="m.id">
                <NuxtLink :to="`/ini/${slug}/members/${m.id}`" class="text-sm text-orange-600 hover:text-orange-800">
                  {{ m.firstName }} {{ m.lastName }} →
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <DashboardAktuell :slug="slug" />

      <DashboardDocuments :slug="slug" />
    </div>
  </div>
</template>
