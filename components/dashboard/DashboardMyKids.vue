<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

const props = defineProps<{ slug: string }>()
const membersStore = useMembersStore()
await membersStore.fetchMembers(props.slug)

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktiv',
  INACTIVE: 'Inaktiv',
  REGISTERED: 'Bestätigt',
  PENDING_INVITE: 'Ausstehend',
  DEACTIVATED: 'Abgemeldet',
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-orange-100 text-orange-700',
  REGISTERED: 'bg-blue-100 text-blue-800',
  PENDING_INVITE: 'bg-orange-100 text-orange-800',
  DEACTIVATED: 'bg-gray-100 text-gray-600',
}
</script>

<template>
  <div class="card mt-6">
    <h2 class="mb-3 text-sm font-medium text-gray-900">Anmeldung</h2>
    <template v-if="membersStore.members.some((m) => m.isOwnChild)">
      <ul class="-mx-4 -mb-4">
        <li
          v-for="child in membersStore.members.filter((m) => m.isOwnChild)"
          :key="child.id"
          class="flex items-center justify-between px-4 py-2.5 text-sm"
          :class="(child.status === 'REGISTERED' || child.status === 'PENDING_INVITE') ? 'bg-orange-50' : ''"
        >
          <div class="flex items-center gap-2">
            <NuxtLink :to="`/ini/${props.slug}/members/${child.id}`" class="text-primary-700 hover:text-primary-900">{{ child.firstName }} {{ child.lastName }} →</NuxtLink>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="STATUS_CLASS[child.status] ?? 'bg-gray-100 text-gray-600'"
            >{{ STATUS_LABEL[child.status] ?? child.status }}</span>
          </div>
          <NuxtLink
            v-if="child.status === 'REGISTERED' || child.status === 'PENDING_INVITE'"
            :to="`/ini/${props.slug}/members/${child.id}`"
            class="text-sm font-medium text-primary-700 hover:text-primary-900"
          >
            Anmeldung abschließen →
          </NuxtLink>
        </li>
      </ul>
    </template>
    <p v-else class="text-sm text-gray-500">Kein Kind angemeldet.</p>
  </div>
</template>
