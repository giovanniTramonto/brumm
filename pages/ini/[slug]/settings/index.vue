<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth', 'role'], requiredRole: 'SUPERUSER' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const reconnected = route.query.reconnected === '1'

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
type DbStatus = { type: 'GOOGLE_SHEETS' | 'POSTGRES'; hasDsn: boolean; hasPending: boolean }
type TransferStatus = {
  status: 'idle' | 'running' | 'done' | 'failed'
  reason?: string
  at?: string
}

const dbStatus = ref<DbStatus>({ type: 'GOOGLE_SHEETS', hasDsn: false, hasPending: false })
const isEditingDb = ref(false)
const dsnInput = ref('')
const activateDirectly = ref(false)
const isSavingDb = ref(false)
const dbError = ref('')
const transferStatus = ref<TransferStatus>({ status: 'idle' })
let pollInterval: ReturnType<typeof setInterval> | null = null

async function fetchDbStatus() {
  dbStatus.value = await $fetch<DbStatus>(`/api/ini/${slug}/settings/database`)
}

async function fetchTransferStatus() {
  transferStatus.value = await $fetch<TransferStatus>(
    `/api/ini/${slug}/settings/database/transfer-status`,
  )
  if (transferStatus.value.status !== 'running' && pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
    await fetchDbStatus()
  }
}

async function onSaveDb() {
  if (!dsnInput.value.trim()) return
  isSavingDb.value = true
  dbError.value = ''
  try {
    await $fetch(`/api/ini/${slug}/settings/database`, {
      method: 'PATCH',
      body: {
        dsn: dsnInput.value.trim(),
        ...(dbStatus.value.type === 'POSTGRES' && dbStatus.value.hasDsn && activateDirectly.value
          ? { activateDirectly: true }
          : {}),
      },
    })
    isEditingDb.value = false
    dsnInput.value = ''
    activateDirectly.value = false
    await fetchDbStatus()
  } catch (err) {
    dbError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingDb.value = false
  }
}

async function onStartTransfer() {
  try {
    await $fetch(`/api/ini/${slug}/settings/database/transfer`, { method: 'POST' })
    transferStatus.value = { status: 'running' }
    pollInterval = setInterval(fetchTransferStatus, 3000)
  } catch (err) {
    dbError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Transfer konnte nicht gestartet werden'
  }
}

// --- Datenspeicher ---
type StorageStatus = { type: 'GOOGLE_DRIVE' | 'S3'; hasConfig: boolean; hasPending: boolean }
type TransferLogEntry = {
  name: string
  source: string
  dest?: string
  status: string
  error?: string
}
type TransferSection = { ok: number; failed: number; errors: string[]; log: TransferLogEntry[] }
type FileTransferStatus = {
  status: 'idle' | 'running' | 'done' | 'failed'
  reason?: string
  at?: string
  result?: {
    templates?: TransferSection
    memberDocs?: TransferSection
    wallDocs?: TransferSection
    otherDocs?: TransferSection
  } | null
}

const storageStatus = ref<StorageStatus>({
  type: 'GOOGLE_DRIVE',
  hasConfig: false,
  hasPending: false,
})
const isEditingStorage = ref(false)
const s3Form = ref({ endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '' })
const activateS3Directly = ref(false)
const isSavingStorage = ref(false)
const storageError = ref('')
const fileTransferStatus = ref<FileTransferStatus>({ status: 'idle' })
let filePollInterval: ReturnType<typeof setInterval> | null = null

async function fetchStorageStatus() {
  storageStatus.value = await $fetch<StorageStatus>(`/api/ini/${slug}/settings/file-storage`)
}

async function fetchFileTransferStatus() {
  fileTransferStatus.value = await $fetch<FileTransferStatus>(
    `/api/ini/${slug}/settings/file-storage/transfer-status`,
  )
  if (fileTransferStatus.value.status !== 'running' && filePollInterval) {
    clearInterval(filePollInterval)
    filePollInterval = null
    await fetchStorageStatus()
  }
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
    }
    if (s3Form.value.endpoint.trim()) body.endpoint = s3Form.value.endpoint.trim()
    if (activateS3Directly.value) body.activateDirectly = true
    await $fetch(`/api/ini/${slug}/settings/file-storage`, { method: 'PATCH', body })
    isEditingStorage.value = false
    s3Form.value = { endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '' }
    activateS3Directly.value = false
    await fetchStorageStatus()
  } catch (err) {
    storageError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Speichern'
  } finally {
    isSavingStorage.value = false
  }
}

