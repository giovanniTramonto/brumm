<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import type { User } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const memberId = route.params.id as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const member = ref<User | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const isDeactivating = ref(false)

onMounted(async () => {
  try {
    const data = await $fetch<{ member: User }>(`/api/ini/${slug}/members/${memberId}`)
    member.value = data.member
  } catch {
    error.value = 'Mitglied nicht gefunden'
  } finally {
    isLoading.value = false
  }
})

async function onActivate() {
  if (!member.value) return
  await membersStore.activateMember(slug, member.value.id)
  member.value = { ...member.value, isActive: true }
}

async function onDeactivate() {
  if (!member.value || !confirm(`${member.value.firstName} ${member.value.lastName} wirklich abmelden?`)) return
  isDeactivating.value = true
  try {
    await membersStore.deactivateMember(slug, member.value.id)
    await navigateTo(`/ini/${slug}/members`)
  } finally {
    isDeactivating.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Mitglied</h1>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-500">Wird geladen…</div>
    <div v-else-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

    <template v-else-if="member">
      <div class="card space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">
              {{ member.firstName }} {{ member.lastName }}
            </h2>
            <p v-if="member.group" class="text-sm text-gray-500">{{ member.group.name }}</p>
          </div>
          <span
            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            :class="member.isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
          >
            {{ member.isActive ? 'Aktiv' : 'Ausstehend' }}
          </span>
        </div>

        <dl class="space-y-2 text-sm">
          <div class="flex gap-2">
            <dt class="w-40 text-gray-500">Geburtsdatum</dt>
            <dd class="text-gray-900">{{ new Date(member.birthDate).toLocaleDateString('de-DE') }}</dd>
          </div>
          <div v-if="member.guardian1Name" class="flex gap-2">
            <dt class="w-40 text-gray-500">Erziehungsber. 1</dt>
            <dd class="text-gray-900">{{ member.guardian1Name }}</dd>
          </div>
          <div v-if="member.guardian2Name" class="flex gap-2">
            <dt class="w-40 text-gray-500">Erziehungsber. 2</dt>
            <dd class="text-gray-900">{{ member.guardian2Name }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-40 text-gray-500">Storage Ref</dt>
            <dd class="font-mono text-xs text-gray-600">{{ member.storageRef ?? '–' }}</dd>
          </div>
        </dl>

        <div v-if="authStore.currentUser?.role === 'SUPERUSER'" class="flex gap-3 pt-2">
          <button
            v-if="!member.isActive"
            class="btn-primary text-sm"
            @click="onActivate"
          >
            Freischalten
          </button>
          <button
            v-if="member.isActive"
            class="btn-danger text-sm"
            :disabled="isDeactivating"
            @click="onDeactivate"
          >
            Abmelden
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
