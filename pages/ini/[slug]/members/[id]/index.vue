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

type DocumentEntry = { id: string; name: string; createdTime: string | null }
const documents = ref<DocumentEntry[]>([])
const isLoadingDocs = ref(false)

type TemplateEntry = {
  id: string
  name: string
  documentType: string | null
  hasFile: boolean
  submission: { id: string; filename: string | null; uploadedAt: string; readAt: string | null; driveFileId: string | null } | null
}
const memberDocTemplates = ref<TemplateEntry[]>([])
const allSubmitted = ref(false)
const isLoadingTemplates = ref(false)
const uploadingTemplateId = ref<string | null>(null)
const uploadErrors = ref<Record<string, string>>({})
const submitted = ref(false)
const readMap = reactive<Record<string, boolean>>({})

const isMember = computed(() => authStore.currentUser?.role === 'MEMBER')
const canManageMembers = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
})
const isOwnChild = ref(false)

const localAllSubmitted = computed(() =>
  memberDocTemplates.value.every((t) => {
    if (t.documentType === 'read') return !!readMap[t.id]
    if (t.documentType === 'upload' && t.hasFile) return !!t.submission
    return true
  }),
)

const visibleTemplates = computed(() => {
  if (!member.value) return memberDocTemplates.value
  const frozen = member.value.isActive || !!member.value.deactivatedAt
  if (!frozen) return memberDocTemplates.value
  return memberDocTemplates.value.filter((t) => t.submission !== null)
})

function isDone(t: TemplateEntry): boolean {
  if (t.documentType === 'read') return !!readMap[t.id]
  if (t.documentType === 'upload') return !!t.submission
  return true
}

async function onMarkRead(templateId: string) {
  readMap[templateId] = true
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/member-documents/${templateId}/read`, {
      method: 'POST',
    })
    await loadMemberDocTemplates()
  } catch {
    readMap[templateId] = false
  }
}

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

async function loadDocuments() {
  isLoadingDocs.value = true
  try {
    const data = await $fetch<{ documents: DocumentEntry[] }>(`/api/ini/${slug}/members/${memberId}/documents`)
    documents.value = data.documents
  } catch {
    // ignore
  } finally {
    isLoadingDocs.value = false
  }
}

async function loadMemberDocTemplates() {
  isLoadingTemplates.value = true
  try {
    const data = await $fetch<{ templates: TemplateEntry[]; allSubmitted: boolean }>(
      `/api/ini/${slug}/members/${memberId}/member-documents`,
    )
    memberDocTemplates.value = data.templates
    allSubmitted.value = data.allSubmitted
    for (const t of data.templates) {
      if (t.documentType === 'read' && t.submission?.readAt) {
        readMap[t.id] = true
      }
    }
  } catch {
    // ignore
  } finally {
    isLoadingTemplates.value = false
  }
}

onMounted(async () => {
  try {
    const [memberData, groupsData, templatesData] = await Promise.all([
      $fetch<{ member: Member; isOwnChild: boolean }>(`/api/ini/${slug}/members/${memberId}`),
      canManageMembers.value ? $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`) : Promise.resolve(null),
      (isMember.value || canManageMembers.value)
        ? $fetch<{ templates: TemplateEntry[]; allSubmitted: boolean }>(`/api/ini/${slug}/members/${memberId}/member-documents`).catch(() => null)
        : Promise.resolve(null),
    ])

    member.value = memberData.member
    isOwnChild.value = memberData.isOwnChild
    if (groupsData) groups.value = groupsData.groups

    const m = memberData.member
    form.firstName = m.firstName
    form.lastName = m.lastName
    form.birthDate = m.birthDate.slice(0, 10)
    form.guardian1Name = m.guardian1Name ?? ''
    form.guardian2Name = m.guardian2Name ?? ''
    form.email1 = m.email1
    form.email2 = m.email2 ?? ''
    form.phone1 = m.phone1 ?? ''
    form.phone2 = m.phone2 ?? ''
    form.groupId = m.groupId ?? ''
    form.contractEnd = m.contractEnd ?? ''

    const isConfirmed = !m.isActive && !m.deactivatedAt && !m.hasPendingInvite

    if (templatesData && (canManageMembers.value || isConfirmed)) {
      memberDocTemplates.value = templatesData.templates
      allSubmitted.value = templatesData.allSubmitted
      for (const t of templatesData.templates) {
        if (t.documentType === 'read' && t.submission?.readAt) {
          readMap[t.id] = true
        }
      }
      isLoadingTemplates.value = false
    }

    if (m.isActive) await loadDocuments()
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
        phone1: form.phone1.trim() || undefined,
        phone2: form.phone2.trim() || undefined,
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
  await loadDocuments()
}

