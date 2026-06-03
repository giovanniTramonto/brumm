<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const slug = computed(() => route.params.slug as string | undefined)

const canManageMembers = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
})

const isResetting = ref(false)
const isResetConfirming = ref(false)

async function onResetStorage() {
  if (!isResetConfirming.value) {
    isResetConfirming.value = true
    return
  }
  isResetting.value = true
  try {
    await $fetch(`/api/ini/${slug.value}/settings/reset-storage`, { method: 'POST' })
    isResetConfirming.value = false
    await navigateTo(`/ini/${slug.value}/dashboard`)
  } catch {
    isResetConfirming.value = false
  } finally {
    isResetting.value = false
  }
}

const navItems = computed(() => {
  if (!slug.value || !authStore.currentUser) return []
  const base = `/ini/${slug.value}`
  const items: { label: string; to: string; disabled?: boolean }[] = []
  items.push({ label: 'Kinder', to: `${base}/members` })
  if (authStore.currentUser.role !== 'MEMBER') {
    items.push({ label: 'Gruppen', to: `${base}/groups` })
  }
  if (authStore.currentUser.role === 'SUPERUSER') {
    items.push({ label: 'Vorstand', to: `${base}/managers` })
  }
  if (authStore.currentUser.role === 'SUPERUSER' || authStore.currentUser.role === 'MANAGER') {
    items.push({ label: 'Berechnung', to: `${base}/calculations` })
  }
  if (authStore.currentUser.role === 'SUPERUSER') {
    items.push({ label: 'Einstellungen', to: `${base}/settings` })
  }
  return items
})

async function onLogout() {
  if (!slug.value) return
  await authStore.logout(slug.value)
  await navigateTo(`/login/${slug.value}`)
}
</script>

<template>
  <div :class="authStore.currentUser?.role === 'MEMBER' ? 'bg-member' : 'bg-ini'" class="min-h-screen">
    <nav v-if="authStore.currentUser" aria-label="Hauptnavigation" class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center gap-8">
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-lg font-semibold text-primary-700">
              {{ authStore.currentClub?.name ?? "Brumm" }}
            </NuxtLink>
            <ul class="hidden list-none gap-1 sm:flex" role="list">
              <li v-for="item in navItems" :key="item.to">
                <span
                  v-if="item.disabled"
                  class="block rounded-md px-3 py-2 text-sm font-medium text-gray-300 cursor-not-allowed"
                  role="link"
                  aria-disabled="true"
                >{{ item.label }}</span>
                <NuxtLink
                  v-else
                  :to="item.to"
                  :class="[
                    'block rounded-md px-3 py-2 text-sm font-medium',
                    route.path.startsWith(item.to)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  ]"
                >{{ item.label }}</NuxtLink>
              </li>
            </ul>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500">{{
              authStore.currentUser?.role === 'SUPERUSER' ? 'Admin'
              : authStore.currentUser?.role === 'MANAGER' ? 'Vorstand'
              : authStore.currentUser?.role === 'TEAM' ? 'Team'
              : 'Mitglied'
            }}</span>
            <template v-if="canManageMembers">
              <button
                class="btn-secondary text-sm text-red-600 hover:text-red-700"
                :disabled="isResetting"
                @click="onResetStorage"
              >
                {{ isResetConfirming ? 'Sicher?' : 'Reset' }}
              </button>
              <button
                v-if="isResetConfirming"
                class="text-sm text-gray-400 hover:text-gray-600"
                @click="isResetConfirming = false"
              >✕</button>
            </template>
            <button class="btn-secondary text-sm" @click="onLogout">Abmelden</button>
          </div>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
