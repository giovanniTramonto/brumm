<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const search = ref('')

const canManageMembers = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
})

const showNoMemberManagerHint = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'MANAGER' && !user?.isMemberManager
})

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
      <div v-if="authStore.currentUser?.role !== 'MEMBER'" class="flex gap-3">
        <NuxtLink
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          :to="`/ini/${slug}/contract-templates`"
          class="btn-secondary"
        >
          Vertragsvorlagen
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
          v-if="canManageMembers"
          :to="`/ini/${slug}/members/create`"
          class="btn-primary"
        >
          Kind anlegen
        </NuxtLink>
        <span
          v-else
          class="btn-primary cursor-not-allowed opacity-50"
          aria-disabled="true"
          role="link"
        >
          Kind anlegen
        </span>
      </div>
    </div>

    <div v-if="showNoMemberManagerHint" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <template v-if="membersStore.hasAnyMemberManager">
        Kinder können nur von <span class="font-semibold">{{ membersStore.memberManagerNames.join(', ') }}</span> verwaltet werden.
      </template>
      <template v-else>
        Es gibt noch keinen Vorstand, der Zugriff auf die Kinderverwaltung hat. Frage beim Admin nach.
      </template>
    </div>

    <div class="mb-4">
      <input
        v-model="search"
        type="search"
        class="input max-w-sm"
        placeholder="Suche nach Name…"
      />
    </div>

    <div v-if="membersStore.isLoading" class="py-12 text-gray-500">Brumm, brumm …</div>

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
                :to="`/ini/${slug}/members/${member.id}`"
                class="btn-secondary py-1 text-xs"
              >
                Ansehen
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