const isReactivating = ref(false)

async function onReactivate() {
  if (!member.value) return
  isReactivating.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/reactivate`, { method: 'POST' })
    member.value = { ...member.value, isActive: true, deactivatedAt: null }
    await loadDocuments()
  } finally {
    isReactivating.value = false
  }
}

async function onDeactivate() {
  if (
    !member.value ||
    !confirm('Vertrag abmelden? Automatische Löschung nach einem Jahr.')
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

async function onDeleteMember() {
  if (
    !member.value ||
    !confirm('Kind entfernen? Alle Daten werden gelöscht.')
  )
    return
  inviteActionError.value = null
  isCancellingInvite.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/delete`, { method: 'POST' })
    await navigateTo(`/ini/${slug}/members`)
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isCancellingInvite.value = false
  }
}

async function onUploadForTemplate(templateId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadErrors.value = { ...uploadErrors.value, [templateId]: '' }
  uploadingTemplateId.value = templateId
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    await $fetch(`/api/ini/${slug}/members/${memberId}/member-documents/${templateId}`, { method: 'POST', body })
    await loadMemberDocTemplates()
  } catch (err: unknown) {
    uploadErrors.value = {
      ...uploadErrors.value,
      [templateId]: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler',
    }
  } finally {
    uploadingTemplateId.value = null
    input.value = ''
  }
}

