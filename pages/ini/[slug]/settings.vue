<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'SUPERUSER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const reconnected = route.query.reconnected === '1'
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Einstellungen</h1>

    <div v-if="reconnected" class="rounded-md bg-green-50 p-3 text-sm text-green-700">
      Google Drive wurde erfolgreich neu verbunden.
    </div>

    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Verein</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Name</dt>
          <dd class="text-gray-900">{{ authStore.currentClub?.name }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Slug</dt>
          <dd class="font-mono text-gray-900">{{ authStore.currentClub?.slug }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Storage</dt>
          <dd class="text-gray-900">
            {{ authStore.currentClub?.storageType ?? "Nicht konfiguriert" }}
          </dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Setup</dt>
          <dd :class="authStore.currentClub?.isSetupDone ? 'text-green-700' : 'text-amber-600'">
            {{ authStore.currentClub?.isSetupDone ? "Abgeschlossen" : "Ausstehend" }}
          </dd>
        </div>
      </dl>
      <div class="flex gap-2 pt-2">
        <NuxtLink
          v-if="!authStore.currentClub?.isSetupDone"
          :to="`/ini/${slug}/onboarding`"
          class="btn-primary inline-block text-sm"
        >
          Jetzt einrichten
        </NuxtLink>
        <NuxtLink
          v-if="authStore.currentClub?.isSetupDone"
          :to="`/ini/${slug}/onboarding`"
          class="btn-secondary inline-block text-sm"
        >
          Datenspeicher ändern
        </NuxtLink>
      </div>
    </div>

    <div class="card space-y-4 border-red-200">
      <h2 class="font-semibold text-red-700">Gefahrenbereich</h2>
      <p class="text-sm text-gray-600">
        Den Verein und alle Daten unwiderruflich löschen.
      </p>
      <NuxtLink :to="`/ini/${slug}/settings/delete`" class="btn-danger inline-block text-sm">
        Verein löschen
      </NuxtLink>
    </div>
  </div>
</template>
