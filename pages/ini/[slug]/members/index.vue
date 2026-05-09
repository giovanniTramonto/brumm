<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import type { Member } from '~/types'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'TEAM' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const search = ref('')
const isActivating = ref<string | null>(null)
const isDeactivating = ref<string | null>(null)

onMounted(() => membersStore.fetchMembers(slug))

const filteredMembers = computed(() => {
  const q = search.value.toLowerCase()
  return membersStore.members.filter(
    (m) => m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q),
  )
})

async function onActivate(member: Member) {
  isActivating.value = member.id
  try {
    await membersStore.activateMember(slug, member.id)
  } finally {
    isActivating.value = null
  }
}

async function onDeactivate(member: Member) {
  if (!confirm(`${member.firstName} ${member.lastName} wirklich abmelden?`)) return
  isDeactivating.value = member.id
  try {
    await membersStore.deactivateMember(slug, member.id)
  } finally {
    isDeactivating.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Mitglieder</h1>
      <div class="flex gap-3">
        <NuxtLink
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          :to="`/ini/${slug}/members/import`"
          class="btn-secondary"
        >
          CSV importieren
        </NuxtLink>
        <NuxtLink
          v-if="authStore.currentUser?.role === 'SUPERUSER'"
          :to="`/ini/${slug}/members/create`"
          class="btn-primary"
        >
          Mitglied anlegen
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

    <div v-if="membersStore.isLoading" class="py-12 text-center text-gray-500">Wird geladen…</div>

    <div v-else-if="filteredMembers.length === 0" class="py-12 text-center text-gray-500">
      Keine Mitglieder gefunden.
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
                :class="member.isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
              >
                {{ member.isActive ? "Aktiv" : "Ausstehend" }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div
                v-if="authStore.currentUser?.role === 'SUPERUSER'"
                class="flex justify-end gap-2"
              >
                <button
                  v-if="!member.isActive"
                  class="btn-primary py-1 text-xs"
                  :disabled="isActivating === member.id"
                  @click="onActivate(member)"
                >
                  Freischalten
                </button>
                <button
                  v-if="member.isActive"
                  class="btn-danger py-1 text-xs"
                  :disabled="isDeactivating === member.id"
                  @click="onDeactivate(member)"
                >
                  Abmelden
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
