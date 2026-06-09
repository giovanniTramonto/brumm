<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useMembersStore } from '~/stores/members'
import type { Group, Member } from '~/types'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '~/utils/config'
import { CARE_TYPE_OPTIONS } from '~/utils/reimbursement'

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
const isReactivating = ref(false)
const isDisabling = ref(false)
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
  submission: {
    id: string
    filename: string | null
    uploadedAt: string
    readAt: string | null
    driveFileId: string | null
  } | null
}
const memberDocTemplates = ref<TemplateEntry[]>([])
const allSubmitted = ref(false)
const isLoadingTemplates = ref(false)
const uploadingTemplateId = ref<string | null>(null)
const uploadErrors = ref<Record<string, string>>({})
const submitted = ref(false)
const readMap = reactive<Record<string, boolean>>({})

const otherDocuments = ref<DocumentEntry[]>([])
const isLoadingOtherDocs = ref(false)
const isUploadingOtherDoc = ref(false)
const replacingOtherFileId = ref<string | null>(null)
const otherUploadError = ref<string | null>(null)
const otherReplaceError = ref<string | null>(null)
const otherReplaceErrorFileId = ref<string | null>(null)

const isUploadingContractDoc = ref(false)
const contractUploadError = ref<string | null>(null)

const { isMember, isTeam, canManageMembers } = storeToRefs(authStore)

const isKidDataLocked = computed(() => {
  if (!member.value) return false
  if (member.value.status === 'DEACTIVATED') return true
  if (!isMember.value) return false
  if (member.value.status === 'ACTIVE' || member.value.status === 'INACTIVE') return true
  return (
    member.value.status === 'REGISTERED' &&
    member.value.hasInvite &&
    member.value.hasSubmittedDocuments
  )
})

const isContactLocked = computed(() => {
  if (!member.value) return false
  return member.value.status === 'DEACTIVATED'
})

const deletionDate = computed(() => {
  if (!member.value?.deactivatedAt) return null
  const d = new Date(member.value.deactivatedAt)
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
})

const canInteractWithTemplates = computed(
  () =>
    (isMember.value || isOwnChild.value || !member.value?.hasInvite) &&
    member.value?.status !== 'ACTIVE' &&
    member.value?.status !== 'INACTIVE' &&
    member.value?.status !== 'DEACTIVATED',
)
const isOwnChild = ref(false)

const localAllSubmitted = computed(() =>
  memberDocTemplates.value.every((t) => {
    if (t.documentType === 'read') return !!readMap[t.id]
    if (t.documentType === 'upload' && t.hasFile) return !!t.submission
    if (t.documentType === 'submit') return !!t.submission
    return true
  }),
)

const visibleTemplates = computed(() => {
  if (!member.value) return memberDocTemplates.value
  if (canManageMembers.value) return memberDocTemplates.value
  const frozen =
    member.value.status === 'ACTIVE' ||
    member.value.status === 'INACTIVE' ||
    member.value.status === 'DEACTIVATED'
  if (!frozen) return memberDocTemplates.value
  return memberDocTemplates.value.filter((t) => t.submission !== null)
})

const filteredDocuments = computed(() => {
  const submittedIds = new Set(
    memberDocTemplates.value
      .map((t) => t.submission?.driveFileId)
      .filter((id): id is string => !!id),
  )
  return documents.value.filter((d) => !submittedIds.has(d.id))
})

function isDone(t: TemplateEntry): boolean {
  if (t.documentType === 'read') return !!readMap[t.id]
  if (t.documentType === 'upload' || t.documentType === 'submit') return !!t.submission
  return true
}

