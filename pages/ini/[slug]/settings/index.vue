<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'SUPERUSER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

// --- Vereinsname ---
const nameInput = ref(authStore.currentClub?.name ?? '')
const isEditingName = ref(false)
const isSavingName = ref(false)
const nameError = ref('')

function onEditName() {
  nameInput.value = authStore.currentClub?.name ?? ''
  nameError.value = ''
  isEditingName.value = true
}

function onCancelName() {
  isEditingName.value = false
  nameError.value = ''
}

async function onSaveName() {
  if (!nameInput.value.trim()) return
  isSavingName.value = true
  nameError.value = ''
  try {
    const data = await $fetch<{ name: string }>(`/api/ini/${slug}/settings/name`, {
      method: 'PATCH',
      body: { name: nameInput.value.trim() },
    })
    if (authStore.currentClub) authStore.currentClub.name = data.name
    isEditingName.value = false
  } catch (err) {
    nameError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingName.value = false
  }
}

// --- Datenbank ---
type DbStatus = { type: 'POSTGRES'; hasDsn: boolean; hasPending: boolean }

const dbStatus = ref<DbStatus>({ type: 'POSTGRES', hasDsn: false, hasPending: false })
const isEditingDb = ref(false)
const dsnInput = ref('')
const isSavingDb = ref(false)
const dbError = ref('')

async function fetchDbStatus() {
  dbStatus.value = await $fetch<DbStatus>(`/api/ini/${slug}/settings/database`)
}

async function onSaveDb() {
  if (!dsnInput.value.trim()) return
  isSavingDb.value = true
  dbError.value = ''
  try {
    await $fetch(`/api/ini/${slug}/settings/database`, {
      method: 'PATCH',
      body: { dsn: dsnInput.value.trim() },
    })
    isEditingDb.value = false
    dsnInput.value = ''
    await fetchDbStatus()
  } catch (err) {
    dbError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingDb.value = false
  }
}

// --- Datenspeicher ---
type StorageStatus = { type: 'S3'; hasConfig: boolean; hasPending: boolean }

const storageStatus = ref<StorageStatus>({ type: 'S3', hasConfig: false, hasPending: false })
const isEditingStorage = ref(false)
const s3Form = ref({ endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '' })
const isSavingStorage = ref(false)
const storageError = ref('')

async function fetchStorageStatus() {
  storageStatus.value = await $fetch<StorageStatus>(`/api/ini/${slug}/settings/file-storage`)
}

