<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

const membersStore = useMembersStore()

const activeCount = computed(
  () => membersStore.members.filter((m) => m.status === 'ACTIVE' || m.status === 'INACTIVE').length,
)
const pendingCount = computed(
  () =>
    membersStore.members.filter((m) => m.status === 'PENDING_INVITE' || m.status === 'REGISTERED')
      .length,
)
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-3">
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
</template>
