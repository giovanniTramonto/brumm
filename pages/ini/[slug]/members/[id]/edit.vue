<script setup lang="ts">
import type { Group, Member } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const memberId = route.params.id as string

const groups = ref<Group[]>([])
const isLoading = ref(true)
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
})

onMounted(async () => {
  const [memberData, groupsData] = await Promise.all([
    $fetch<{ member: Member }>(`/api/ini/${slug}/members/${memberId}`),
    $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`),
  ])
  const m = memberData.member
  form.firstName = m.firstName
  form.lastName = m.lastName
  form.birthDate = m.birthDate.slice(0, 10)
  form.guardian1Name = m.guardian1Name ?? ''
  form.guardian2Name = m.guardian2Name ?? ''
  form.email1 = m.email1
  form.email2 = m.email2 ?? ''
  form.groupId = m.groupId ?? ''
  groups.value = groupsData.groups
  isLoading.value = false
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
    }
    await $fetch(`/api/ini/${slug}/members/${memberId}/update`, {
      method: 'PATCH',
      body,
    })
    await navigateTo(`/ini/${slug}/members/${memberId}`)
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/members/${memberId}`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Kind bearbeiten</h1>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-500">Wird geladen…</div>

    <form v-else class="card space-y-4" @submit.prevent="onSubmit">
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
          <input v-model="form.guardian1Name" type="text" class="input mt-1" required />
        </div>
        <div>
          <label class="label">E-Mail *</label>
          <input v-model="form.email1" type="email" class="input mt-1" required />
        </div>
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
          {{ isSubmitting ? 'Wird gespeichert…' : 'Speichern' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/members/${memberId}`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
