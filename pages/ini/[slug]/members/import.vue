<script setup lang="ts">
definePageMeta({ middleware: ["auth", "role"], requiredRole: "SUPERUSER" })

import type { ImportResult, ImportRow } from "~/types/import"

const route = useRoute()
const slug = route.params.slug as string

const step = ref<"upload" | "preview" | "confirm" | "done">("upload")
const csvContent = ref("")
const previewResult = ref<ImportResult | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const confirmResult = ref<{ succeeded: number; failed: number } | null>(null)

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    csvContent.value = (e.target?.result as string) ?? ""
  }
  reader.readAsText(file, "utf-8")
}

async function onPreview() {
  if (!csvContent.value) return
  isLoading.value = true
  error.value = null
  try {
    const result = await $fetch<ImportResult>(`/api/ini/${slug}/members/import/preview`, {
      method: "POST",
      body: { csvContent: csvContent.value },
    })
    previewResult.value = result
    step.value = "preview"
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "Fehler bei der Vorschau"
  } finally {
    isLoading.value = false
  }
}

async function onConfirm() {
  if (!previewResult.value) return
  isLoading.value = true
  error.value = null

  const importableRows = previewResult.value.rows
    .filter((r) => r.isImportable)
    .map((r) => r.rowIndex)

  const lines = csvContent.value.split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const getCol = (row: string[], name: string) => row[headers.indexOf(name)]?.trim() ?? ""

  const rows: ImportRow[] = importableRows
    .map((idx) => {
      const row = lines[idx - 1]?.split(",") ?? []
      return {
        firstName: getCol(row, "firstname"),
        lastName: getCol(row, "lastname"),
        birthDate: getCol(row, "birthdate"),
        guardian1Name: getCol(row, "guardian1name"),
        guardian2Name: getCol(row, "guardian2name") || undefined,
        email1: getCol(row, "email1"),
        email2: getCol(row, "email2") || undefined,
        groupId: getCol(row, "groupid") || undefined,
        rowIndex: idx,
      } satisfies ImportRow
    })

  try {
    const result = await $fetch<{ succeeded: number; failed: number }>(
      `/api/ini/${slug}/members/import/confirm`,
      { method: "POST", body: { rows } }
    )
    confirmResult.value = result
    step.value = "done"
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "Import fehlgeschlagen"
  } finally {
    isLoading.value = false
  }
}

async function onDownloadTemplate() {
  const url = `/api/ini/${slug}/members/import/template`
  window.open(url, "_blank")
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink :to="`/ini/${slug}/members`" class="text-sm text-gray-500 hover:text-gray-900">
        ← Zurück
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">CSV-Import</h1>
    </div>

    <!-- Upload -->
    <div v-if="step === 'upload'" class="card space-y-4">
      <div>
        <button class="btn-secondary text-sm" @click="onDownloadTemplate">
          Vorlage herunterladen
        </button>
      </div>
      <div>
        <label class="label">CSV-Datei hochladen</label>
        <input type="file" accept=".csv,text/csv" class="mt-1 block text-sm" @change="onFileChange" />
      </div>
      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
      <button class="btn-primary" :disabled="!csvContent || isLoading" @click="onPreview">
        {{ isLoading ? "Wird analysiert…" : "Vorschau anzeigen" }}
      </button>
    </div>

    <!-- Vorschau -->
    <div v-if="step === 'preview' && previewResult" class="space-y-4">
      <div class="card flex gap-6 text-sm">
        <div>
          <span class="text-gray-500">Gesamt:</span>
          <strong class="ml-1">{{ previewResult.total }}</strong>
        </div>
        <div>
          <span class="text-green-700">Importierbar:</span>
          <strong class="ml-1">{{ previewResult.importable }}</strong>
        </div>
        <div>
          <span class="text-red-700">Übersprungen:</span>
          <strong class="ml-1">{{ previewResult.skipped }}</strong>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-500">Zeile</th>
              <th class="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th class="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th class="px-4 py-2 text-left font-medium text-gray-500">Fehler</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in previewResult.rows" :key="row.rowIndex">
              <td class="px-4 py-2 text-gray-500">{{ row.rowIndex }}</td>
              <td class="px-4 py-2">{{ row.lastName }}, {{ row.firstName }}</td>
              <td class="px-4 py-2">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="row.isImportable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ row.isImportable ? "✓ OK" : "✗ Fehler" }}
                </span>
              </td>
              <td class="px-4 py-2 text-red-700">
                {{ row.errors.map((e) => e.message).join(", ") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex gap-3">
        <button class="btn-secondary" @click="step = 'upload'">Zurück</button>
        <button
          class="btn-primary"
          :disabled="previewResult.importable === 0 || isLoading"
          @click="onConfirm"
        >
          {{ isLoading ? "Wird importiert…" : `${previewResult.importable} Mitglieder importieren` }}
        </button>
      </div>
      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
    </div>

    <!-- Fertig -->
    <div v-if="step === 'done' && confirmResult" class="card space-y-4">
      <h2 class="font-semibold text-gray-900">Import abgeschlossen</h2>
      <p class="text-sm text-gray-700">
        <span class="text-green-700 font-medium">{{ confirmResult.succeeded }} erfolgreich</span>
        <span v-if="confirmResult.failed > 0" class="ml-3 text-red-700 font-medium">
          {{ confirmResult.failed }} fehlgeschlagen
        </span>
      </p>
      <NuxtLink :to="`/ini/${slug}/members`" class="btn-primary inline-block">
        Zur Mitgliederliste
      </NuxtLink>
    </div>
  </div>
</template>
