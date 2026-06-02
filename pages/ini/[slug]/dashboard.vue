<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

onMounted(async () => {
  await membersStore.fetchMembers(slug)
})

const activeCount = computed(() => membersStore.members.filter((m) => m.isActive).length)
const pendingCount = computed(() => membersStore.members.filter((m) => !m.isActive).length)
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">
        Willkommen{{ authStore.currentUser?.firstName ? `, ${authStore.currentUser.firstName}` : '' }}!
      </h1>
    </div>

    <div v-if="authStore.currentUser?.role !== 'MEMBER'" class="grid gap-6 sm:grid-cols-3">
      <div class="card">
        <p class="text-sm font-medium text-gray-500">Aktive Kinder</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ activeCount }}</p>
      </div>
      <div class="card">
        <p class="text-sm font-medium text-gray-500">Ausstehend</p>
        <p class="mt-2 text-3xl font-bold text-amber-600">{{ pendingCount }}</p>
      </div>
      <div class="card">
        <p class="text-sm font-medium text-gray-500">Gesamt</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ membersStore.members.length }}</p>
      </div>
    </div>

    <div v-if="authStore.currentUser?.role === 'MEMBER'" class="card mt-6">
      <h2 class="mb-3 text-sm font-medium text-gray-900">Anmeldung</h2>
      <p v-if="membersStore.isLoading" class="text-sm text-gray-500">Daten werden geladen…</p>
      <template v-else-if="membersStore.members.length > 0">
        <div v-for="child in membersStore.members" :key="child.id" class="mb-2 last:mb-0">
          <div v-if="child.isActive" class="rounded-md bg-green-50 p-3 text-sm text-green-800">
            <strong>{{ child.firstName }} {{ child.lastName }}</strong> ist aktiv und für die Betreuung freigeschaltet.
          </div>
          <div v-else-if="child.deactivatedAt" class="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            <strong>{{ child.firstName }} {{ child.lastName }}</strong> wurde abgemeldet.
          </div>
          <div v-else class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <p><strong>{{ child.firstName }} {{ child.lastName }}</strong> wurde bestätigt und wartet auf Freischaltung.</p>
            <p class="mt-1">
              Die Betreuung kann erst beginnen, wenn alle Vertragsunterlagen eingereicht wurden.
              <NuxtLink :to="`/ini/${slug}/members/${child.id}`" class="font-medium underline hover:no-underline">
                Hier kannst du die Unterlagen hochladen.
              </NuxtLink>
            </p>
          </div>
        </div>
      </template>
      <p v-else class="text-sm text-gray-500">Kein Kind angemeldet.</p>
    </div>

    <div v-if="pendingCount > 0 && authStore.currentUser?.role === 'SUPERUSER'" class="mt-6">
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

    <div class="card mt-6">
      <h2 class="mb-3 text-sm font-medium text-gray-900">Aktuell</h2>
      <NuxtLink :to="`/ini/${slug}/addresses`" class="text-sm font-medium text-primary-700 hover:text-primary-900">
        Adressliste →
      </NuxtLink>
    </div>
  </div>
</template>
