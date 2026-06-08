<script setup lang="ts">
import { useTeamStore } from '~/stores/team'
import type { TeamMember } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const memberId = route.params.id as string
const teamStore = useTeamStore()

const member = ref<TeamMember | null>(null)
const form = reactive({ name: '', email: '' })
const isLoading = ref(true)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ member: TeamMember }>(`/api/ini/${slug}/team/${memberId}`)
    member.value = data.member
    form.name = data.member.name
    form.email = data.member.email
  } catch {
    error.value = 'Teammitglied nicht gefunden'
  } finally {
    isLoading.value = false
  }
})

async function onSubmit() {
  isSubmitting.value = true
  error.value = null
  try {
    await teamStore.updateTeamMember(slug, memberId, form)
    await navigateTo(`/ini/${slug}/team`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}

async function onDelete() {
  if (!confirm(`${member.value?.name} wirklich entfernen?`)) return
  isDeleting.value = true
  try {
    await teamStore.deleteTeamMember(slug, memberId)
    await navigateTo(`/ini/${slug}/team`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Löschen'
    isDeleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/team`" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">{{ member?.name ?? 'Teammitglied' }}</h1>
    </div>

    <LoadingBrumm v-if="isLoading" />

    <form v-else class="card max-w-lg" @submit.prevent="onSubmit">
      <div v-if="error" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ error }}
      </div>

      <div class="space-y-4">
        <div>
          <label for="name" class="label">Name</label>
          <input id="name" v-model="form.name" type="text" class="input" required />
        </div>
        <div>
          <label for="email" class="label">E-Mail</label>
          <input id="email" v-model="form.email" type="email" class="input" required />
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="flex gap-3">
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Wird gespeichert …' : 'Speichern' }}
          </button>
          <NuxtLink :to="`/ini/${slug}/team`" class="btn-secondary">Abbrechen</NuxtLink>
        </div>
        <button type="button" class="btn-danger" :disabled="isDeleting" @click="onDelete">
          {{ isDeleting ? 'Wird entfernt …' : 'Entfernen' }}
        </button>
      </div>
    </form>
  </div>
</template>
