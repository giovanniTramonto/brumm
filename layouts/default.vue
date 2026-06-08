<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const slug = computed(() => route.params.slug as string | undefined)

const navItems = computed(() => {
  if (!slug.value || !authStore.currentUser) return []
  const base = `/ini/${slug.value}`
  const items: { label: string; to: string; disabled?: boolean }[] = []
  if (authStore.currentUser.role !== 'MEMBER') {
    items.push({ label: 'Kinder', to: `${base}/members` })
  }
  if (authStore.currentUser.role === 'SUPERUSER') {
    items.push({ label: 'Vorstand', to: `${base}/managers` })
    items.push({ label: 'Team', to: `${base}/team` })
  }
  if (authStore.currentUser.role === 'SUPERUSER' || authStore.currentUser.role === 'MANAGER') {
    items.push({ label: 'Berechnung', to: `${base}/calculations` })
  }
  if (authStore.currentUser.role === 'SUPERUSER') {
    items.push({ label: 'Einstellungen', to: `${base}/settings` })
  }
  return items
})

const { isMenuOpen } = useNavMenu(768)

function onLogout() {
  if (!slug.value) return
  authStore.logout(slug.value)
  window.location.href = `/login/${slug.value}`
}
</script>

<template>
  <div :class="authStore.currentUser?.role === 'MEMBER' ? 'bg-member' : authStore.currentUser?.role === 'TEAM' ? 'bg-team' : 'bg-ini'" class="min-h-screen">
    <nav v-if="authStore.currentUser" aria-label="Hauptnavigation" class="relative z-10 border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex min-h-16 items-center justify-between py-4">
          <div class="flex items-center gap-8">
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-lg font-semibold text-primary-700">
              {{ authStore.currentClub?.name ?? "Brumm" }}
            </NuxtLink>
            <ul class="hidden list-none gap-1 tablet:flex" role="list">
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
          <div class="flex items-center gap-3 pl-8">
            <span class="hidden text-sm text-gray-500 tablet:inline">{{
              authStore.currentUser?.role === 'SUPERUSER' ? 'Admin'
              : authStore.currentUser?.role === 'MANAGER' ? 'Vorstand'
              : authStore.currentUser?.role === 'TEAM' ? 'Team'
              : 'Mitglied'
            }}</span>
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
        <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span class="text-sm text-gray-500">{{
            authStore.currentUser?.role === 'SUPERUSER' ? 'Admin'
            : authStore.currentUser?.role === 'MANAGER' ? 'Vorstand'
            : authStore.currentUser?.role === 'TEAM' ? 'Team'
            : 'Mitglied'
          }}</span>
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
