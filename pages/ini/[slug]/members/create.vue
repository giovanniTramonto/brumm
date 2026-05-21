<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Group } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const groups = ref<Group[]>([])
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const created = ref<{ id: string; name: string } | null>(null)
const emailError = ref<string | null>(null)

const superUserEmails = computed(
  () => new Set((authStore.currentUser?.emails ?? []).map((e) => e.email.toLowerCase())),
)

const isSuperUserGuardian = computed(() => {
  const e1 = form.email1.trim().toLowerCase()
  const e2 = form.email2.trim().toLowerCase()
  const e1IsSuperUser = !!e1 && superUserEmails.value.has(e1)
  const e2IsSuperUser = !e2 || superUserEmails.value.has(e2)
  return e1IsSuperUser && e2IsSuperUser
})

const form = reactive({
  firstName: '',
  lastName: '',
  birthDate: '',
  guardian1Name: '',
  guardian2Name: '',
  email1: '',
  email2: '',
  phone1: '',
  phone2: '',
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
      phone1: form.phone1.trim() || undefined,
      phone2: form.phone2.trim() || undefined,
      groupId: form.groupId || undefined,
      contractEnd: form.contractEnd.trim() || undefined,
    }
    const res = await $fetch<{ user: { id: string }; emailError: string | null }>(
      `/api/ini/${slug}/members/create`,
      { method: 'POST', body },
    )
    created.value = { id: res.user.id, name: `${form.firstName} ${form.lastName}` }
    emailError.value = res.emailError
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Anlegen'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
    </div>

    <div v-if="created" class="card space-y-4">
      <h1 class="text-2xl font-bold text-gray-900">Kind angelegt</h1>
      <div class="rounded-md bg-green-50 p-3 text-sm text-green-700">
        Kind <span class="font-semibold">{{ created.name }}</span> wurde angelegt.
      </div>
      <div v-if="emailError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        Emails konnten nicht gesendet werden ({{ emailError }})
      </div>
      <div>
        <NuxtLink :to="`/ini/${slug}/members/${created.id}`" class="btn-primary">
          Kind ansehen
        </NuxtLink>
      </div>
    </div>

    <form v-else class="card space-y-4" @submit.prevent="onSubmit">
      <div v-if="isSuperUserGuardian" class="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
        Sie sind Erziehungsberechtigter dieses Kindes. Es wird keine Opt-In Email an Sie gesendet.
      </div>
      <h1 class="text-2xl font-bold text-gray-900">Kind anlegen</h1>
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
        <label class="label">Gruppe</label>
        <select v-model="form.groupId" class="input mt-1">
          <option value="">Keine Gruppe</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>

      <div>
        <label class="label">Vertragsende</label>
        <input v-model="form.contractEnd" type="text" class="input mt-1" placeholder="YYYY" maxlength="4" />
      </div>

      <div>
        <label class="label">Erziehungsber. 1 *</label>
        <input v-model="form.guardian1Name" type="text" class="input mt-1" required />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">E-Mail 1 *</label>
          <input v-model="form.email1" type="email" class="input mt-1" required />
        </div>
        <div>
          <label class="label">Telefon 1</label>
          <input v-model="form.phone1" type="tel" class="input mt-1" />
        </div>
      </div>

      <div>
        <label class="label">Erziehungsber. 2</label>
        <input v-model="form.guardian2Name" type="text" class="input mt-1" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">E-Mail 2</label>
          <input v-model="form.email2" type="email" class="input mt-1" />
        </div>
        <div>
          <label class="label">Telefon 2</label>
          <input v-model="form.phone2" type="tel" class="input mt-1" />
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wird angelegt…' : isSuperUserGuardian ? 'Anlegen' : 'Anlegen & Einladung senden' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/members`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
