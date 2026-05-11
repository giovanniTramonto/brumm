<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const slug = computed(() => route.params.slug as string | undefined)

const navItems = computed(() => {
  if (!slug.value || !authStore.currentUser) return []
  const base = `/ini/${slug.value}`
  const items = [{ label: 'Dashboard', to: `${base}/dashboard` }]
  if (authStore.currentUser.role !== 'MEMBER') {
    items.push({ label: 'Kinder', to: `${base}/members` })
    items.push({ label: 'Gruppen', to: `${base}/groups` })
  }
  if (authStore.currentUser.role === 'SUPERUSER') {
    items.push({ label: 'Einstellungen', to: `${base}/settings` })
  }
  return items
})

async function onLogout() {
  if (!slug.value) return
  await authStore.logout(slug.value)
  await navigateTo('/register')
}
</script>

<template>
  <div class="min-h-screen bg-ini">
    <nav v-if="authStore.currentUser" class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center gap-8">
            <span class="text-lg font-semibold text-primary-700">
              {{ authStore.currentClub?.name ?? "Jita" }}
            </span>
            <div class="hidden gap-1 sm:flex">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                active-class="bg-primary-50 text-primary-700"
              >
                {{ item.label }}
              </NuxtLink>
            </div>
          </div>
          <button class="btn-secondary text-sm" @click="onLogout">Abmelden</button>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
