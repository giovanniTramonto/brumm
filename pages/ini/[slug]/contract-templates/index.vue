<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'MANAGER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const canManage = computed(() => {
  const user = authStore.currentUser
  return user?.role === 'SUPERUSER' || (user?.role === 'MANAGER' && user?.isMemberManager)
})

type Template = {
  id: string
  name: string
  documentType: string | null
  driveFileId: string | null
  driveFileName: string | null
}

const templates = ref<Template[]>([])
const isLoading = ref(true)
const newName = ref('')
const newDocumentType = ref('')
const newFile = ref<File | null>(null)
const isCreating = ref(false)
const createError = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editingName = ref('')
const uploadingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

async function loadTemplates() {
  const data = await $fetch<{ templates: Template[] }>(`/api/ini/${slug}/contract-templates`)
  templates.value = data.templates
}

onMounted(async () => {
  if (!canManage.value) {
    await navigateTo(`/ini/${slug}/dashboard`)
    return
  }
  try {
    await loadTemplates()
  } finally {
    isLoading.value = false
  }
})

function onNewFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  newFile.value = input.files?.[0] ?? null
}

async function onCreate() {
  createError.value = null
  isCreating.value = true
  try {
    const body = new FormData()
    body.append('name', newName.value.trim())
    body.append('documentType', newDocumentType.value)
    if (newFile.value) body.append('file', newFile.value, newFile.value.name)
    const data = await $fetch<{ template: Template }>(`/api/ini/${slug}/contract-templates`, {
      method: 'POST',
      body,
    })
    templates.value.push(data.template)
    newName.value = ''
    newDocumentType.value = ''
    newFile.value = null
    const input = document.getElementById('new-file-input') as HTMLInputElement | null
    if (input) input.value = ''
  } catch (err: unknown) {
    createError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Anlegen'
  } finally {
    isCreating.value = false
  }
}

function startEdit(template: Template) {
  editingId.value = template.id
  editingName.value = template.name
}

async function saveEdit(template: Template) {
  if (!editingName.value.trim()) return
  await $fetch(`/api/ini/${slug}/contract-templates/${template.id}`, {
    method: 'PATCH',
    body: { name: editingName.value.trim() },
  })
  const idx = templates.value.findIndex((t) => t.id === template.id)
  if (idx !== -1) templates.value[idx] = { ...templates.value[idx], name: editingName.value.trim() }
  editingId.value = null
}

async function setDocumentType(template: Template, documentType: string) {
  const updated = await $fetch<{ template: Template }>(
    `/api/ini/${slug}/contract-templates/${template.id}`,
    {
      method: 'PATCH',
      body: { documentType },
    },
  )
  const idx = templates.value.findIndex((t) => t.id === template.id)
  if (idx !== -1) templates.value[idx] = updated.template
}

async function onUploadFile(template: Template, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingId.value = template.id
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    const data = await $fetch<{ template: Template }>(
      `/api/ini/${slug}/contract-templates/${template.id}/file`,
      {
        method: 'POST',
        body,
      },
    )
    const idx = templates.value.findIndex((t) => t.id === template.id)
    if (idx !== -1) templates.value[idx] = data.template
  } finally {
    uploadingId.value = null
    input.value = ''
  }
}

function onDragStart(event: DragEvent, id: string) {
  draggedId.value = id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, id: string) {
  event.preventDefault()
  dragOverId.value = id
}

function onDrop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId) return
  const from = templates.value.findIndex((t) => t.id === draggedId.value)
  const to = templates.value.findIndex((t) => t.id === targetId)
  const updated = [...templates.value]
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  templates.value = updated
  draggedId.value = null
  dragOverId.value = null
  $fetch(`/api/ini/${slug}/contract-templates/reorder`, {
    method: 'PUT',
    body: { ids: templates.value.map((t) => t.id) },
  })
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}

