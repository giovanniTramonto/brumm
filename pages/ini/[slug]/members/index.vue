<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'


definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const search = ref('')

onMounted(() => membersStore.fetchMembers(slug))

const filteredMembers = computed(() => {
  const q = search.value.toLowerCase()
  return membersStore.members.filter(
    (m) => m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q),
  )
})

</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Kinder</h1>
      <div class="flex gap-3">
        <NuxtLink
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          :to="`/ini/${slug}/document-templates`"
          class="btn-secondary"
        >
          Vorlagen
        </NuxtLink>
        <span
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          class="btn-secondary cursor-not-allowed opacity-50"
          aria-disabled="true"
          role="link"
        >
          CSV importieren
        </span>
        <NuxtLink
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          :to="`/ini/${slug}/members/create`"
          class="btn-primary"
        >
          Kind anlegen
        </NuxtLink>
      </div>
    </div>

    <div class="mb-4">
      <input
        v-model="search"
        type="search"
        class="input max-w-sm"
        placeholder="Suche nach Name…"
      />
    </div>

    <div v-if="membersStore.isLoading" class="py-12 text-gray-500">Wird geladen…</div>

    <div v-else-if="filteredMembers.length === 0" class="py-12 text-gray-500">
      Keine Kinder gefunden.
    </div>

    <div v-else class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Gruppe</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="member in filteredMembers" :key="member.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink :to="`/ini/${slug}/members/${member.id}`" class="font-medium text-gray-900 hover:text-primary-700">
                {{ member.lastName }}, {{ member.firstName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ member.group?.name ?? "–" }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="member.isActive ? 'bg-green-100 text-green-800' : member.deactivatedAt ? 'bg-gray-100 text-gray-600' : member.hasPendingInvite ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
              >
                {{ member.isActive ? "Aktiv" : member.deactivatedAt ? "Abgemeldet" : member.hasPendingInvite ? "Ausstehend" : "Bestätigt" }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <NuxtLink
                v-if="authStore.currentUser?.role === 'SUPERUSER'"
                :to="`/ini/${slug}/members/${member.id}`"
                class="btn-secondary py-1 text-xs"
              >
                Bearbeiten
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
