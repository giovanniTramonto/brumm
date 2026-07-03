<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useDocumentsStore } from '~/stores/documents'

const props = defineProps<{ slug: string }>()
const authStore = useAuthStore()
const documentsStore = useDocumentsStore()

const { canManageClub } = storeToRefs(authStore)

await documentsStore.fetchDocuments(props.slug)

const isVisible = computed(() => canManageClub.value || documentsStore.documents.length > 0)
</script>

<template>
  <div v-if="isVisible" class="card mt-6">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-medium text-gray-900">Infos</h2>
      <NuxtLink v-if="canManageClub" :to="`/ini/${props.slug}/wall`" class="btn-secondary text-xs">Bearbeiten</NuxtLink>
    </div>
    <p v-if="documentsStore.documents.length === 0" class="text-sm text-gray-500">Noch keine Einträge.</p>
    <ul v-else class="space-y-1">
      <li v-for="doc in documentsStore.documents" :key="doc.id">
        <a
          :href="doc.type === 'link' ? (doc.url ?? '#') : `/api/ini/${props.slug}/documents/${doc.id}/download`"
          class="text-sm font-medium text-primary-700 hover:text-primary-900"
          target="_blank"
          rel="noopener noreferrer"
        >{{ doc.name }} ↗</a>
      </li>
    </ul>
  </div>
</template>