async function onMarkRead(templateId: string) {
  readMap[templateId] = true
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/contract/${templateId}/read`, {
      method: 'POST',
    })
    await loadMemberDocTemplates()
  } catch {
    readMap[templateId] = false
  }
}

const SURCHARGE_OPTIONS = [{ key: 'ndhs', label: 'NdHS' }]

const hasChanges = computed(() => {
  const m = member.value
  if (!m) return false
  return (
    form.firstName.trim() !== m.firstName ||
    form.lastName.trim() !== m.lastName ||
    form.birthDate !== m.birthDate.slice(0, 10) ||
    form.guardian1Name.trim() !== (m.guardian1Name ?? '') ||
    form.guardian2Name.trim() !== (m.guardian2Name ?? '') ||
    form.email1.trim().toLowerCase() !== m.email1.toLowerCase() ||
    (form.email2.trim().toLowerCase() || null) !== (m.email2?.toLowerCase() ?? null) ||
    (form.phone1.trim() || null) !== (m.phone1 ?? null) ||
    (form.phone2.trim() || null) !== (m.phone2 ?? null) ||
    (form.groupId || null) !== (m.groupId ?? null) ||
    (form.careType || null) !== (m.careType ?? null) ||
    form.surcharges.slice().sort().join(',') !== m.surcharges.slice().sort().join(',') ||
    (form.contractEnd.trim() || null) !== (m.contractEnd ?? null) ||
    (form.address.trim() || null) !== (m.address ?? null)
  )
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
  surcharges: [] as string[],
  contractEnd: '',

  address: '',
})

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

async function loadDocuments(silent = false) {
  if (!silent) isLoadingDocs.value = true
  try {
    const data = await $fetch<{ documents: DocumentEntry[] }>(
      `/api/ini/${slug}/members/${memberId}/documents`,
    )
    documents.value = data.documents
  } catch {
    // ignore
  } finally {
    if (!silent) isLoadingDocs.value = false
  }
}

async function loadOtherDocuments() {
  isLoadingOtherDocs.value = true
  try {
    const data = await $fetch<{ documents: DocumentEntry[] }>(
      `/api/ini/${slug}/members/${memberId}/documents/other`,
    )
    otherDocuments.value = data.documents
  } catch {
    // ignore
  } finally {
    isLoadingOtherDocs.value = false
  }
}

async function onUploadOtherDocument(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    otherUploadError.value = `Datei zu groß (max. ${MAX_UPLOAD_SIZE_LABEL})`
    input.value = ''
    return
  }
  otherUploadError.value = null
  isUploadingOtherDoc.value = true
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/other`, {
      method: 'POST',
      body,
    })
    await loadOtherDocuments()
  } catch (err: unknown) {
    otherUploadError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isUploadingOtherDoc.value = false
    input.value = ''
  }
}

async function onReplaceOtherDocument(fileId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    otherReplaceError.value = `Datei zu groß (max. ${MAX_UPLOAD_SIZE_LABEL})`
    otherReplaceErrorFileId.value = fileId
    input.value = ''
    return
  }
  otherReplaceError.value = null
  otherReplaceErrorFileId.value = null
  replacingOtherFileId.value = fileId
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/other/${fileId}`, {
      method: 'PATCH',
      body,
    })
    await loadOtherDocuments()
  } catch (err: unknown) {
    otherReplaceError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
    otherReplaceErrorFileId.value = fileId
  } finally {
    replacingOtherFileId.value = null
    input.value = ''
  }
}

async function onDeleteContractDocument(fileId: string) {
  if (!confirm('Datei unwiderruflich löschen?')) return
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/${fileId}`, { method: 'DELETE' })
    await loadDocuments(true)
  } catch {
    // ignore
  }
}

async function onDeleteOtherDocument(fileId: string) {
  if (!confirm('Datei unwiderruflich löschen?')) return
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/other/${fileId}`, {
      method: 'DELETE',
    })
    await loadOtherDocuments()
  } catch {
    // ignore
  }
}

async function onUploadContractDocument(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    contractUploadError.value = `Datei zu groß (max. ${MAX_UPLOAD_SIZE_LABEL})`
    input.value = ''
    return
  }
  contractUploadError.value = null
  isUploadingContractDoc.value = true
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents`, { method: 'POST', body })
    await loadDocuments(true)
  } catch (err: unknown) {
    contractUploadError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isUploadingContractDoc.value = false
    input.value = ''
  }
}

async function loadMemberDocTemplates() {
  isLoadingTemplates.value = true
  try {
    const data = await $fetch<{
      templates: TemplateEntry[]
      allSubmitted: boolean
    }>(`/api/ini/${slug}/members/${memberId}/documents/contract`)
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
  membersStore.fetchMembers(slug) // fire-and-forget: hint computed updates reactively when members arrive
  try {
    const [memberData, groupsData, templatesData] = await Promise.all([
      $fetch<{ member: Member; isOwnChild: boolean }>(`/api/ini/${slug}/members/${memberId}`),
      $fetch<{ groups: Group[] }>(`/api/ini/${slug}/groups`),
      $fetch<{ templates: TemplateEntry[]; allSubmitted: boolean }>(
        `/api/ini/${slug}/members/${memberId}/documents/contract`,
      ).catch(() => null),
    ])

    member.value = memberData.member
    isOwnChild.value = memberData.isOwnChild
    submitted.value = memberData.member.hasSubmittedDocuments
    groups.value = groupsData.groups

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
    form.careType = m.careType ?? ''
    form.surcharges = m.surcharges ?? []
    form.contractEnd = m.contractEnd ?? ''
    form.address = m.address ?? ''

    if (templatesData) {
      memberDocTemplates.value = templatesData.templates
      allSubmitted.value = templatesData.allSubmitted
      for (const t of templatesData.templates) {
        if (t.documentType === 'read' && t.submission?.readAt) {
          readMap[t.id] = true
        }
      }
    }

    if (m.status === 'ACTIVE' || m.status === 'INACTIVE')
      await Promise.all([loadDocuments(), loadOtherDocuments()])
    else if (!m.hasInvite || canManageMembers.value) await loadDocuments()
  } catch {
    error.value = 'Kind nicht gefunden'
  } finally {
    isLoading.value = false
  }
})

