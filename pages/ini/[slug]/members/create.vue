<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Group } from '~/types'
import { CARE_TYPE_OPTIONS } from '~/utils/reimbursement'

const SURCHARGE_OPTIONS = [{ key: 'ndhs', label: 'NdHS' }]

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

const hasSuperUserEmail = computed(() => {
  const e1 = form.email1.trim().toLowerCase()
  const e2 = form.email2.trim().toLowerCase()
  return (!!e1 && superUserEmails.value.has(e1)) || (!!e2 && superUserEmails.value.has(e2))
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
  careType: '',
  contractEnd: '',
  address: '',
  surcharges: [] as string[],
  sendInvite: true,
})

const membersStore = useMembersStore()

const guardian1Fields = computed({
  get: () => ({ name: form.guardian1Name, email: form.email1, phone: form.phone1 }),
  set: (v) => {
    form.guardian1Name = v.name
    form.email1 = v.email
    form.phone1 = v.phone
  },
})

const guardian2Fields = computed({
  get: () => ({ name: form.guardian2Name, email: form.email2, phone: form.phone2 }),
  set: (v) => {
    form.guardian2Name = v.name
    form.email2 = v.email
    form.phone2 = v.phone
  },
})

const isNoInviteWorkflow = computed(() => !form.sendInvite)

onMounted(async () => {
  const [groupsData] = await Promise.all([
    $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`),
    membersStore.fetchMembers(slug),
  ])
  groups.value = groupsData.groups
})

async function onSubmit() {
  if (form.sendInvite && !isSuperUserGuardian.value) {
    if (!confirm('Kind anlegen und Einladung senden?')) return
  }
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
      careType: form.careType || undefined,
      contractEnd: form.contractEnd.trim() || undefined,
      address: form.address.trim() || undefined,
      surcharges: form.surcharges.length > 0 ? form.surcharges : undefined,
      sendInvite: form.sendInvite,
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
        <label class="label">Betreuungsumfang</label>
        <select v-model="form.careType" class="input mt-1">
          <option value="">Nicht angegeben</option>
          <option v-for="opt in CARE_TYPE_OPTIONS" :key="opt.key" :value="opt.key">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="label">Zuschläge</label>
        <div class="mt-1 flex flex-wrap gap-4">
          <label
            v-for="opt in SURCHARGE_OPTIONS"
            :key="opt.key"
            class="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              v-model="form.surcharges"
              type="checkbox"
              :value="opt.key"
              class="h-4 w-4 rounded border-gray-300"
            />
            {{ opt.label }}
          </label>
        </div>
      </div>

      <div>
        <label class="label">Vertragsende</label>
        <input v-model="form.contractEnd" type="text" class="input mt-1" placeholder="YYYY" maxlength="4" />
      </div>

      <GuardianField
        v-model="guardian1Fields"
        label="Erziehungsber. 1"
        fieldId="field-guardian-1"
        required
        :otherEmail="form.email2"
      />

      <GuardianField
        v-model="guardian2Fields"
        label="Erziehungsber. 2"
        fieldId="field-guardian-2"
        :otherEmail="form.email1"
      />

      <div>
        <label class="label">Adresse</label>
        <input v-model="form.address" type="text" class="input mt-1" />
      </div>

      <label v-if="!isSuperUserGuardian" class="flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.sendInvite" type="checkbox" class="h-4 w-4 rounded border-gray-300" />
        Einladung senden
      </label>

      <p v-if="isNoInviteWorkflow && !isSuperUserGuardian" class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Es wird keine E-Mail-Einladung versendet.
      </p>
      <p v-if="hasSuperUserEmail" class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Du bist Erziehungsberechtigter dieses Kindes. Das Kind wird beim Anlegen sofort bestätigt.
      </p>

      <div class="flex gap-3">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wird angelegt…' : 'Anlegen' }}
        </button>
        <NuxtLink :to="`/ini/${slug}/members`" class="btn-secondary">Abbrechen</NuxtLink>
      </div>
    </form>
  </div>
</template>
