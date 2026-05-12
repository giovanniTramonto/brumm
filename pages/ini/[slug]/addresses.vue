<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const membersStore = useMembersStore()

onMounted(async () => {
  await membersStore.fetchMembers(slug)
})

const activeMembers = computed(() => membersStore.members.filter((m) => m.isActive))
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Adressliste</h1>
    </div>

    <div v-if="membersStore.isLoading" class="text-sm text-gray-500" role="status" aria-live="polite">
      Brumm, brumm …
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th class="pb-3 pr-8 w-1/5">Kind</th>
            <th class="pb-3">Eltern</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="m in activeMembers" :key="m.id">
            <tr class="border-t border-gray-100">
              <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 font-medium text-gray-900 whitespace-nowrap align-middle">
                {{ m.firstName }} {{ m.lastName }}
              </td>
              <td class="pt-4 pb-1 text-gray-700">
                <div class="flex gap-6">
                  <span class="min-w-[33%] max-w-[33%]">{{ m.guardian1Name ?? '' }}</span>
                  <span class="min-w-[33%] max-w-[33%]">{{ m.email1 }}</span>
                  <span class="min-w-[33%] max-w-[33%]">{{ m.phone1 ?? '' }}</span>
                </div>
              </td>
            </tr>
            <tr v-if="m.guardian2Name || m.email2">
              <td class="pb-4 text-gray-700">
                <div class="flex gap-6">
                  <span class="min-w-[33%] max-w-[33%]">{{ m.guardian2Name ?? '' }}</span>
                  <span class="min-w-[33%] max-w-[33%]">{{ m.email2 ?? '' }}</span>
                  <span class="min-w-[33%] max-w-[33%]">{{ m.phone2 ?? '' }}</span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="activeMembers.length === 0" class="mt-4 text-sm text-gray-500">
        Keine aktiven Kinder vorhanden.
      </p>
    </div>
  </div>
</template>