function onSubmit() {
  submitted.value = true
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900" aria-label="Zurück zur Kinderliste">
        ← Zurück
      </NuxtLink>
    </div>

    <div v-if="isLoading" role="status" aria-live="polite" class="py-12 text-gray-500">Wird geladen…</div>
    <div v-else-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

    <template v-else-if="member">
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold text-gray-900">{{ member.firstName }} {{ member.lastName }}</h1>
          <span
            role="status"
            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            :class="member.isActive ? 'bg-green-100 text-green-800' : member.deactivatedAt ? 'bg-gray-100 text-gray-600' : member.hasPendingInvite ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
          >
            {{ member.isActive ? 'Aktiv' : member.deactivatedAt ? 'Abgemeldet' : member.hasPendingInvite ? 'Ausstehend' : 'Bestätigt' }}
          </span>
        </div>

        <!-- canManageMembers: editable form -->
        <form v-if="canManageMembers" class="space-y-4" @submit.prevent="onSave">
          <div v-if="saveError" role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ saveError }}</div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="field-firstName" class="label">Vorname *</label>
              <input id="field-firstName" v-model="form.firstName" type="text" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" :required="!member.isActive" />
            </div>
            <div>
              <label for="field-lastName" class="label">Nachname *</label>
              <input id="field-lastName" v-model="form.lastName" type="text" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" :required="!member.isActive" />
            </div>
          </div>

          <div>
            <label for="field-birthDate" class="label">Geburtsdatum *</label>
            <input id="field-birthDate" v-model="form.birthDate" type="date" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" :required="!member.isActive" />
          </div>

          <div>
            <label for="field-groupId" class="label">Gruppe</label>
            <select id="field-groupId" v-model="form.groupId" class="input mt-1">
              <option value="">Keine Gruppe</option>
              <option v-for="group in groups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>

          <div>
            <label for="field-contractEnd" class="label">Vertragsende</label>
            <input id="field-contractEnd" v-model="form.contractEnd" type="text" class="input mt-1" placeholder="YYYY" maxlength="4" />
          </div>

          <div>
            <label for="field-guardian1Name" class="label">Erziehungsber. 1 *</label>
            <input id="field-guardian1Name" v-model="form.guardian1Name" type="text" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" :required="!member.isActive" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="field-email1" class="label">E-Mail 1 *</label>
              <input id="field-email1" v-model="form.email1" type="email" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" :required="!member.isActive" />
            </div>
            <div>
              <label for="field-phone1" class="label">Telefon 1</label>
              <input id="field-phone1" v-model="form.phone1" type="tel" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" />
            </div>
          </div>

          <div>
            <label for="field-guardian2Name" class="label">Erziehungsber. 2</label>
            <input id="field-guardian2Name" v-model="form.guardian2Name" type="text" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="field-email2" class="label">E-Mail 2</label>
              <input id="field-email2" v-model="form.email2" type="email" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" />
            </div>
            <div>
              <label for="field-phone2" class="label">Telefon 2</label>
              <input id="field-phone2" v-model="form.phone2" type="tel" class="input mt-1" :readonly="member.isActive || !!member.deactivatedAt" />
            </div>
          </div>

          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm" :disabled="isSubmitting">
              {{ isSubmitting ? 'Wird gespeichert…' : 'Speichern' }}
            </button>
          </div>
        </form>

        <!-- MEMBER: Aktiv → readonly data + documents -->
        <template v-else-if="isMember && member.isActive">
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
            <div v-if="member.contractEnd" class="flex gap-2">
              <dt class="w-40 text-gray-500">Vertragsende</dt>
              <dd class="text-gray-900">{{ member.contractEnd }}</dd>
            </div>
          </dl>

          <div class="border-t pt-4">
            <h3 class="mb-3 text-sm font-medium text-gray-900">Unterlagen</h3>
            <div v-if="isLoadingDocs" class="text-sm text-gray-500">Wird geladen…</div>
            <p v-else-if="documents.length === 0" class="text-sm text-gray-500">Keine Unterlagen hochgeladen.</p>
            <ul v-else class="space-y-1">
              <li
                v-for="doc in documents"
                :key="doc.id"
                class="flex items-center gap-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                {{ doc.name }}
              </li>
            </ul>
          </div>
        </template>

        <!-- MEMBER: Bestätigt → template-based upload list -->
        <template v-else-if="isMember && !member.isActive && !member.deactivatedAt && !member.hasPendingInvite">
          <div v-if="submitted" class="rounded-md bg-green-50 p-4 text-sm text-green-800">
            Ihre Unterlagen wurden erfolgreich eingereicht.
          </div>

          <template v-else>
            <p class="text-sm text-gray-600">
              Ihr Kind wartet auf Freischaltung. Bitte laden Sie alle erforderlichen Unterlagen hoch.
            </p>

            <div v-if="isLoadingTemplates" role="status" aria-live="polite" class="text-sm text-gray-500">Wird geladen…</div>

            <p v-else-if="memberDocTemplates.length === 0" class="text-sm text-gray-500">
              Noch keine Unterlagen konfiguriert.
            </p>

            <ul v-else class="divide-y divide-gray-100">
              <li v-for="t in visibleTemplates" :key="t.id" class="flex items-center gap-3 py-3">
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1"
                  :class="isDone(t) ? 'bg-green-100 text-green-600 ring-green-400' : 'bg-gray-50 text-gray-300 ring-gray-200'"
                  :aria-label="isDone(t) ? 'Erledigt' : 'Ausstehend'"
                  aria-hidden="false"
                ><span aria-hidden="true">✓</span></span>

                <span class="min-w-0 flex-1 text-sm text-gray-900">{{ t.name }}</span>

                <div class="flex shrink-0 items-center gap-2">
                  <template v-if="t.documentType === 'read'">
                    <button
                      v-if="!readMap[t.id]"
                      type="button"
                      class="btn-secondary py-1 text-xs"
                      @click="onMarkRead(t.id)"
                    >Gelesen markieren</button>
                    <span v-else class="btn-secondary py-1 text-xs bg-green-50 text-green-700 ring-green-400 pointer-events-none">✓ Gelesen</span>
                    <a v-if="t.submission?.driveFileId" :href="`/api/ini/${slug}/members/${memberId}/member-documents/${t.id}/download`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                    <a v-else-if="t.hasFile" :href="`/api/ini/${slug}/document-templates/${t.id}/file`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                  </template>

                  <template v-else-if="t.documentType === 'upload'">
                    <label class="btn-secondary cursor-pointer py-1 text-xs" :class="{ 'opacity-50': uploadingTemplateId === t.id }">
                      {{ uploadingTemplateId === t.id ? '…' : t.submission ? 'Ändern' : 'Hochladen' }}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        class="hidden"
                        :disabled="uploadingTemplateId === t.id"
                        @change="onUploadForTemplate(t.id, $event)"
                      />
                    </label>
                    <span v-if="uploadErrors[t.id]" role="alert" class="max-w-[120px] truncate text-xs text-red-600">{{ uploadErrors[t.id] }}</span>
                    <a v-if="t.hasFile" :href="`/api/ini/${slug}/document-templates/${t.id}/file`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                  </template>
                </div>
              </li>
            </ul>

            <div class="flex justify-end border-t pt-4">
              <button class="btn-primary text-sm" :disabled="!localAllSubmitted" @click="onSubmit">
                Einreichen
              </button>
            </div>
          </template>
        </template>

        <!-- TEAM or other: readonly data -->
        <dl v-else-if="!isMember" class="space-y-2 text-sm">
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

        <!-- canManageMembers: document overview -->
        <div v-if="canManageMembers" class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Unterlagen</h3>

          <div v-if="isLoadingTemplates || isLoadingDocs" role="status" aria-live="polite" class="text-sm text-gray-500">Wird geladen…</div>

          <!-- template submission status -->
          <template v-else-if="memberDocTemplates.length > 0">
            <ul class="divide-y divide-gray-100">
              <li v-for="t in visibleTemplates" :key="t.id" class="flex items-center gap-3 py-3">
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1"
                  :class="isDone(t) ? 'bg-green-100 text-green-600 ring-green-400' : 'bg-gray-50 text-gray-300 ring-gray-200'"
                  :aria-label="isDone(t) ? 'Erledigt' : 'Ausstehend'"
                  aria-hidden="false"
                ><span aria-hidden="true">✓</span></span>
                <span class="min-w-0 flex-1 text-sm text-gray-900">{{ t.name }}</span>
                <div class="flex shrink-0 items-center gap-2">
                  <template v-if="t.documentType === 'read'">
                    <button
                      v-if="isOwnChild && !member.isActive && !member.deactivatedAt && !readMap[t.id]"
                      type="button"
                      class="btn-secondary py-1 text-xs"
                      @click="onMarkRead(t.id)"
                    >Gelesen markieren</button>
                    <span v-else-if="readMap[t.id]" class="btn-secondary py-1 text-xs bg-green-50 text-green-700 ring-green-400 pointer-events-none">✓ Gelesen</span>
                    <span v-else role="button" aria-disabled="true" class="btn-secondary py-1 text-xs opacity-50 pointer-events-none">Gelesen markieren</span>
                    <a v-if="t.submission?.driveFileId" :href="`/api/ini/${slug}/members/${memberId}/member-documents/${t.id}/download`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                    <a v-else-if="t.hasFile" :href="`/api/ini/${slug}/document-templates/${t.id}/file`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                  </template>

                  <template v-if="t.documentType === 'upload'">
                    <label v-if="isOwnChild && !member.isActive && !member.deactivatedAt" class="btn-secondary cursor-pointer py-1 text-xs" :class="{ 'opacity-50': uploadingTemplateId === t.id }">
                      {{ uploadingTemplateId === t.id ? '…' : t.submission ? 'Ersetzen' : 'Hochladen' }}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        class="hidden"
                        :disabled="uploadingTemplateId === t.id"
                        @change="onUploadForTemplate(t.id, $event)"
                      />
                    </label>
                    <a v-if="t.submission" :href="`/api/ini/${slug}/members/${memberId}/member-documents/${t.id}/download`" class="btn-secondary py-1 text-xs" target="_blank" rel="noopener noreferrer">Ansehen ↗</a>
                    <span v-else role="link" aria-disabled="true" class="btn-secondary py-1 text-xs opacity-40 pointer-events-none">Ansehen ↗</span>
                  </template>
                </div>
              </li>
            </ul>
          </template>

          <!-- Aktiv: uploaded documents -->
          <ul v-else-if="documents.length > 0" class="space-y-1">
            <li v-for="doc in documents" :key="doc.id" class="flex items-center gap-2 text-sm text-gray-700">
              <span aria-hidden="true" class="text-gray-400">📄</span>
              {{ doc.name }}
            </li>
          </ul>

          <p v-else class="text-sm text-gray-500">Keine Unterlagen konfiguriert.</p>
        </div>

        <div v-if="!isMember" class="space-y-2 border-t pt-4">
          <div class="flex justify-end gap-3">
            <button
              v-if="!member.isActive && !member.deactivatedAt"
              class="btn-primary text-sm"
              :disabled="!localAllSubmitted || !canManageMembers"
              @click="onActivate"
            >
              Freischalten
            </button>
            <button
              v-if="!member.isActive && !member.deactivatedAt && member.hasPendingInvite"
              class="btn-secondary text-sm"
              :disabled="isResendingInvite || !canManageMembers"
              @click="onResendInvite"
            >
              {{ isResendingInvite ? 'Wird gesendet…' : 'Einladung erneut senden' }}
            </button>
            <button
              v-if="member.isActive"
              class="btn-secondary text-sm"
              :disabled="isDeactivating || !canManageMembers"
              @click="onDeactivate"
            >
              {{ isDeactivating ? 'Wird abgemeldet…' : 'Vertrag abmelden' }}
            </button>
            <button
              v-if="member.deactivatedAt"
              class="btn-secondary text-sm"
              :disabled="isReactivating || !canManageMembers"
              @click="onReactivate"
            >
              {{ isReactivating ? 'Wird reaktiviert…' : 'Abmeldung aufheben' }}
            </button>
            <button
              class="btn-danger text-sm"
              :disabled="isCancellingInvite || !canManageMembers"
              @click="onDeleteMember"
            >
              Kind entfernen
            </button>
          </div>
          <p v-if="inviteActionError" class="text-sm text-red-700">{{ inviteActionError }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
