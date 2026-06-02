<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useGroupsStore } from '~/stores/groups'
import type { Group } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const deletingGroupId = ref<string | null>(null)

onMounted(() => groupsStore.fetchGroups(slug))

async function onDeleteGroup(group: Group) {
  if (!confirm(`Gruppe „${group.name}" löschen?`)) return
  deletingGroupId.value = group.id
  try {
    await groupsStore.deleteGroup(slug, group.id)
  } finally {
    deletingGroupId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Gruppen</h1>
      <NuxtLink
        v-if="true /* TODO: restore SUPERUSER check */"
        :to="`/ini/${slug}/groups/create`"
        class="btn-primary"
      >
        Neue Gruppe
      </NuxtLink>
    </div>

    <div v-if="groupsStore.isLoading" class="py-12 text-gray-500">Brumm, brumm …</div>

    <StoreError v-else-if="groupsStore.error" :error="groupsStore.error" :slug="slug" />

    <div v-else-if="groupsStore.groups.length === 0" class="card">
      <p class="text-sm text-gray-500">Noch keine Gruppen vorhanden.</p>
    </div>

    <div v-else class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="group in groupsStore.groups" :key="group.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{{ group.name }}</td>
            <td class="px-4 py-3 text-right">
              <div v-if="true /* TODO: restore SUPERUSER check */" class="flex justify-end gap-2">
                <NuxtLink :to="`/ini/${slug}/groups/${group.id}`" class="btn-secondary py-1 text-xs">
                  Bearbeiten
                </NuxtLink>
                <button
                  class="btn-secondary py-1 text-xs text-red-600"
                  :disabled="deletingGroupId === group.id"
                  @click="onDeleteGroup(group)"
                >
                  Löschen
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
