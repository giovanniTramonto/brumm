<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

const props = defineProps<{ slug: string }>()
const membersStore = useMembersStore()
</script>

<template>
  <div class="card mt-6">
    <h2 class="mb-3 text-sm font-medium text-gray-900">Anmeldung</h2>
    <LoadingBrumm v-if="membersStore.isLoading" />
    <template v-else-if="membersStore.members.length > 0">
      <div v-for="child in membersStore.members" :key="child.id" class="mb-2 last:mb-0">
        <div v-if="child.status === 'ACTIVE' || child.status === 'INACTIVE'" class="rounded-md bg-green-50 p-3 text-sm text-green-800">
          <strong>{{ child.firstName }} {{ child.lastName }}</strong> ist aktiv und für die Betreuung freigeschaltet.
        </div>
        <div v-else-if="child.status === 'DEACTIVATED'" class="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <strong>{{ child.firstName }} {{ child.lastName }}</strong> wurde abgemeldet.
        </div>
        <div v-else class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p><strong>{{ child.firstName }} {{ child.lastName }}</strong> wurde bestätigt und wartet auf Freischaltung.</p>
          <p class="mt-1">
            Die Betreuung kann erst beginnen, wenn alle Vertragsunterlagen eingereicht wurden.
            <NuxtLink :to="`/ini/${props.slug}/members/${child.id}`" class="font-medium underline hover:no-underline">
              Hier kannst du die Unterlagen hochladen.
            </NuxtLink>
          </p>
        </div>
      </div>
    </template>
    <p v-else class="text-sm text-gray-500">Kein Kind angemeldet.</p>
    <NuxtLink :to="`/ini/${props.slug}/members`" class="mt-4 inline-block text-sm font-medium text-primary-700 hover:text-primary-900">
      Kinder & Unterlagen →
    </NuxtLink>
  </div>
</template>
