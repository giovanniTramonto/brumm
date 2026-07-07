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

type NavItem = { label: string; to: string }
type NavSection = { label: string; items: NavItem[] }

const navSections = computed((): NavSection[] => {
  if (!slug.value || !currentUser.value) return []
  const base = `/ini/${slug.value}`
  const sections: NavSection[] = []

  if (canManageClub.value) {
    sections.push({
      label: 'Kinder & Eltern',
      items: [
        { label: 'Kinder', to: `${base}/members` },
        { label: 'Elternposten', to: `${base}/parent-jobs` },
      ],
    })
  }

  if (canManageClub.value) {
    sections.push({
      label: 'Personal',
      items: [{ label: 'Team', to: `${base}/team` }],
    })
  }

  if (canManageClub.value) {
    sections.push({
      label: 'Finanzen',
      items: [{ label: 'Berechnung', to: `${base}/calculations` }],
    })
  }

  if (isSuperUser.value) {
    sections.push({
      label: 'Admin',
      items: [
        { label: 'Gruppen', to: `${base}/groups` },
        { label: 'Vorstand', to: `${base}/managers` },
        { label: 'Einstellungen', to: `${base}/settings` },
      ],
    })
  }

  return sections
})

const memberNavItem = computed(() => {
  if ((!isMember.value && !isTeam.value) || !slug.value) return null
  return { label: 'Elternposten', to: `/ini/${slug.value}/parent-jobs` }
})

function isSectionActive(section: NavSection) {
  return section.items.some((item) => route.path.startsWith(item.to))
}

const openSection = ref<string | null>(null)

function toggleSection(label: string) {
  openSection.value = openSection.value === label ? null : label
}

watch(
  () => route.path,
  () => {
    openSection.value = null
  },
)

function onDocumentClick() {
  openSection.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') openSection.value = null
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeyDown)
})

const openMobileSections = ref<string[]>([])

function toggleMobileSection(label: string) {
  const idx = openMobileSections.value.indexOf(label)
  if (idx >= 0) openMobileSections.value.splice(idx, 1)
  else openMobileSections.value.push(label)
}

watch(isMenuOpen, (open) => {
  if (open) {
    openMobileSections.value = navSections.value
      .filter((s) => isSectionActive(s))
      .map((s) => s.label)
  }
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
          <div class="flex items-center gap-6">
            <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-lg font-semibold text-primary-700">
              {{ authStore.currentClub?.name ?? 'Brumm' }}
            </NuxtLink>

            <!-- Desktop nav -->
            <ul class="hidden list-none gap-1 tablet:flex" role="list">
              <!-- Member: direct link -->
              <li v-if="memberNavItem">
                <NuxtLink
                  :to="memberNavItem.to"
                  :class="[
                    'block rounded-md px-3 py-2 text-sm font-medium',
                    route.path.startsWith(memberNavItem.to)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  ]"
                >{{ memberNavItem.label }}</NuxtLink>
              </li>

              <!-- Sections -->
              <li
                v-for="section in navSections"
                :key="section.label"
                class="relative"
                @click.stop
              >
                <!-- Single item: direct link with section label -->
                <NuxtLink
                  v-if="section.items.length === 1"
                  :to="section.items[0].to"
                  :class="[
                    'block rounded-md px-3 py-2 text-sm font-medium',
                    isSectionActive(section)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  ]"
                >{{ section.label }}</NuxtLink>

                <!-- Multiple items: dropdown -->
                <template v-else>
                  <button
                    type="button"
                    :class="[
                      'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium',
                      isSectionActive(section)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    ]"
                    @click="toggleSection(section.label)"
                  >
                    {{ section.label }}
                    <AppIcon
                      name="chevron-down"
                      :class="['h-3 w-3 transition-transform duration-150', openSection === section.label ? 'rotate-180' : '']"
                    />
                  </button>
                  <div
                    v-if="openSection === section.label"
                    class="absolute left-0 top-full z-50 mt-1 min-w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    <NuxtLink
                      v-for="item in section.items"
                      :key="item.to"
                      :to="item.to"
                      :class="[
                        'block px-4 py-2 text-sm',
                        route.path.startsWith(item.to)
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-50',
                      ]"
                      @click="openSection = null"
                    >{{ item.label }}</NuxtLink>
                  </div>
                </template>
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
        class="border-t border-gray-100 px-4 py-3 tablet:hidden"
      >
        <ul class="flex flex-col gap-1" role="list">
          <!-- Member: direct link -->
          <li v-if="memberNavItem">
            <NuxtLink
              :to="memberNavItem.to"
              :class="[
                'block rounded-md px-3 py-2 text-sm font-medium',
                route.path.startsWith(memberNavItem.to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
            >{{ memberNavItem.label }}</NuxtLink>
          </li>

          <!-- Sections as accordions -->
          <li v-for="section in navSections" :key="section.label">
            <!-- Single item: direct link -->
            <NuxtLink
              v-if="section.items.length === 1"
              :to="section.items[0].to"
              :class="[
                'block rounded-md px-3 py-2 text-sm font-medium',
                isSectionActive(section)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
            >{{ section.label }}</NuxtLink>

            <!-- Multiple items: accordion -->
            <template v-else>
              <button
                type="button"
                :class="[
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium',
                  isSectionActive(section)
                    ? 'text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                ]"
                @click="toggleMobileSection(section.label)"
              >
                {{ section.label }}
                <AppIcon
                  name="chevron-down"
                  :class="['h-3 w-3 transition-transform duration-150', openMobileSections.includes(section.label) ? 'rotate-180' : '']"
                />
              </button>
              <ul
                v-if="openMobileSections.includes(section.label)"
                class="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-gray-200 pl-3"
                role="list"
              >
                <li v-for="item in section.items" :key="item.to">
                  <NuxtLink
                    :to="item.to"
                    :class="[
                      'block rounded-md px-3 py-1.5 text-sm',
                      route.path.startsWith(item.to)
                        ? 'text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    ]"
                  >{{ item.label }}</NuxtLink>
                </li>
              </ul>
            </template>
          </li>
        </ul>

        <div :class="navSections.length > 0 || memberNavItem ? 'mt-3 border-t border-gray-100 pt-3' : ''" class="flex items-center justify-between">
          <span class="text-sm text-gray-500">{{ roleLabel }}</span>
          <button class="btn-secondary text-sm" @click="onLogout">Abmelden</button>
        </div>
      </div>
    </nav>

    <NavOverlay :isOpen="isMenuOpen" @close="isMenuOpen = false" />

    <main class="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-nav {
  padding-top: env(safe-area-inset-top);
}
</style>
