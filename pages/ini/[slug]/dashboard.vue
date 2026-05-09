<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

onMounted(async () => {
  if (authStore.currentUser?.role !== 'MEMBER') {
    await membersStore.fetchMembers(slug)
  }
})

const activeCount = computed(() => membersStore.members.filter((m) => m.isActive).length)
const pendingCount = computed(() => membersStore.members.filter((m) => !m.isActive).length)
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">
        Willkommen, {{ authStore.currentUser?.firstName }}
      </h1>
      <p class="mt-1 text-gray-600">{{ authStore.currentClub?.name }}</p>
    </div>

    <div v-if="authStore.currentUser?.role !== 'MEMBER'" class="grid gap-6 sm:grid-cols-3">
      <div class="card">
        <p class="text-sm font-medium text-gray-500">Aktive Mitglieder</p>
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

    <div v-else class="card mt-4">
      <h2 class="font-semibold text-gray-900">Mein Profil</h2>
      <dl class="mt-4 space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Name</dt>
          <dd class="text-gray-900">
            {{ authStore.currentUser?.firstName }} {{ authStore.currentUser?.lastName }}
          </dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Status</dt>
          <dd :class="authStore.currentUser?.isActive ? 'text-green-700' : 'text-amber-600'">
            {{ authStore.currentUser?.isActive ? "Aktiv" : "Ausstehend" }}
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="pendingCount > 0 && authStore.currentUser?.role === 'SUPERUSER'" class="mt-6">
      <div class="rounded-md bg-amber-50 p-4">
        <p class="text-sm text-amber-800">
          <strong>{{ pendingCount }}</strong> Mitglied{{ pendingCount !== 1 ? "er" : "" }}
          warte{{ pendingCount !== 1 ? "n" : "t" }} auf Freischaltung.
        </p>
        <NuxtLink :to="`/ini/${slug}/members`" class="mt-2 inline-block text-sm font-medium text-amber-700 hover:text-amber-900">
          Zur Mitgliederliste →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
