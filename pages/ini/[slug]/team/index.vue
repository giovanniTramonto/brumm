<script setup lang="ts">
import { useTeamStore } from '~/stores/team'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const teamStore = useTeamStore()

onMounted(async () => {
  await teamStore.fetchTeam(slug)
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Team</h1>
      <NuxtLink :to="`/ini/${slug}/team/create`" class="btn-primary">
        Teammitglied hinzufügen
      </NuxtLink>
    </div>

    <LoadingBrumm v-if="teamStore.isLoading" />

    <StoreError v-else-if="teamStore.error" :error="teamStore.error" :slug="slug" />

    <div v-else class="card">
      <ul v-if="teamStore.team.length > 0" role="list" class="divide-y divide-gray-100">
        <li
          v-for="m in teamStore.team"
          :key="m.id"
          class="flex items-center justify-between py-4"
        >
          <div>
            <p class="font-medium text-gray-900">{{ m.name }}</p>
            <p class="mt-0.5 text-sm text-gray-500">{{ m.email }}</p>
          </div>
          <NuxtLink :to="`/ini/${slug}/team/${m.id}`" class="btn-secondary text-sm">
            Bearbeiten
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="text-sm text-gray-500">Noch keine Teammitglieder eingetragen.</p>
    </div>
  </div>
</template>
