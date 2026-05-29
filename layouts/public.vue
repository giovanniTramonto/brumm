<script setup lang="ts">
const route = useRoute()

const navLinks = [
  { to: '/about', label: 'Über Brumm' },
  { to: '/guide', label: 'Anleitung' },
  { to: '/login', label: 'Login' },
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:ring-2 focus:ring-primary-500">Zum Inhalt springen</a>

    <header class="border-b border-gray-100">
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
          <span class="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">Beta-Version</span>
        </div>
        <nav aria-label="Hauptnavigation" class="flex items-center gap-6 text-sm">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :aria-current="route.path === link.to ? 'page' : undefined"
            :class="route.path === link.to ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'"
          >{{ link.label }}</NuxtLink>
          <NuxtLink
            to="/register"
            class="btn-primary text-sm"
            :aria-current="route.path === '/register' ? 'page' : undefined"
          >Registrieren</NuxtLink>
        </nav>
      </div>
    </header>

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
