<script setup lang="ts">
import { useManagersStore } from '~/stores/managers'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const managersStore = useManagersStore()

onMounted(async () => {
  await managersStore.fetchManagers(slug)
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Vorstand</h1>
      <NuxtLink :to="`/ini/${slug}/management/create`" class="btn-primary">
        Vorstand hinzufügen
      </NuxtLink>
    </div>

    <div v-if="managersStore.isLoading" class="text-sm text-gray-500" role="status" aria-live="polite">
      Brumm, brumm …
    </div>

    <div v-else class="card">
      <ul v-if="managersStore.managers.length > 0" role="list" class="divide-y divide-gray-100">
        <li
          v-for="m in managersStore.managers"
          :key="m.id"
          class="flex items-center justify-between py-4"
        >
          <div>
            <p class="font-medium text-gray-900">{{ m.name }}</p>
            <p class="mt-0.5 text-sm text-gray-500">
              {{ m.email }}
              <span v-if="m.isMemberManager" class="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                Kinderverwaltung
              </span>
            </p>
          </div>
          <NuxtLink :to="`/ini/${slug}/management/${m.id}`" class="btn-secondary text-sm">
            Bearbeiten
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="text-sm text-gray-500">Noch keine Vorstandsmitglieder eingetragen.</p>
    </div>
  </div>
</template>
