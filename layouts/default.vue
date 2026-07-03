<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const { currentUser, isMember, isTeam, isManager, isSuperUser, canManageClub } =
  storeToRefs(authStore)
const route = useRoute()
const { isMenuOpen } = useNavMenu(768)

const bgClass = computed(() => {
  if (isMember.value) return 'bg-member'
  if (isTeam.value) return 'bg-team'
  if (isSuperUser.value) return 'bg-admin'
  return 'bg-ini'
})
const slug = computed(() => route.params.slug as string | undefined)
const navItems = computed(() => {
  if (!slug.value || !currentUser.value) return []
  const base = `/ini/${slug.value}`
  return [
    canManageClub.value && { label: 'Kinder', to: `${base}/members` },
    isSuperUser.value && { label: 'Gruppen', to: `${base}/groups` },
    isSuperUser.value && { label: 'Vorstand', to: `${base}/managers` },
    isSuperUser.value && { label: 'Team', to: `${base}/team` },
    { label: 'Elternposten', to: `${base}/parent-jobs` },
    canManageClub.value && { label: 'Berechnung', to: `${base}/calculations` },
    isSuperUser.value && { label: 'Einstellungen', to: `${base}/settings` },
  ].filter(Boolean) as { label: string; to: string }[]
})
const roleLabel = computed(() => {
  if (isSuperUser.value) return 'Admin'
  if (isManager.value) return 'Vorstand'
  if (isTeam.value) return 'Team'
  return 'Mitglied'
})

function onLogout() {
  if (!slug.value) return
  authStore.logout(slug.value)
  window.location.href = `/login/${slug.value}`
}
</script>

<template>
  <div :class="bgClass" class="min-h-screen">
    <nav v-if="currentUser" aria-label="Hauptnavigation" class="app-nav relative z-10 border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex min-h-16 items-center justify-between py-4">
          <div class="flex items-center gap-8">
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-lg font-semibold text-primary-700">
              {{ authStore.currentClub?.name ?? "Brumm" }}
            </NuxtLink>
            <ul class="hidden list-none gap-1 tablet:flex" role="list">
              <li v-for="item in navItems" :key="item.to">
                <NuxtLink
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
          <div class="flex items-center gap-3 pl-8">
            <span class="hidden text-sm text-gray-500 tablet:inline">{{ roleLabel }}</span>
            <button class="btn-secondary hidden text-sm tablet:inline-flex" @click="onLogout">Abmelden</button>
            <NavBurger
              class="tablet:hidden"
              :isOpen="isMenuOpen"
              controls="mobile-nav"
              @toggle="isMenuOpen = !isMenuOpen"
            />
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div
        v-if="isMenuOpen"
        id="mobile-nav"
        class="tablet:hidden border-t border-gray-100 px-4 py-3"
      >
        <ul class="flex flex-col gap-1" role="list">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
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
        <div :class="navItems.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : ''" class="flex items-center justify-between">
          <span class="text-sm text-gray-500">{{ roleLabel }}</span>
          <button class="btn-secondary text-sm" @click="onLogout">Abmelden</button>
        </div>
      </div>
    </nav>

    <NavOverlay :isOpen="isMenuOpen" @close="isMenuOpen = false" />

    <main class="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-nav {
  padding-top: env(safe-area-inset-top);
}
</style>
