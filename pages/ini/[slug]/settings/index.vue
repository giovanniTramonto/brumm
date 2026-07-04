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
type DbStatus = { hasDsn: boolean; hasPoolDsn: boolean }

const dbStatus = ref<DbStatus>({ hasDsn: false, hasPoolDsn: false })
const isEditingDb = ref(false)
const dsnInput = ref('')
const poolDsnInput = ref('')
const isSavingDb = ref(false)
const dbError = ref('')

async function fetchDbStatus() {
  dbStatus.value = await $fetch<DbStatus>(`/api/ini/${slug}/settings/database`)
}

async function onSaveDb() {
  if (!dsnInput.value.trim() && !poolDsnInput.value.trim()) return
  isSavingDb.value = true
  dbError.value = ''
  try {
    const body: Record<string, string> = {}
    if (dsnInput.value.trim()) body.dsn = dsnInput.value.trim()
    if (poolDsnInput.value.trim()) body.poolDsn = poolDsnInput.value.trim()
    await $fetch(`/api/ini/${slug}/settings/database`, { method: 'PATCH', body })
    isEditingDb.value = false
    dsnInput.value = ''
    poolDsnInput.value = ''
    await fetchDbStatus()
  } catch (err) {
    dbError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingDb.value = false
  }
}

// --- Datenspeicher ---
type StorageStatus = { hasConfig: boolean }

const storageStatus = ref<StorageStatus>({ hasConfig: false })
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

// --- ISBJ ---
type ISBJStatus = {
  hasConfig: boolean
  host?: string
  username?: string
  traegerNummer?: string
  einrichtungsNummer?: string
}

const isbjStatus = ref<ISBJStatus>({ hasConfig: false })
const isEditingISBJ = ref(false)
const isTestingISBJ = ref(false)
const isbjTestResult = ref<'ok' | 'error' | null>(null)
const isbjTestMessage = ref('')
const isbjForm = ref({
  host: 'ds.traegerportal.isbj.verwalt-berlin.de',
  username: '',
  traegerNummer: '',
  einrichtungsNummer: '',
  apiKey: '',
  certPassphrase: '',
})
const isbjCertFile = ref<File | null>(null)
const isSavingISBJ = ref(false)
const isbjError = ref('')
const isDeletingISBJ = ref(false)

async function fetchISBJStatus() {
  isbjStatus.value = await $fetch<ISBJStatus>(`/api/ini/${slug}/settings/isbj`)
}

function onISBJCertSelected(event: Event) {
  const input = event.target as HTMLInputElement
  isbjCertFile.value = input.files?.[0] ?? null
}

async function onSaveISBJ() {
  isSavingISBJ.value = true
  isbjError.value = ''
  try {
    const form = new FormData()
    form.append('host', isbjForm.value.host.trim())
    form.append('username', isbjForm.value.username.trim())
    form.append('traegerNummer', isbjForm.value.traegerNummer.trim())
    form.append('einrichtungsNummer', isbjForm.value.einrichtungsNummer.trim())
    if (isbjForm.value.apiKey.trim()) form.append('apiKey', isbjForm.value.apiKey.trim())
    if (isbjForm.value.certPassphrase.trim())
      form.append('certPassphrase', isbjForm.value.certPassphrase.trim())
    if (isbjCertFile.value) form.append('cert', isbjCertFile.value, isbjCertFile.value.name)
    await $fetch(`/api/ini/${slug}/settings/isbj`, { method: 'PATCH', body: form })
    isEditingISBJ.value = false
    isbjTestResult.value = null
    isbjCertFile.value = null
    isbjForm.value = {
      host: 'ds.traegerportal.isbj.verwalt-berlin.de',
      username: '',
      traegerNummer: '',
      einrichtungsNummer: '',
      apiKey: '',
      certPassphrase: '',
    }
    await fetchISBJStatus()
  } catch (err) {
    isbjError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingISBJ.value = false
  }
}

async function onTestISBJ() {
  isTestingISBJ.value = true
  isbjTestResult.value = null
  isbjTestMessage.value = ''
  try {
    await $fetch(`/api/ini/${slug}/settings/isbj/test`, { method: 'POST' })
    isbjTestResult.value = 'ok'
  } catch (err) {
    isbjTestResult.value = 'error'
    isbjTestMessage.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Verbindungsfehler'
  } finally {
    isTestingISBJ.value = false
  }
}