async function onSave() {
  const email1Changed =
    form.email1.trim().toLowerCase() !== (member.value?.email1 ?? '').toLowerCase()
  const email2Changed =
    (form.email2.trim().toLowerCase() || null) !== (member.value?.email2?.toLowerCase() ?? null)
  const willSendEmailNotification =
    member.value?.hasInvite ||
    member.value?.status === 'ACTIVE' ||
    member.value?.status === 'INACTIVE'
  if ((email1Changed || email2Changed) && willSendEmailNotification) {
    if (
      !confirm(
        'Die E-Mail-Adresse wurde geändert.\nDie betroffenen Adressen erhalten automatisch einen Hinweis.\n\nSpeichern und E-Mail-Hinweis versenden?',
      )
    )
      return
  }
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
        careType: canManageMembers.value ? form.careType || undefined : undefined,
        surcharges: canManageMembers.value ? form.surcharges : undefined,
        contractEnd: form.contractEnd.trim() || undefined,
        address: form.address.trim() || undefined,
        lastEditedAt: member.value?.lastEditedAt ?? null,
      },
    })
    const refreshed = await $fetch<{ member: Member; isOwnChild: boolean }>(
      `/api/ini/${slug}/members/${memberId}`,
    )
    member.value = refreshed.member
    isOwnChild.value = refreshed.isOwnChild
  } catch (err: unknown) {
    saveError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSubmitting.value = false
  }
}

async function onActivate() {
  if (!member.value) return
  if (
    !confirm(
      `${member.value.firstName} ${member.value.lastName} aktivieren?\nDie Erziehungsberechtigten erhalten eine Bestätigungs-E-Mail.`,
    )
  )
    return
  await membersStore.activateMember(slug, member.value.id)
  member.value = { ...member.value, status: 'ACTIVE', hasInvite: true }
  await loadDocuments()
}

async function onReactivate() {
  if (!member.value) return
  isReactivating.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/reactivate`, {
      method: 'POST',
    })
    member.value = { ...member.value, status: 'ACTIVE', deactivatedAt: null }
    await loadDocuments()
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isReactivating.value = false
  }
}

async function onToggleDisabled() {
  if (!member.value) return
  isDisabling.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/toggle-disabled`, { method: 'POST' })
    member.value = {
      ...member.value,
      status: member.value.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isDisabling.value = false
  }
}

async function onDeactivate() {
  if (!member.value || !confirm('Kind abmelden?')) return
  isDeactivating.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/deactivate`, { method: 'POST' })
    member.value = {
      ...member.value,
      status: 'DEACTIVATED',
      deactivatedAt: new Date().toISOString(),
    }
  } catch (err: unknown) {
    inviteActionError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler'
  } finally {
    isDeactivating.value = false
  }
}

async function onResendInvite() {
  if (!member.value) return
  inviteActionError.value = null
  isResendingInvite.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/resend-invite`, {
      method: 'POST',
    })
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
    !confirm(
      member.value.hasInvite
        ? 'Kind wirklich dauerhaft entfernen? Die Eltern erhalten eine E-Mail.'
        : 'Kind wirklich dauerhaft entfernen?',
    )
  )
    return
  inviteActionError.value = null
  isCancellingInvite.value = true
  try {
    await $fetch(`/api/ini/${slug}/members/${member.value.id}/delete`, {
      method: 'POST',
    })
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
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    uploadErrors.value = {
      ...uploadErrors.value,
      [templateId]: `Datei zu groß (max. ${MAX_UPLOAD_SIZE_LABEL})`,
    }
    input.value = ''
    return
  }
  uploadErrors.value = { ...uploadErrors.value, [templateId]: '' }
  uploadingTemplateId.value = templateId
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    await $fetch(`/api/ini/${slug}/members/${memberId}/documents/contract/${templateId}`, {
      method: 'POST',
      body,
    })
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

