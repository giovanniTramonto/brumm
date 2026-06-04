<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

type Document = { id: string; name: string; order: number; createdAt: string }

const documents = ref<Document[]>([])
const isLoading = ref(true)

const newName = ref('')
const newFile = ref<File | null>(null)
const isCreating = ref(false)
const createError = ref<string | null>(null)

const replacingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

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
  const from = documents.value.findIndex((d) => d.id === draggedId.value)
  const to = documents.value.findIndex((d) => d.id === targetId)
  const updated = [...documents.value]
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  documents.value = updated
  draggedId.value = null
  dragOverId.value = null
  $fetch(`/api/ini/${slug}/documents/reorder`, {
    method: 'PUT',
    body: { ids: documents.value.map((d) => d.id) },
  })
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}

onMounted(async () => {
  try {
    const data = await $fetch<{ documents: Document[] }>(`/api/ini/${slug}/documents`)
    documents.value = data.documents
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
    if (!newFile.value) return
    body.append('name', newName.value.trim())
    body.append('file', newFile.value, newFile.value.name)
    const data = await $fetch<{ document: Document }>(`/api/ini/${slug}/documents`, {
      method: 'POST',
      body,
    })
    documents.value = [data.document, ...documents.value]
    newName.value = ''
    newFile.value = null
    const input = document.getElementById('new-doc-file') as HTMLInputElement | null
    if (input) input.value = ''
  } catch (err: unknown) {
    createError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Anlegen'
  } finally {
    isCreating.value = false
  }
}

async function onReplace(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  replacingId.value = id
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    const data = await $fetch<{ document: Document }>(`/api/ini/${slug}/documents/${id}`, {
      method: 'PATCH',
      body,
    })
    documents.value = documents.value.map((d) => (d.id === id ? data.document : d))
  } finally {
    replacingId.value = null
    input.value = ''
  }
}

async function onDelete(doc: Document) {
  if (!confirm(`„${doc.name}" wirklich löschen?`)) return
  deletingId.value = doc.id
  try {
    await $fetch(`/api/ini/${slug}/documents/${doc.id}`, { method: 'DELETE' })
    documents.value = documents.value.filter((d) => d.id !== doc.id)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-900">← Zurück</NuxtLink>
    </div>

    <LoadingBrumm v-if="isLoading" />

    <template v-else>
      <div class="card space-y-4">
        <h1 class="text-2xl font-bold text-gray-900">Unterlagen</h1>

        <p v-if="documents.length === 0" class="text-sm text-gray-500">Noch keine Einträge.</p>

        <ul v-else class="divide-y divide-gray-100">
          <li
            v-for="doc in documents"
            :key="doc.id"
            draggable="true"
            class="flex cursor-default items-center gap-3 py-3 transition-opacity"
            :class="{ 'opacity-40': draggedId === doc.id, 'border-t-2 border-primary-500': dragOverId === doc.id && dragOverId !== draggedId }"
            @dragstart="onDragStart($event, doc.id)"
            @dragover="onDragOver($event, doc.id)"
            @drop="onDrop(doc.id)"
            @dragend="onDragEnd"
          >
            <span aria-hidden="true" class="cursor-grab select-none text-gray-300 active:cursor-grabbing">⠿</span>
            <span class="min-w-0 flex-1 text-sm text-gray-900">{{ doc.name }}</span>
            <div class="flex shrink-0 items-center gap-2">
              <a
                :href="`/api/ini/${slug}/documents/${doc.id}/download`"
                class="btn-secondary py-1 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >Ansehen ↗</a>
              <label
                class="btn-secondary cursor-pointer py-1 text-xs"
                :class="{ 'opacity-50': replacingId === doc.id }"
              >
                {{ replacingId === doc.id ? '…' : 'Ändern' }}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="hidden"
                  :disabled="replacingId === doc.id"
                  @change="onReplace(doc.id, $event)"
                />
              </label>
              <button
                type="button"
                class="btn-danger py-1 text-xs"
                :disabled="deletingId === doc.id"
                @click="onDelete(doc)"
              >
                {{ deletingId === doc.id ? '…' : 'Löschen' }}
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
              placeholder="Name des Dokuments"
              @keyup.enter="newFile ? onCreate() : undefined"
            />
            <label class="btn-secondary cursor-pointer text-sm">
              {{ newFile ? newFile.name : 'Datei wählen' }}
              <input
                id="new-doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                class="hidden"
                @change="onNewFileSelected"
              />
            </label>
            <button
              type="button"
              class="btn-primary text-sm"
              :disabled="!newName.trim() || !newFile || isCreating"
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