async function onDeleteISBJ() {
  if (!confirm('ISBJ-Verbindung wirklich entfernen?')) return
  isDeletingISBJ.value = true
  try {
    await $fetch(`/api/ini/${slug}/settings/isbj`, { method: 'DELETE' })
    await fetchISBJStatus()
  } finally {
    isDeletingISBJ.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchDbStatus(), fetchStorageStatus(), fetchISBJStatus()])
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
        <div v-if="dbStatus.hasPoolDsn" class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Pool Connection</dt>
          <dd class="text-xs text-gray-400">verschlüsselt gespeichert</dd>
        </div>
      </dl>

      <form v-if="isEditingDb" class="space-y-3" @submit.prevent="onSaveDb">
        <div>
          <label class="mb-1 block text-xs text-gray-500">
            PostgreSQL Connection String{{ dbStatus.hasDsn ? ' (leer = unverändert)' : '' }}
          </label>
          <input
            v-model="dsnInput"
            type="password"
            class="input w-full font-mono text-sm"
            placeholder="postgresql://user:password@host:5432/dbname"
            :required="!dbStatus.hasDsn"
            autofocus
          />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">
            Pool Connection String (optional{{ dbStatus.hasPoolDsn ? ', leer = unverändert' : ', z.B. Supabase Port 6543' }})
          </label>
          <input
            v-model="poolDsnInput"
            type="password"
            class="input w-full font-mono text-sm"
            placeholder="postgresql://user:password@host:6543/dbname"
          />
          <p class="mt-1 text-xs text-gray-400">
            Wenn gesetzt: Runtime-Queries laufen über den Pooler (max. 5 Verbindungen). Migrationen nutzen immer den direkten Connection String.
          </p>
        </div>
        <p v-if="dbError" class="text-xs text-red-600">{{ dbError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" :disabled="isSavingDb || (!dsnInput.trim() && !poolDsnInput.trim())">
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

    <!-- ISBJ Trägerportal -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">ISBJ Trägerportal</h2>

      <template v-if="isbjStatus.hasConfig && !isEditingISBJ">
        <dl class="space-y-2 text-sm">
          <div class="flex gap-2">
            <dt class="w-40 shrink-0 text-gray-500">Benutzername</dt>
            <dd class="text-gray-900">{{ isbjStatus.username }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-40 shrink-0 text-gray-500">Trägernummer</dt>
            <dd class="text-gray-900">{{ isbjStatus.traegerNummer }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-40 shrink-0 text-gray-500">Einrichtungsnummer</dt>
            <dd class="text-gray-900">{{ isbjStatus.einrichtungsNummer }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-40 shrink-0 text-gray-500">Host</dt>
            <dd class="font-mono text-xs text-gray-500">{{ isbjStatus.host }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-40 shrink-0 text-gray-500">Zertifikat & API-Key</dt>
            <dd class="text-xs text-gray-400">verschlüsselt gespeichert</dd>
          </div>
        </dl>

        <div
          v-if="isbjTestResult"
          role="alert"
          class="rounded-md p-3 text-sm"
          :class="isbjTestResult === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
        >
          {{ isbjTestResult === 'ok' ? 'Verbindung erfolgreich.' : isbjTestMessage }}
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button class="btn-secondary text-sm" :disabled="isTestingISBJ" @click="onTestISBJ">
            {{ isTestingISBJ ? 'Wird getestet…' : 'Verbindung testen' }}
          </button>
          <button class="btn-secondary text-sm" @click="isEditingISBJ = true; isbjTestResult = null">
            Zugangsdaten ändern
          </button>
          <button class="btn-danger text-sm" :disabled="isDeletingISBJ" @click="onDeleteISBJ">
            {{ isDeletingISBJ ? '…' : 'Entfernen' }}
          </button>
        </div>
      </template>

      <form v-else-if="isEditingISBJ || !isbjStatus.hasConfig" class="space-y-3" @submit.prevent="onSaveISBJ">
        <div class="grid gap-3 tablet:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-gray-500">Benutzername</label>
            <input v-model="isbjForm.username" type="text" class="input w-full text-sm" :required="!isbjStatus.hasConfig" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Trägernummer</label>
            <input v-model="isbjForm.traegerNummer" type="text" class="input w-full text-sm" :required="!isbjStatus.hasConfig" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Einrichtungsnummer</label>
            <input v-model="isbjForm.einrichtungsNummer" type="text" class="input w-full text-sm" :required="!isbjStatus.hasConfig" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">API-Key{{ isbjStatus.hasConfig ? ' (leer = unverändert)' : '' }}</label>
            <input v-model="isbjForm.apiKey" type="password" class="input w-full font-mono text-sm" :required="!isbjStatus.hasConfig" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">
              Zertifikat (PKCS12 / .p12){{ isbjStatus.hasConfig ? ' (leer = unverändert)' : '' }}
            </label>
            <label class="btn-secondary cursor-pointer text-sm">
              {{ isbjCertFile ? isbjCertFile.name : 'Datei wählen' }}
              <input
                type="file"
                accept=".p12,.pfx"
                class="hidden"
                :required="!isbjStatus.hasConfig"
                @change="onISBJCertSelected"
              />
            </label>
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Zertifikat-Passwort{{ isbjStatus.hasConfig ? ' (leer = unverändert)' : '' }}</label>
            <input v-model="isbjForm.certPassphrase" type="password" class="input w-full text-sm" :required="!isbjStatus.hasConfig" />
          </div>
          <div class="tablet:col-span-2">
            <label class="mb-1 block text-xs text-gray-500">Host</label>
            <input v-model="isbjForm.host" type="text" class="input w-full font-mono text-sm" required />
          </div>
        </div>
        <p v-if="isbjError" class="text-xs text-red-600">{{ isbjError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" :disabled="isSavingISBJ">
            {{ isSavingISBJ ? 'Wird gespeichert…' : 'Speichern' }}
          </button>
          <button
            v-if="isbjStatus.hasConfig"
            type="button"
            class="btn-secondary text-sm"
            @click="isEditingISBJ = false; isbjError = ''"
          >
            Abbrechen
          </button>
        </div>
      </form>
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