async function onSubmit() {
  if (!confirm('Unterlagen einreichen? Die Kita erhält eine Benachrichtigung.')) return
  try {
    await $fetch(`/api/ini/${slug}/members/${memberId}/submit`, { method: 'POST' })
    submitted.value = true
  } catch {
    // ignore
  }
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6">
      <NuxtLink
        :to="isMember || isTeam ? `/ini/${slug}/dashboard` : `/ini/${slug}/members`"
        class="text-sm text-gray-500 hover:text-gray-900"
        :aria-label="isMember || isTeam ? 'Zurück zum Dashboard' : 'Zurück zur Kinderliste'"
      >
        ← Zurück
      </NuxtLink>
    </div>

    <LoadingBrumm v-if="isLoading" />
    <div
      v-else-if="error"
      class="rounded-md bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <template v-else-if="member">
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold text-gray-900">
            {{ member.firstName }} {{ member.lastName }}
          </h1>
          <span
            role="status"
            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            :class="
              member.status === 'ACTIVE'
                ? 'bg-green-100 text-green-800'
                : member.status === 'INACTIVE'
                  ? 'bg-orange-100 text-orange-700'
                  : member.status === 'DEACTIVATED'
                    ? 'bg-gray-100 text-gray-600'
                    : member.status === 'PENDING_INVITE'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-blue-100 text-blue-800'
            "
          >
            {{
              member.status === 'ACTIVE'
                ? "Aktiv"
                : member.status === 'INACTIVE'
                  ? "Inaktiv"
                  : member.status === 'DEACTIVATED'
                    ? "Abgemeldet"
                    : member.status === 'PENDING_INVITE'
                      ? "Ausstehend"
                      : "Bestätigt"
            }}
          </span>
        </div>

        <p v-if="canManageMembers && !member.hasInvite && (member.status === 'PENDING_INVITE' || member.status === 'REGISTERED')" class="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-500">
          Kind wurde ohne Einladung angelegt.
        </p>

        <!-- canManageMembers or own MEMBER: editable form; TEAM: read-only -->
        <form
          v-if="canManageMembers || isMember || isTeam"
          :inert="isTeam"
          class="space-y-4"
          @submit.prevent="onSave"
        >
          <div
            v-if="saveError"
            role="alert"
            class="rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            {{ saveError }}
          </div>

          <div :inert="isKidDataLocked" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="field-firstName" class="label">Vorname *</label>
              <input
                id="field-firstName"
                v-model="form.firstName"
                type="text"
                class="input mt-1"
                :readonly="isKidDataLocked"
                :required="member.status !== 'ACTIVE' && member.status !== 'INACTIVE'"
              />
            </div>
            <div>
              <label for="field-lastName" class="label">Nachname *</label>
              <input
                id="field-lastName"
                v-model="form.lastName"
                type="text"
                class="input mt-1"
                :readonly="isKidDataLocked"
                :required="member.status !== 'ACTIVE' && member.status !== 'INACTIVE'"
              />
            </div>
          </div>

          <div>
            <label for="field-birthDate" class="label">Geburtsdatum *</label>
            <input
              id="field-birthDate"
              v-model="form.birthDate"
              type="date"
              class="input mt-1"
              :readonly="isKidDataLocked"
              :required="member.status !== 'ACTIVE' && member.status !== 'INACTIVE'"
            />
          </div>

          <div>
            <label for="field-groupId" class="label">Gruppe</label>
            <select
              id="field-groupId"
              v-model="form.groupId"
              class="input mt-1"
              :disabled="isKidDataLocked"
            >
              <option value="">Keine Gruppe</option>
              <option v-for="group in groups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>

          <div v-if="canManageMembers">
            <label for="field-careType" class="label">Betreuungsumfang</label>
            <select
              id="field-careType"
              v-model="form.careType"
              class="input mt-1"
              :disabled="isKidDataLocked"
            >
              <option value="">Nicht angegeben</option>
              <option v-for="opt in CARE_TYPE_OPTIONS" :key="opt.key" :value="opt.key">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div v-if="canManageMembers">
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
                  :disabled="isKidDataLocked"
                />
                {{ opt.label }}
              </label>
            </div>
          </div>

          <div>
            <label for="field-contractEnd" class="label">Vertragsende</label>
            <input
              id="field-contractEnd"
              v-model="form.contractEnd"
              type="text"
              class="input mt-1"
              placeholder="YYYY"
              maxlength="4"
              :readonly="isKidDataLocked"
            />
          </div>
          </div>

          <hr v-if="isMember && isKidDataLocked && !isContactLocked" class="border-gray-200" />

          <div :inert="isContactLocked" class="space-y-4">
            <GuardianField
              v-model="guardian1Fields"
              label="Erziehungsber. 1"
              fieldId="field-guardian-1"
              required
              :readonly="isContactLocked"
              :memberId="member.id"
              :originalEmail="member.email1"
              :otherEmail="form.email2"
            />

            <GuardianField
              v-model="guardian2Fields"
              label="Erziehungsber. 2"
              fieldId="field-guardian-2"
              :readonly="isContactLocked"
              :memberId="member.id"
              :originalEmail="member.email2 ?? undefined"
              :otherEmail="form.email1"
            />

            <div>
              <label for="field-address" class="label">Adresse</label>
              <input
                id="field-address"
                v-model="form.address"
                type="text"
                class="input mt-1"
                :readonly="isContactLocked"
              />
            </div>
          </div>


        <!-- MEMBER: Aktiv → documents -->
        <template v-if="!isTeam && isMember && (member.status === 'ACTIVE' || member.status === 'INACTIVE')">
          <div class="border-t pt-4">
            <h3 class="mb-3 text-sm font-medium text-gray-900">Vertragsunterlagen</h3>
            <LoadingBrumm v-if="isLoadingDocs" />
            <p v-else-if="documents.length === 0" class="text-sm text-gray-500">
              Keine Vertragsunterlagen hochgeladen.
            </p>
            <ul v-else class="space-y-1">
              <li
                v-for="doc in documents"
                :key="doc.id"
                class="flex items-center gap-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                <span class="flex-1">{{ doc.name }}</span>
                <a
                  :href="`/api/ini/${slug}/members/${memberId}/documents/${doc.id}/download`"
                  class="btn-secondary py-1 text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Ansehen ↗</a
                >
              </li>
            </ul>
          </div>

          <div class="border-t pt-4">
            <h3 class="mb-3 text-sm font-medium text-gray-900">Weitere Unterlagen</h3>
            <LoadingBrumm v-if="isLoadingOtherDocs" />
            <template v-else>
              <ul v-if="otherDocuments.length > 0" class="mb-3 space-y-1">
                <li
                  v-for="doc in otherDocuments"
                  :key="doc.id"
                  class="flex items-center gap-2 text-sm text-gray-700"
                >
                  <span aria-hidden="true" class="text-gray-400">📄</span>
                  <span class="flex-1">{{ doc.name }}</span>
                  <label
                    class="btn-secondary cursor-pointer py-1 text-xs"
                    :class="{ 'opacity-50': replacingOtherFileId === doc.id }"
                  >
                    {{ replacingOtherFileId === doc.id ? "Loading …" : "Ändern" }}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      class="hidden"
                      :disabled="replacingOtherFileId === doc.id"
                      @change="onReplaceOtherDocument(doc.id, $event)"
                    />
                  </label>
                  <span v-if="otherReplaceErrorFileId === doc.id && otherReplaceError" class="text-xs text-red-600">{{ otherReplaceError }}</span>
                  <a
                    :href="`/api/ini/${slug}/members/${memberId}/documents/other/${doc.id}/download`"
                    class="btn-secondary py-1 text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Ansehen ↗</a
                  >
                </li>
              </ul>
              <label
                class="btn-secondary cursor-pointer text-sm"
                :class="{ 'opacity-50': isUploadingOtherDoc }"
              >
                {{ isUploadingOtherDoc ? "Loading …" : "Datei hinzufügen" }}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="hidden"
                  :disabled="isUploadingOtherDoc"
                  @change="onUploadOtherDocument"
                />
              </label>
              <p v-if="otherUploadError" role="alert" class="mt-1 text-xs text-red-600">
                {{ otherUploadError }}
              </p>
            </template>
          </div>
        </template>

        <!-- MEMBER: Bestätigt → template-based upload list -->
        <template v-else-if="!isTeam && isMember && member.status === 'REGISTERED'">
          <div class="border-t pt-4">
            <div class="mb-3 flex items-center gap-3">
              <h3 class="text-sm font-medium text-gray-900">Vertragsunterlagen</h3>
              <span v-if="!member.hasInvite" class="text-xs text-gray-500">Die Unterlagen werden von der Kita hochgeladen</span>
              <span v-else-if="!localAllSubmitted" class="text-xs text-orange-600">Bitte vervollständige alle Unterlagen</span>
            </div>
          </div>

          <LoadingBrumm v-if="isLoadingTemplates" />

          <p v-else-if="memberDocTemplates.length === 0" class="rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
            Die Kita hat noch keine Vertragsunterlagen hinterlegt.
          </p>

          <template v-else-if="submitted">
            <ul class="divide-y divide-gray-100">
              <li
                v-for="t in memberDocTemplates.filter(t => t.submission)"
                :key="t.id"
                class="flex items-center gap-2 py-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                <span class="flex-1">{{ t.submission?.filename ?? t.name }}</span>
                <a
                  :href="`/api/ini/${slug}/members/${memberId}/documents/contract/${t.id}/download`"
                  class="btn-secondary py-1 text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                >Ansehen ↗</a>
              </li>
            </ul>
            <p class="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              Unterlagen wurden erfolgreich eingereicht. Du erhältst eine E-Mail, sobald dein Kind aktiviert wurde.
            </p>
          </template>

          <p v-if="!member.hasInvite" class="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            Du erhältst eine E-Mail, sobald dein Kind aktiviert wurde.
          </p>

        </template>

        <!-- TEAM or other: readonly data -->
        <dl v-else-if="!isMember && !canManageMembers && !isTeam" class="space-y-2 text-sm">
          <div class="flex gap-2">
            <dt class="w-40 text-gray-500">Geburtsdatum</dt>
            <dd class="text-gray-900">
              {{ new Date(member.birthDate).toLocaleDateString("de-DE") }}
            </dd>
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
          <div class="mb-3 flex items-center gap-3">
            <h3 class="text-sm font-medium text-gray-900">Vertragsunterlagen</h3>
            <span
              v-if="!member.hasInvite && member.status === 'REGISTERED'"
              class="text-xs text-gray-500"
            >Unterlagen können direkt hochgeladen werden</span>
            <span
              v-else-if="member.hasInvite && member.status === 'REGISTERED' && !member.hasSubmittedDocuments && !isOwnChild"
              class="text-xs text-orange-600"
            >Noch nicht fertig eingereicht</span>
          </div>

          <LoadingBrumm v-if="isLoadingTemplates || isLoadingDocs" />

          <!-- Aktiv oder Abgemeldet: nur hochgeladene Dateien anzeigen -->
          <template v-else-if="member.status === 'ACTIVE' || member.status === 'INACTIVE' || member.status === 'DEACTIVATED'">
            <ul v-if="documents.length > 0" class="divide-y divide-gray-100">
              <li
                v-for="doc in documents"
                :key="doc.id"
                class="flex items-center gap-2 py-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                <span class="flex-1">{{ doc.name }}</span>
                <a
                  :href="`/api/ini/${slug}/members/${memberId}/documents/${doc.id}/download`"
                  class="btn-secondary py-1 text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                >Ansehen ↗</a>
              </li>
            </ul>
            <p v-else class="text-sm text-gray-500">Keine Vertragsunterlagen hochgeladen.</p>
          </template>

          <!-- No invite: direct upload by canManageMembers -->
          <template v-else-if="!member.hasInvite">
            <ul v-if="documents.length > 0" class="mb-3 divide-y divide-gray-100">
              <li
                v-for="doc in documents"
                :key="doc.id"
                class="flex items-center gap-2 py-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                <span class="flex-1">{{ doc.name }}</span>
                <a
                  :href="`/api/ini/${slug}/members/${memberId}/documents/${doc.id}/download`"
                  class="btn-secondary py-1 text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                >Ansehen ↗</a>
                <button type="button" class="btn-secondary py-1 text-xs text-red-600" @click="onDeleteContractDocument(doc.id)">Löschen</button>
              </li>
            </ul>
            <div class="flex items-center gap-3">
              <label
                class="btn-secondary cursor-pointer text-sm"
                :class="{ 'opacity-50': isUploadingContractDoc }"
              >
                {{ isUploadingContractDoc ? 'Loading …' : 'Datei hinzufügen' }}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="hidden"
                  :disabled="isUploadingContractDoc"
                  @change="onUploadContractDocument"
                />
              </label>
              <span v-if="contractUploadError" class="text-xs text-red-600">{{ contractUploadError }}</span>
            </div>
          </template>

          <p v-else-if="memberDocTemplates.length === 0" class="rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">Noch keine Vertragsvorlagen konfiguriert – <NuxtLink :to="`/ini/${slug}/contract-templates`" class="font-medium underline">Jetzt anlegen →</NuxtLink></p>

          <!-- Directly uploaded documents (e.g. no-invite flow), not covered by templates, shown alongside template list before activation -->
          <ul v-if="filteredDocuments.length > 0 && member.hasInvite && member.status === 'REGISTERED'" class="mt-2 divide-y divide-gray-100">
            <li
              v-for="doc in filteredDocuments"
              :key="doc.id"
              class="flex items-center gap-2 py-2 text-sm text-gray-700"
            >
              <span aria-hidden="true" class="text-gray-400">📄</span>
              <span class="flex-1">{{ doc.name }}</span>
              <a
                :href="`/api/ini/${slug}/members/${memberId}/documents/${doc.id}/download`"
                class="btn-secondary py-1 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >Ansehen ↗</a>
            </li>
          </ul>
        </div>

        <!-- Shared template list: MEMBER (Bestätigt, vor Einreichen) + canManageMembers (pre-activation, invite) -->
        <template
          v-if="
            memberDocTemplates.length > 0 &&
            member.status === 'REGISTERED' &&
            member.hasInvite &&
            (!submitted || canManageMembers) &&
            (isMember || canManageMembers)
          "
        >
          <ul class="divide-y divide-gray-100">
            <li
              v-for="t in visibleTemplates"
              :key="t.id"
              class="flex items-center gap-3 py-3"
            >
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
                    v-if="canInteractWithTemplates && !readMap[t.id]"
                    type="button"
                    class="btn-secondary py-1 text-xs"
                    @click="onMarkRead(t.id)"
                  >
                    Als gelesen markieren
                  </button>
                  <span
                    v-if="readMap[t.id]"
                    class="btn-secondary py-1 text-xs bg-green-50 text-green-700 ring-green-400 pointer-events-none"
                  >✓ Gelesen</span>
                  <a
                    v-if="t.submission?.driveFileId"
                    :href="`/api/ini/${slug}/members/${memberId}/documents/contract/${t.id}/download`"
                    class="btn-secondary py-1 text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Ansehen ↗</a>
                  <a
                    v-else-if="t.hasFile && canInteractWithTemplates"
                    :href="`/api/ini/${slug}/contract-templates/${t.id}/file`"
                    class="btn-secondary py-1 text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Ansehen ↗</a>
                </template>
                <template v-else-if="t.documentType === 'upload' || t.documentType === 'submit'">
                  <span
                    v-if="t.submission?.filename"
                    class="max-w-[160px] truncate text-xs text-gray-500"
                    :title="t.submission.filename"
                  >{{ t.submission.filename }}</span>
                  <label
                    v-if="canInteractWithTemplates"
                    class="btn-secondary cursor-pointer py-1 text-xs"
                    :class="{ 'opacity-50': uploadingTemplateId === t.id }"
                  >
                    {{ uploadingTemplateId === t.id ? 'Loading …' : t.submission ? 'Ändern' : 'Hochladen' }}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      class="hidden"
                      :disabled="uploadingTemplateId === t.id"
                      @change="onUploadForTemplate(t.id, $event)"
                    />
                  </label>
                  <span
                    v-if="uploadErrors[t.id]"
                    role="alert"
                    class="max-w-[160px] truncate text-xs text-red-600"
                  >{{ uploadErrors[t.id] }}</span>
                  <a
                    v-if="t.submission"
                    :href="`/api/ini/${slug}/members/${memberId}/documents/contract/${t.id}/download`"
                    class="btn-secondary py-1 text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Ansehen ↗</a>
                  <a
                    v-else-if="t.documentType === 'upload' && t.hasFile && canInteractWithTemplates"
                    :href="`/api/ini/${slug}/contract-templates/${t.id}/file`"
                    class="btn-secondary py-1 text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Ansehen ↗</a>
                </template>
              </div>
            </li>
          </ul>
        </template>

        <div v-if="canManageMembers && (member.status === 'ACTIVE' || member.status === 'INACTIVE')" class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Weitere Unterlagen</h3>
          <LoadingBrumm v-if="isLoadingOtherDocs" />
          <template v-else>
            <ul v-if="otherDocuments.length > 0" class="mb-3 space-y-1">
              <li
                v-for="doc in otherDocuments"
                :key="doc.id"
                class="flex items-center gap-2 text-sm text-gray-700"
              >
                <span aria-hidden="true" class="text-gray-400">📄</span>
                <span class="flex-1">{{ doc.name }}</span>
                <label
                  class="btn-secondary cursor-pointer py-1 text-xs"
                  :class="{ 'opacity-50': replacingOtherFileId === doc.id }"
                >
                  {{ replacingOtherFileId === doc.id ? "Loading …" : "Ändern" }}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    class="hidden"
                    :disabled="replacingOtherFileId === doc.id"
                    @change="onReplaceOtherDocument(doc.id, $event)"
                  />
                </label>
                <span v-if="otherReplaceErrorFileId === doc.id && otherReplaceError" class="text-xs text-red-600">{{ otherReplaceError }}</span>
                <a
                  :href="`/api/ini/${slug}/members/${memberId}/documents/other/${doc.id}/download`"
                  class="btn-secondary py-1 text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Ansehen ↗</a
                >
                <button type="button" class="btn-secondary py-1 text-xs text-red-600" @click="onDeleteOtherDocument(doc.id)">Löschen</button>
              </li>
            </ul>
            <div class="flex items-center gap-3">
              <label
                class="btn-secondary cursor-pointer text-sm"
                :class="{ 'opacity-50': isUploadingOtherDoc }"
              >
                {{ isUploadingOtherDoc ? "Loading …" : "Datei hinzufügen" }}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="hidden"
                  :disabled="isUploadingOtherDoc"
                  @change="onUploadOtherDocument"
                />
              </label>
              <span v-if="otherUploadError" role="alert" class="text-xs text-red-600">{{ otherUploadError }}</span>
            </div>
          </template>
        </div>

        <div v-if="canManageMembers || (isMember && !isContactLocked)" class="space-y-2 border-t pt-4">
          <p v-if="member.status === 'DEACTIVATED'" class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Kind wurde abgemeldet.<template v-if="deletionDate"> Automatische Löschung am {{ deletionDate }}.</template>
          </p>
          <div class="flex items-center justify-between gap-3">
            <button
              v-if="!isContactLocked && !isTeam"
              type="submit"
              class="btn-primary text-sm"
              :disabled="isSubmitting || !hasChanges"
            >
              {{ isSubmitting ? "Wird gespeichert…" : "Speichern" }}
            </button>
            <div v-else />
            <div class="flex gap-3">
              <button
                v-if="isMember && member.status === 'REGISTERED' && member.hasInvite && !submitted"
                type="button"
                class="btn-primary text-sm"
                :disabled="!localAllSubmitted"
                @click="onSubmit"
              >
                Einreichen
              </button>
            <div v-if="canManageMembers" class="flex gap-3">
            <!-- Vor Aktivierung: Aktivieren + Einladung + Kind entfernen -->
            <template v-if="member.status === 'PENDING_INVITE' || member.status === 'REGISTERED'">
              <button
                type="button"
                class="btn-primary text-sm"
                :disabled="(!member.hasSubmittedDocuments && member.hasInvite && !isOwnChild) || !canManageMembers"
                @click="onActivate"
              >
                Aktivieren
              </button>
              <button
                v-if="member.status === 'PENDING_INVITE'"
                type="button"
                class="btn-secondary text-sm"
                :disabled="isResendingInvite || !canManageMembers"
                @click="onResendInvite"
              >
                {{ isResendingInvite ? "Wird gesendet…" : "Einladung erneut senden" }}
              </button>
              <button
                type="button"
                class="btn-danger text-sm"
                :disabled="isCancellingInvite || !canManageMembers"
                @click="onDeleteMember"
              >
                Kind entfernen
              </button>
            </template>

            <!-- Aktiv oder Inaktiv: Deaktivieren/Aktivieren + Abmelden -->
            <template v-else-if="member.status === 'ACTIVE' || member.status === 'INACTIVE'">
              <button
                type="button"
                class="btn-secondary text-sm"
                :disabled="isDisabling || !canManageMembers"
                @click="onToggleDisabled"
              >
                {{ isDisabling ? "Wird gespeichert…" : member.status === 'INACTIVE' ? "Aktivieren" : "Deaktivieren" }}
              </button>
              <button
                type="button"
                class="btn-secondary text-sm"
                :disabled="isDeactivating || !canManageMembers"
                @click="onDeactivate"
              >
                {{ isDeactivating ? "Wird abgemeldet…" : "Abmelden" }}
              </button>
            </template>

            <!-- Abgemeldet: Abmeldung rückgängig + Löschen -->
            <template v-else-if="member.status === 'DEACTIVATED'">
              <button
                type="button"
                class="btn-secondary text-sm"
                :disabled="isReactivating || !canManageMembers"
                @click="onReactivate"
              >
                {{ isReactivating ? "Wird reaktiviert…" : "Abmeldung rückgängig" }}
              </button>
              <button
                type="button"
                class="btn-danger text-sm"
                :disabled="isCancellingInvite || !canManageMembers"
                @click="onDeleteMember"
              >
                Sofort löschen
              </button>
            </template>
            </div>
            </div>
          </div>
          <p v-if="inviteActionError" class="text-sm text-red-700">
            {{ inviteActionError }}
          </p>
        </div>
        </form>
      </div>

      <FootnoteCard v-if="member?.lastEditedAt">
        <p class="text-xs">
          Letzte Änderung am {{ new Date(member.lastEditedAt).toLocaleDateString('de-DE') }}
          <template v-if="member.lastEditedBy"> von {{ member.lastEditedBy }}</template>
        </p>
      </FootnoteCard>
    </template>
  </div>
</template>
