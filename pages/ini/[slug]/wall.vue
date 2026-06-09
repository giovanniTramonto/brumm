<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

type WallEntry = {
  id: string
  name: string
  order: number
  type: string
  url: string | null
  createdAt: string
}

const entries = ref<WallEntry[]>([])
const isLoading = ref(true)

const newType = ref<'document' | 'link'>('document')
const newName = ref('')
const newUrl = ref('')
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
  const from = entries.value.findIndex((d) => d.id === draggedId.value)
  const to = entries.value.findIndex((d) => d.id === targetId)
  const updated = [...entries.value]
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  entries.value = updated
  draggedId.value = null
  dragOverId.value = null
  $fetch(`/api/ini/${slug}/documents/reorder`, {
    method: 'PUT',
    body: { ids: entries.value.map((d) => d.id) },
  })
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}

onMounted(async () => {
  try {
    const data = await $fetch<{ documents: WallEntry[] }>(`/api/ini/${slug}/documents`)
    entries.value = data.documents
  } finally {
    isLoading.value = false
  }
})

function onNewFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  newFile.value = file
  if (file && !newName.value.trim()) {
    newName.value = file.name.replace(/\.[^.]+$/, '')
  }
}

function onTypeChange() {
  newName.value = ''
  newUrl.value = ''
  newFile.value = null
}

const canCreate = computed(() => {
  if (!newName.value.trim()) return false
  if (newType.value === 'link') return !!newUrl.value.trim()
  return !!newFile.value
})

async function onCreate() {
  createError.value = null
  isCreating.value = true
  try {
    if (newType.value === 'link') {
      const data = await $fetch<{ document: WallEntry }>(`/api/ini/${slug}/documents`, {
        method: 'POST',
        body: { name: newName.value.trim(), url: newUrl.value.trim() },
      })
      entries.value = [...entries.value, data.document]
      newName.value = ''
      newUrl.value = ''
    } else {
      if (!newFile.value) return
      const body = new FormData()
      body.append('name', newName.value.trim())
      body.append('file', newFile.value, newFile.value.name)
      const data = await $fetch<{ document: WallEntry }>(`/api/ini/${slug}/documents`, {
        method: 'POST',
        body,
      })
      entries.value = [...entries.value, data.document]
      newName.value = ''
      newFile.value = null
      const input = document.getElementById('new-doc-file') as HTMLInputElement | null
      if (input) input.value = ''
    }
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
    const data = await $fetch<{ document: WallEntry }>(`/api/ini/${slug}/documents/${id}`, {
      method: 'PATCH',
      body,
    })
    entries.value = entries.value.map((d) => (d.id === id ? data.document : d))
  } finally {
    replacingId.value = null
    input.value = ''
  }
}

async function onDelete(entry: WallEntry) {
  if (!confirm(`„${entry.name}" wirklich löschen?`)) return
  deletingId.value = entry.id
  try {
    await $fetch(`/api/ini/${slug}/documents/${entry.id}`, { method: 'DELETE' })
    entries.value = entries.value.filter((d) => d.id !== entry.id)
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
        <h1 class="text-2xl font-bold text-gray-900">Aktuell</h1>

        <p v-if="entries.length === 0" class="text-sm text-gray-500">Noch keine Einträge.</p>

        <ul v-else class="divide-y divide-gray-100">
          <li
            v-for="entry in entries"
            :key="entry.id"
            draggable="true"
            class="flex cursor-default items-center gap-3 py-3 transition-opacity"
            :class="{ 'opacity-40': draggedId === entry.id, 'border-t-2 border-primary-500': dragOverId === entry.id && dragOverId !== draggedId }"
            @dragstart="onDragStart($event, entry.id)"
            @dragover="onDragOver($event, entry.id)"
            @drop="onDrop(entry.id)"
            @dragend="onDragEnd"
          >
            <span aria-hidden="true" class="cursor-grab select-none text-gray-300 active:cursor-grabbing">⠿</span>
            <span class="min-w-0 flex-1 text-sm text-gray-900">{{ entry.name }}</span>
            <div class="flex shrink-0 items-center gap-2">
              <a
                v-if="entry.type === 'link'"
                :href="entry.url ?? '#'"
                class="btn-secondary py-1 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >Öffnen ↗</a>
              <a
                v-else
                :href="`/api/ini/${slug}/documents/${entry.id}/download`"
                class="btn-secondary py-1 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >Ansehen ↗</a>
              <label
                v-if="entry.type !== 'link'"
                class="btn-secondary cursor-pointer py-1 text-xs"
                :class="{ 'opacity-50': replacingId === entry.id }"
              >
                {{ replacingId === entry.id ? '…' : 'Ändern' }}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  class="hidden"
                  :disabled="replacingId === entry.id"
                  @change="onReplace(entry.id, $event)"
                />
              </label>
              <button
                type="button"
                class="btn-danger py-1 text-xs"
                :disabled="deletingId === entry.id"
                @click="onDelete(entry)"
              >
                {{ deletingId === entry.id ? '…' : 'Löschen' }}
              </button>
            </div>
          </li>
        </ul>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-sm font-medium text-gray-900">Neuer Eintrag</h3>
          <div v-if="createError" role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ createError }}</div>
          <div class="mb-3 flex gap-3">
            <label class="flex cursor-pointer items-center gap-1.5 text-sm">
              <input v-model="newType" type="radio" value="document" class="accent-primary-600" @change="onTypeChange" />
              Datei
            </label>
            <label class="flex cursor-pointer items-center gap-1.5 text-sm">
              <input v-model="newType" type="radio" value="link" class="accent-primary-600" @change="onTypeChange" />
              Link
            </label>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <input
              v-model="newName"
              type="text"
              class="input flex-1 text-sm"
              :placeholder="newType === 'link' ? 'Name des Links' : 'Name der Datei'"
            />
            <input
              v-if="newType === 'link'"
              v-model="newUrl"
              type="url"
              class="input flex-1 text-sm"
              placeholder="https://…"
            />
            <label v-else class="btn-secondary cursor-pointer text-sm">
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
              :disabled="!canCreate || isCreating"
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