const isResettingToGoogle = ref(false)
const resetToGoogleError = ref('')

const isResettingFileRefs = ref(false)
const resetFileRefsResult = ref<{ templates: number; memberDocs: number; wallDocs: number } | null>(
  null,
)
const resetFileRefsError = ref('')

async function onResetFileRefs() {
  if (
    !confirm(
      'Alle Dateireferenzen (Vorlagen, Vertragsunterlagen, Aktuell-Dateien) zurücksetzen? Die Dateien müssen danach erneut hochgeladen werden.',
    )
  )
    return
  isResettingFileRefs.value = true
  resetFileRefsResult.value = null
  resetFileRefsError.value = ''
  try {
    const data = await $fetch<{
      ok: boolean
      cleared: { templates: number; memberDocs: number; wallDocs: number }
    }>(`/api/ini/${slug}/settings/reset-file-refs`, { method: 'POST' })
    resetFileRefsResult.value = data.cleared
  } catch (err) {
    resetFileRefsError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Fehler beim Zurücksetzen'
  } finally {
    isResettingFileRefs.value = false
  }
}

async function onResetToGoogle() {
  if (!confirm('Postgres und S3 zurücksetzen und zurück zu Google Drive / Sheets wechseln?')) return
  isResettingToGoogle.value = true
  resetToGoogleError.value = ''
  try {
    await $fetch(`/api/ini/${slug}/settings/reset-to-google`, { method: 'POST' })
    await Promise.all([fetchDbStatus(), fetchStorageStatus()])
  } catch (err) {
    resetToGoogleError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Fehler beim Zurücksetzen'
  } finally {
    isResettingToGoogle.value = false
  }
}

async function onStartFileTransfer() {
  try {
    await $fetch(`/api/ini/${slug}/settings/file-storage/transfer`, { method: 'POST' })
    fileTransferStatus.value = { status: 'running' }
    filePollInterval = setInterval(fetchFileTransferStatus, 3000)
  } catch (err) {
    storageError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Transfer konnte nicht gestartet werden'
  }
}

