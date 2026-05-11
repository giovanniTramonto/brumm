<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import type { Group, Member } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const memberId = route.params.id as string
const authStore = useAuthStore()
const membersStore = useMembersStore()

const member = ref<Member | null>(null)
const groups = ref<Group[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSubmitting = ref(false)
const saveError = ref<string | null>(null)
const isDeactivating = ref(false)
const isResendingInvite = ref(false)
const isCancellingInvite = ref(false)
const inviteActionError = ref<string | null>(null)

const isSuperUser = computed(() => authStore.currentUser?.role === 'SUPERUSER')

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
  try {
    const [memberData, groupsData] = await Promise.all([
      $fetch<{ member: Member }>(`/api/ini/${slug}/members/${memberId}`),
      $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`),
    ])
    member.value = memberData.member
    groups.value = groupsData.groups
    const m = memberData.member
    form.firstName = m.firstName
    form.lastName = m.lastName
    form.birthDate = m.birthDate.slice(0, 10)
    form.guardian1Name = m.guardian1Name ?? ''
    form.guardian2Name = m.guardian2Name ?? ''
    form.email1 = m.email1
    form.email2 = m.email2 ?? ''
    form.groupId = m.groupId ?? ''
    form.contractEnd = m.contractEnd ?? ''
  } catch {
    error.value = 'Kind nicht gefunden'
  } finally {
    isLoading.value = false
  }
})

async function onSave() {
  saveError.value = null
  isSubmitting.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/update`, {
      method: 'PATCH',
      body: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate,
        guardian1Name: form.guardian1Name.trim(),
        guardian2Name: form.guardian2Name.trim() || undefined,
        email1: form.email1.trim(),
        email2: form.email2.trim() || undefined,
        groupId: form.groupId || undefined,
        contractEnd: form.contractEnd.trim() || undefined,
      },
    })
    if (member.value) {
      member.value = { ...member.value, firstName: form.firstName.trim(), lastName: form.lastName.trim() }
    }
  } catch (err: unknown) {
    saveError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}

async function onActivate() {
  if (!member.value) return
  await membersStore.activateMember(slug, member.value.id)
  member.value = { ...member.value, isActive: true }
}

async function onDeactivate() {
  if (
    !member.value ||
    !confirm(`${member.value.firstName} ${member.value.lastName} wirklich abmelden?`)
  )
    return
  isDeactivating.value = true
  try {
    await membersStore.deactivateMember(slug, member.value.id)
    await navigateTo(`/ini/${slug}/members`)
  } finally {
    isDeactivating.value = false
  }
}

async function onResendInvite() {
  if (!member.value) return
  inviteActionError.value = null
  isResendingInvite.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/resend-invite`, { method: 'POST' })
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isResendingInvite.value = false
  }
}

async function onCancelInvite() {
  if (
    !member.value ||
    !confirm(`${member.value.firstName} ${member.value.lastName} wirklich abmelden und löschen?`)
  )
    return
  inviteActionError.value = null
  isCancellingInvite.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/cancel-invite`, { method: 'POST' })
    await navigateTo(`/ini/${slug}/members`)
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isCancellingInvite.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">Kind</h1>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-500">Wird geladen…</div>
    <div v-else-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

    <template v-else-if="member">
      <div class="card space-y-4">
        <div class="flex items-start justify-between">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ member.firstName }} {{ member.lastName }}
          </h2>
          <span
            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            :class="member.isActive ? 'bg-green-100 text-green-800' : member.deactivatedAt ? 'bg-gray-100 text-gray-600' : member.hasPendingInvite ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
          >
            {{ member.isActive ? 'Aktiv' : member.deactivatedAt ? 'Abgemeldet' : member.hasPendingInvite ? 'Ausstehend' : 'Bestätigt' }}
          </span>
        </div>

        <form v-if="isSuperUser" class="space-y-4" @submit.prevent="onSave">
          <div v-if="saveError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ saveError }}</div>

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

          <div>
            <label class="label">Vertragsende (optional)</label>
            <input v-model="form.contractEnd" type="text" class="input mt-1" placeholder="YYYY" maxlength="4" />
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

          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm" :disabled="isSubmitting">
              {{ isSubmitting ? 'Wird gespeichert…' : 'Speichern' }}
            </button>
          </div>
        </form>

        <dl v-else class="space-y-2 text-sm">
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
          <div v-if="member.contractEnd" class="flex gap-2">
            <dt class="w-40 text-gray-500">Vertragsende</dt>
            <dd class="text-gray-900">{{ member.contractEnd }}</dd>
          </div>
        </dl>

        <div v-if="isSuperUser" class="space-y-2 border-t pt-4">
          <div class="flex justify-end gap-3">
            <button
              v-if="!member.isActive && !member.deactivatedAt"
              class="btn-primary text-sm"
              @click="onActivate"
            >
              Freischalten
            </button>
            <button
              v-if="!member.isActive && !member.deactivatedAt && member.hasPendingInvite"
              class="btn-secondary text-sm"
              :disabled="isResendingInvite"
              @click="onResendInvite"
            >
              {{ isResendingInvite ? 'Wird gesendet…' : 'Einladung erneut senden' }}
            </button>
            <button
              v-if="!member.isActive"
              class="btn-danger text-sm"
              :disabled="isCancellingInvite"
              @click="onCancelInvite"
            >
              Kind abmelden
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
          <p v-if="inviteActionError" class="text-sm text-red-700">{{ inviteActionError }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