async function onSaveStorage() {
  isSavingStorage.value = true
  storageError.value = ''
  try {
    const body: Record<string, string | boolean> = {
      bucket: s3Form.value.bucket.trim(),
      region: s3Form.value.region.trim(),
      accessKeyId: s3Form.value.accessKeyId.trim(),
      secretAccessKey: s3Form.value.secretAccessKey.trim(),
      activateDirectly: true,
    }
    if (s3Form.value.endpoint.trim()) body.endpoint = s3Form.value.endpoint.trim()
    await $fetch(`/api/ini/${slug}/settings/file-storage`, { method: 'PATCH', body })
    isEditingStorage.value = false
    s3Form.value = { endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '' }
    await fetchStorageStatus()
  } catch (err) {
    storageError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingStorage.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchDbStatus(), fetchStorageStatus()])
})
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Einstellungen</h1>

    <!-- Verein -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Verein</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Name</dt>
          <dd class="text-gray-900">
            <form v-if="isEditingName" class="flex items-center gap-2" @submit.prevent="onSaveName">
              <input
                v-model="nameInput"
                type="text"
                class="input text-sm"
                maxlength="100"
                required
                autofocus
              />
              <button type="submit" class="btn-primary text-sm" :disabled="isSavingName">Speichern</button>
              <button type="button" class="btn-secondary text-sm" @click="onCancelName">Abbrechen</button>
            </form>
            <template v-else>
              {{ authStore.currentClub?.name }}
              <button class="ml-2 text-xs text-primary-600 hover:underline" @click="onEditName">Ändern</button>
            </template>
            <p v-if="nameError" class="mt-1 text-xs text-red-600">{{ nameError }}</p>
          </dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Slug</dt>
          <dd class="font-mono text-gray-900">{{ authStore.currentClub?.slug }}</dd>
        </div>
      </dl>
    </div>

    <!-- Datenbank -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Datenbank</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Backend</dt>
          <dd class="text-gray-900">PostgreSQL</dd>
        </div>
        <div v-if="dbStatus.hasDsn" class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Connection</dt>
          <dd class="text-xs text-gray-400">verschlüsselt gespeichert</dd>
        </div>
      </dl>

      <form v-if="isEditingDb" class="space-y-3" @submit.prevent="onSaveDb">
        <div>
          <label class="mb-1 block text-xs text-gray-500">PostgreSQL Connection String</label>
          <input
            v-model="dsnInput"
            type="password"
            class="input w-full font-mono text-sm"
            placeholder="postgresql://user:password@host:5432/dbname"
            required
            autofocus
          />
          <p class="mt-1 text-xs text-gray-400">
            Die Verbindung wird vor dem Speichern getestet.
          </p>
        </div>
        <p v-if="dbError" class="text-xs text-red-600">{{ dbError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" :disabled="isSavingDb">
            {{ isSavingDb ? 'Wird geprüft…' : 'Speichern' }}
          </button>
          <button type="button" class="btn-secondary text-sm" @click="isEditingDb = false; dbError = ''">
            Abbrechen
          </button>
        </div>
      </form>

      <div v-else class="pt-1">
        <button class="btn-secondary text-sm" @click="isEditingDb = true">
          {{ dbStatus.hasDsn ? 'Connection ändern' : 'PostgreSQL einrichten' }}
        </button>
      </div>
    </div>

    <!-- Datenspeicher -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Datenspeicher</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Backend</dt>
          <dd class="text-gray-900">S3-kompatibel</dd>
        </div>
        <div v-if="storageStatus.hasConfig" class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Zugangsdaten</dt>
          <dd class="text-xs text-gray-400">verschlüsselt gespeichert</dd>
        </div>
      </dl>

      <form v-if="isEditingStorage" class="space-y-3" @submit.prevent="onSaveStorage">
        <div class="grid gap-3 tablet:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-gray-500">Bucket</label>
            <input v-model="s3Form.bucket" type="text" class="input w-full text-sm" required />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Region</label>
            <input v-model="s3Form.region" type="text" class="input w-full text-sm" placeholder="eu-central-1" required />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Access Key ID</label>
            <input v-model="s3Form.accessKeyId" type="text" class="input w-full font-mono text-sm" required />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Secret Access Key</label>
            <input v-model="s3Form.secretAccessKey" type="password" class="input w-full font-mono text-sm" required />
          </div>
          <div class="tablet:col-span-2">
            <label class="mb-1 block text-xs text-gray-500">Endpoint (optional, für S3-kompatible Dienste)</label>
            <input v-model="s3Form.endpoint" type="url" class="input w-full font-mono text-sm" placeholder="https://s3.example.com" />
          </div>
        </div>
        <p v-if="storageError" class="text-xs text-red-600">{{ storageError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" :disabled="isSavingStorage">
            {{ isSavingStorage ? 'Wird gespeichert…' : 'Speichern' }}
          </button>
          <button type="button" class="btn-secondary text-sm" @click="isEditingStorage = false; storageError = ''">
            Abbrechen
          </button>
        </div>
      </form>

      <div v-else class="pt-1">
        <button class="btn-secondary text-sm" @click="isEditingStorage = true">
          {{ storageStatus.hasConfig ? 'S3-Zugangsdaten ändern' : 'S3 einrichten' }}
        </button>
      </div>
    </div>

    <!-- Gefahrenbereich -->
    <div class="card space-y-4 border-red-200">
      <h2 class="font-semibold text-red-700">Gefahrenbereich</h2>
      <p class="text-sm text-gray-600">
        Den Verein und alle Daten unwiderruflich löschen.
      </p>
      <NuxtLink :to="`/ini/${slug}/settings/delete`" class="btn-danger inline-block text-sm">
        Verein löschen
      </NuxtLink>
    </div>
  </div>
</template>