async function onDelete(template: Template) {
  if (!confirm(`"${template.name}" wirklich löschen?`)) return
  deletingId.value = template.id
  try {
    await $fetch(`/api/ini/${slug}/contract-templates/${template.id}`, { method: 'DELETE' })
    templates.value = templates.value.filter((t) => t.id !== template.id)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900" aria-label="Zurück zur Kinderliste">
        ← Zurück
      </NuxtLink>
    </div>

    <div v-if="isLoading" role="status" aria-live="polite" class="py-12 text-gray-500">Brumm, brumm …</div>

    <template v-else>
      <div class="card space-y-4">
        <h1 class="text-2xl font-bold text-gray-900">Vertragsvorlagen</h1>

        <p v-if="templates.length === 0" class="text-sm text-gray-500">Noch keine Einträge.</p>

        <ul v-else class="divide-y divide-gray-100">
          <li
            v-for="template in templates"
            :key="template.id"
            draggable="true"
            class="flex cursor-default items-center gap-3 py-3 transition-opacity"
            :class="{ 'opacity-40': draggedId === template.id, 'border-t-2 border-primary-500': dragOverId === template.id && dragOverId !== draggedId }"
            @dragstart="onDragStart($event, template.id)"
            @dragover="onDragOver($event, template.id)"
            @drop="onDrop(template.id)"
            @dragend="onDragEnd"
          >
            <span aria-hidden="true" class="cursor-grab text-gray-300 select-none active:cursor-grabbing">⠿</span>
            <div class="min-w-0 flex-1">
              <div v-if="editingId === template.id" class="flex gap-2">
                <input
                  v-model="editingName"
                  type="text"
                  class="input flex-1 text-sm"
                  :aria-label="`Name für ${template.name}`"
                  @keyup.enter="saveEdit(template)"
                  @keyup.escape="editingId = null"
                />
                <button class="btn-primary py-1 text-xs" @click="saveEdit(template)">Speichern</button>
                <button class="btn-secondary py-1 text-xs" @click="editingId = null">Abbrechen</button>
              </div>
              <span v-else class="text-sm text-gray-900">{{ template.name }}</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="editingId !== template.id"
                class="btn-secondary py-1 text-xs"
                :aria-label="`'${template.name}' umbenennen`"
                @click="startEdit(template)"
              >
                Umbenennen
              </button>

              <template v-if="template.documentType !== 'submit'">
                <span v-if="template.driveFileName" class="whitespace-nowrap text-xs text-gray-500">
                  {{ template.driveFileName }}
                </span>
                <span v-else class="whitespace-nowrap text-xs text-gray-400">Keine Vorlage</span>

                <label
                  class="btn-secondary cursor-pointer py-1 text-xs"
                  :class="{ 'opacity-50': uploadingId === template.id }"
                  :aria-label="`${template.driveFileId ? 'Ersetzen' : 'Hochladen'}: ${template.name}`"
                >
                  {{ uploadingId === template.id ? '…' : template.driveFileId ? 'Ersetzen' : 'Hochladen' }}
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    class="hidden"
                    :disabled="uploadingId === template.id"
                    @change="onUploadFile(template, $event)"
                  />
                </label>
              </template>

              <select
                :id="`doc-type-${template.id}`"
                :aria-label="`Art für ${template.name}`"
                class="input py-0.5 text-xs"
                :value="template.documentType ?? ''"
                @change="setDocumentType(template, ($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>Art wählen …</option>
                <option value="read">Nur lesen</option>
                <option value="upload">Ausfüllen</option>
                <option value="submit">Einreichen</option>
              </select>

              <button
                class="btn-danger py-1 text-xs"
                :disabled="deletingId === template.id"
                :aria-label="`'${template.name}' löschen`"
                @click="onDelete(template)"
              >
                {{ deletingId === template.id ? '…' : 'Löschen' }}
              </button>
            </div>
          </li>
        </ul>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Neuer Eintrag</h3>
          <div v-if="createError" role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ createError }}</div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <input
              v-model="newName"
              type="text"
              class="input flex-1 text-sm"
              placeholder="Name der Vorlage"
              aria-label="Name der neuen Vorlage"
              @keyup.enter="onCreate"
            />
            <select v-model="newDocumentType" class="input w-36 shrink-0 text-sm" aria-label="Art der neuen Vorlage">
              <option value="" disabled>Art wählen …</option>
              <option value="read">Nur lesen</option>
              <option value="upload">Ausfüllen</option>
              <option value="submit">Einreichen</option>
            </select>
            <label
              v-if="newDocumentType !== 'submit'"
              class="btn-secondary cursor-pointer text-sm"
              aria-label="Datei auswählen (PDF oder DOCX)"
            >
              {{ newFile ? newFile.name : 'PDF / DOCX' }}
              <input
                id="new-file-input"
                type="file"
                accept=".pdf,.docx"
                class="hidden"
                @change="onNewFileSelected"
              />
            </label>
            <button
              class="btn-primary text-sm"
              :disabled="!newName.trim() || !newDocumentType || (newDocumentType !== 'submit' && !newFile) || isCreating"
              @click="onCreate"
            >
              {{ isCreating ? 'Wird angelegt…' : 'Anlegen' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
