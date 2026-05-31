<script setup lang="ts">
const route = useRoute()

const navLinks = [
  { to: '/about', label: 'Über Brumm' },
  { to: '/guide', label: 'Anleitung' },
  { to: '/login', label: 'Anmelden' },
]

const isMenuOpen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') isMenuOpen.value = false
}

function onBreakpoint(e: MediaQueryListEvent) {
  if (e.matches) isMenuOpen.value = false
}

let mql: MediaQueryList | null = null

onMounted(() => {
  mql = window.matchMedia('(min-width: 768px)')
  mql.addEventListener('change', onBreakpoint)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  mql?.removeEventListener('change', onBreakpoint)
  document.removeEventListener('keydown', onKeydown)
})

watch(
  () => route.path,
  () => {
    isMenuOpen.value = false
  },
)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white pt-16">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:ring-2 focus:ring-primary-500">Zum Inhalt springen</a>

    <header class="fixed top-0 left-0 right-0 z-20 border-b border-gray-100 bg-white">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="flex items-center gap-2 text-lg font-semibold text-primary-700" aria-label="Brumm – zur Startseite">
            <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="22" cy="26" r="15" fill="#ffdd76"/>
              <circle cx="78" cy="26" r="15" fill="#ffdd76"/>
              <circle cx="50" cy="60" r="36" fill="#ffdd76"/>
            </svg>
            Brumm
          </NuxtLink>
          <span class="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">Pilotphase</span>
        </div>

        <nav
          id="main-nav"
          aria-label="Hauptnavigation"
          class="text-sm"
          :class="isMenuOpen
            ? 'flex flex-col absolute left-0 right-0 top-16 z-10 border-b border-gray-100 bg-white px-6 py-4 gap-3'
            : 'hidden tablet:flex items-center gap-6'"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :aria-current="route.path === link.to ? 'page' : undefined"
            :class="route.path === link.to ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'"
          >{{ link.label }}</NuxtLink>
          <NuxtLink
            to="/register"
            class="btn-primary text-sm w-fit"
            :aria-current="route.path === '/register' ? 'page' : undefined"
          >Registrieren</NuxtLink>
        </nav>

        <!-- Burger button -->
        <button
          class="tablet:hidden flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          :aria-expanded="isMenuOpen"
          aria-controls="main-nav"
          :aria-label="isMenuOpen ? 'Menü schließen' : 'Menü öffnen'"
          type="button"
          @click="isMenuOpen = !isMenuOpen"
        >
          <svg v-if="!isMenuOpen" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </header>

    <div
      v-if="isMenuOpen"
      class="tablet:hidden fixed inset-0 top-16 z-[9] bg-black/20"
      aria-hidden="true"
      @click="isMenuOpen = false"
    />

    <slot />

    <footer class="mt-auto border-t border-gray-100">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-xs text-gray-400">
        <span>© {{ new Date().getFullYear() }} Brumm</span>
        <nav aria-label="Rechtliches" class="flex gap-4">
          <NuxtLink to="/faq" class="hover:text-gray-600">FAQ</NuxtLink>
          <NuxtLink to="/legal" class="hover:text-gray-600">Impressum</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-gray-600">Datenschutz</NuxtLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
