<script setup lang="ts">
import type { Group } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

const groups = ref<Group[]>([])
const isSubmitting = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  firstName: '',
  lastName: '',
  birthDate: '',
  guardian1Name: '',
  guardian2Name: '',
  email1: '',
  email2: '',
  groupId: '',
  contractEnd: '',
})

onMounted(async () => {
  const data = await $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`)
  groups.value = data.groups
})

async function onSubmit() {
  error.value = null
  isSubmitting.value = true
  try {
    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate,
      guardian1Name: form.guardian1Name.trim(),
      guardian2Name: form.guardian2Name.trim() || undefined,
      email1: form.email1.trim(),
      email2: form.email2.trim() || undefined,
      groupId: form.groupId || undefined,
      contractEnd: form.contractEnd.trim() || undefined,
    }
    const { user } = await $fetch<{ user: { id: string } }>(`/api/ini/${slug}/members/create`, {
      method: 'POST',
      body,
    })
    await navigateTo(`/ini/${slug}/members/${user.id}`)
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Anlegen'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Kind anlegen</h1>
    </div>

    <form class="card space-y-4" @submit.prevent="onSubmit">
      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Vorname *</label>
          <input v-model="form.firstName" type="text" class="input mt-1" required />
        </div>
        <div>
          <label class="label">Nachname *</label>
          <input v-model="form.lastName" type="text" class="input mt-1" required />
        </div>
      </div>

      <div>
        <label class="label">Geburtsdatum *</label>
        <input v-model="form.birthDate" type="date" class="input mt-1" required />
      </div>

      <div>
        <label class="label">Gruppe (optional)</label>
        <select v-model="form.groupId" class="input mt-1">
          <option value="">Keine Gruppe</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Erziehungsber. 1 *</label>
          <input v-model="form.guardian1Name" type="text" class="input mt-1" />
        </div>
        <div>
          <label class="label">E-Mail *</label>
          <input v-model="form.email1" type="email" class="input mt-1" required />
        </div>
      </div>

      <div>
        <label class="label">Vertragsende (optional)</label>
        <input v-model="form.contractEnd" type="text" class="input mt-1" placeholder="YYYY" maxlength="4" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Erziehungsber. 2 (optional)</label>
          <input v-model="form.guardian2Name" type="text" class="input mt-1" />
        </div>
        <div>
          <label class="label">E-Mail (optional)</label>
          <input v-model="form.email2" type="email" class="input mt-1" />
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wird angelegt…' : 'Anlegen & Einladung senden' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/members`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