onMounted(async () => {
  await Promise.all([
    fetchDbStatus(),
    fetchStorageStatus(),
    fetchTransferStatus(),
    fetchFileTransferStatus(),
  ])
  if (transferStatus.value.status === 'running') {
    pollInterval = setInterval(fetchTransferStatus, 3000)
  }
  if (fileTransferStatus.value.status === 'running') {
    filePollInterval = setInterval(fetchFileTransferStatus, 3000)
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (filePollInterval) clearInterval(filePollInterval)
})
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">Einstellungen</h1>

    <div v-if="reconnected" class="rounded-md bg-green-50 p-3 text-sm text-green-700">
      Google Drive wurde erfolgreich neu verbunden.
    </div>

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
        <div class="flex gap-2">
          <dt class="w-32 text-gray-500">Setup</dt>
          <dd :class="authStore.currentClub?.isSetupDone ? 'text-green-700' : 'text-orange-600'">
            {{ authStore.currentClub?.isSetupDone ? 'Abgeschlossen' : 'Ausstehend' }}
          </dd>
        </div>
      </dl>
      <div class="flex gap-2 pt-2">
        <NuxtLink
          v-if="!authStore.currentClub?.isSetupDone"
          :to="`/ini/${slug}/settings/onboarding`"
          class="btn-primary inline-block text-sm"
        >
          Jetzt einrichten
        </NuxtLink>
        <template v-if="authStore.currentClub?.isSetupDone">
          <NuxtLink
            :to="`/ini/${slug}/settings/onboarding`"
            class="btn-secondary inline-block text-sm"
          >
            Datenspeicher ändern
          </NuxtLink>
          <a :href="`/api/ini/${slug}/auth/google`" class="btn-secondary inline-block text-sm">
            Google neu verbinden
          </a>
          <button
            v-if="dbStatus.type === 'POSTGRES' || storageStatus.type === 'S3'"
            class="btn-secondary text-sm"
            :disabled="isResettingToGoogle"
            @click="onResetToGoogle"
          >
            Zurück zu Google Drive
          </button>
        </template>
      </div>
      <p v-if="resetToGoogleError" class="text-sm text-red-600">{{ resetToGoogleError }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="btn-secondary text-sm"
          :disabled="isResettingFileRefs"
          @click="onResetFileRefs"
        >
          Dateireferenzen zurücksetzen
        </button>
        <span v-if="resetFileRefsResult" class="text-sm text-gray-600">
          Zurückgesetzt: {{ resetFileRefsResult.templates }} Vorlagen, {{ resetFileRefsResult.memberDocs }} Vertragsunterlagen, {{ resetFileRefsResult.wallDocs }} Aktuell-Dateien
        </span>
        <span v-if="resetFileRefsError" class="text-sm text-red-600">{{ resetFileRefsError }}</span>
      </div>
    </div>

    <!-- Datenbank -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Datenbank</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Backend</dt>
          <dd class="text-gray-900">
            {{ dbStatus.type === 'POSTGRES' ? 'PostgreSQL' : 'Google Sheets' }}
          </dd>
        </div>
        <div v-if="dbStatus.type === 'POSTGRES'" class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Connection</dt>
          <dd class="text-gray-400 text-xs">verschlüsselt gespeichert</dd>
        </div>
      </dl>

      <!-- Edit form -->
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
        <label v-if="dbStatus.hasDsn" class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input v-model="activateDirectly" type="checkbox" class="rounded" />
          Direkt aktivieren (kein Datentransfer, z.&nbsp;B. bei Backup-Wiederherstellung)
        </label>
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

      <div v-else class="space-y-3 pt-1">
        <!-- Pending-Hinweis -->
        <div v-if="dbStatus.hasPending" class="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">
          Neue Verbindung gespeichert — noch nicht aktiv. Daten übertragen um zu aktivieren.
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button class="btn-secondary text-sm" @click="isEditingDb = true">
            {{ dbStatus.hasPending ? 'Neue Verbindung ändern' : dbStatus.hasDsn ? 'Connection ändern' : 'PostgreSQL einrichten' }}
          </button>

          <!-- Transfer-Button -->
          <template v-if="dbStatus.hasPending">
            <button
              class="btn-secondary text-sm"
              :disabled="transferStatus.status === 'running'"
              @click="onStartTransfer"
            >
              <span v-if="transferStatus.status === 'running'" class="flex items-center gap-1">
                <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Übertragung läuft…
              </span>
              <span v-else>Zu neuer DB übertragen</span>
            </button>
            <div v-if="transferStatus.status === 'failed'" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Fehler: {{ transferStatus.reason ?? 'Unbekannter Fehler' }}
            </div>
          </template>
          <div v-if="dbStatus.type === 'POSTGRES' && !dbStatus.hasPending && transferStatus.status === 'done'" class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Übertragung abgeschlossen{{ transferStatus.at ? ` (${new Date(transferStatus.at).toLocaleString('de')})` : '' }}.
          </div>
        </div>
      </div>
    </div>

    <!-- Datenspeicher -->
    <div class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Datenspeicher</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Backend</dt>
          <dd class="text-gray-900">
            {{ storageStatus.type === 'S3' ? 'S3-kompatibel' : 'Google Drive' }}
          </dd>
        </div>
        <div v-if="storageStatus.type === 'S3'" class="flex gap-2">
          <dt class="w-32 shrink-0 text-gray-500">Zugangsdaten</dt>
          <dd class="text-gray-400 text-xs">verschlüsselt gespeichert</dd>
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
        <label
          v-if="storageStatus.type === 'GOOGLE_DRIVE'"
          class="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
        >
          <input v-model="activateS3Directly" type="checkbox" class="rounded" />
          Direkt aktivieren (kein Datentransfer, z.&nbsp;B. in Entwicklungsumgebungen)
        </label>
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

      <div v-else class="space-y-3 pt-1">
        <!-- Pending-Hinweis -->
        <div v-if="storageStatus.hasPending" class="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">
          S3-Zugangsdaten gespeichert — noch nicht aktiv. Dateien übertragen um zu aktivieren.
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button class="btn-secondary text-sm" @click="isEditingStorage = true">
            {{ storageStatus.hasPending ? 'Zugangsdaten ändern' : storageStatus.hasConfig ? 'S3-Zugangsdaten ändern' : 'S3 einrichten' }}
          </button>

          <!-- Transfer-Button -->
          <template v-if="storageStatus.hasPending">
            <button
              class="btn-secondary text-sm"
              :disabled="fileTransferStatus.status === 'running'"
              @click="onStartFileTransfer"
            >
              <span v-if="fileTransferStatus.status === 'running'" class="flex items-center gap-1">
                <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Übertragung läuft…
              </span>
              <span v-else>Dateien zu S3 übertragen</span>
            </button>
            <div v-if="fileTransferStatus.status === 'failed'" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Fehler: {{ fileTransferStatus.reason ?? 'Unbekannter Fehler' }}
            </div>
          </template>
          <div v-if="storageStatus.type === 'S3' && !storageStatus.hasPending && fileTransferStatus.status === 'done'" class="space-y-1 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <div>Übertragung abgeschlossen{{ fileTransferStatus.at ? ` (${new Date(fileTransferStatus.at).toLocaleString('de')})` : '' }}.</div>
            <template v-if="fileTransferStatus.result">
              <div class="mt-1 space-y-0.5 font-mono text-xs text-green-600">
                <div v-if="fileTransferStatus.result.templates">Vorlagen: {{ fileTransferStatus.result.templates.ok }} ok{{ fileTransferStatus.result.templates.failed ? `, ${fileTransferStatus.result.templates.failed} fehlgeschlagen` : '' }}</div>
                <div v-if="fileTransferStatus.result.memberDocs">Vertragsunterlagen: {{ fileTransferStatus.result.memberDocs.ok }} ok{{ fileTransferStatus.result.memberDocs.failed ? `, ${fileTransferStatus.result.memberDocs.failed} fehlgeschlagen` : '' }}</div>
                <div v-if="fileTransferStatus.result.wallDocs">Aktuell-Dateien: {{ fileTransferStatus.result.wallDocs.ok }} ok{{ fileTransferStatus.result.wallDocs.failed ? `, ${fileTransferStatus.result.wallDocs.failed} fehlgeschlagen` : '' }}</div>
                <div v-if="fileTransferStatus.result.otherDocs">Weitere Unterlagen: {{ fileTransferStatus.result.otherDocs.ok }} ok{{ fileTransferStatus.result.otherDocs.failed ? `, ${fileTransferStatus.result.otherDocs.failed} fehlgeschlagen` : '' }}</div>
              </div>
              <template v-for="(section, sectionKey) in fileTransferStatus.result" :key="sectionKey">
                <template v-if="section?.log?.length">
                  <div class="mt-2 space-y-1">
                    <div v-for="entry in section.log" :key="entry.source" class="rounded border border-green-200 bg-white px-2 py-1 font-mono text-xs">
                      <div class="flex items-center gap-2">
                        <span :class="{ 'text-green-600': entry.status === 'transferred' || entry.status === 'already_in_s3', 'text-red-600': entry.status === 'failed' || entry.status === 'missing_in_s3', 'text-gray-500': entry.status === 'skipped' }">{{ { transferred: '✓', already_in_s3: '=', missing_in_s3: '✗', failed: '✗', skipped: '–' }[entry.status] ?? '?' }}</span>
                        <span class="font-semibold text-gray-800">{{ entry.name }}</span>
                      </div>
                      <div class="mt-0.5 text-gray-500">von: {{ entry.source }}</div>
                      <div v-if="entry.dest" class="text-gray-500">nach: {{ entry.dest }}</div>
                      <div v-if="entry.error" class="text-red-600">{{ entry.error }}</div>
                    </div>
                  </div>
                </template>
              </template>
            </template>
          </div>
        </div>
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
