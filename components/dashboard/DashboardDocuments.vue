<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{ slug: string }>()
const authStore = useAuthStore()

const { canManageClub } = storeToRefs(authStore)

type Document = { id: string; name: string }
const data = await $fetch<{ documents: Document[] }>(`/api/ini/${props.slug}/documents`).catch(
  () => ({ documents: [] }),
)
const documents = ref(data.documents)

const isVisible = computed(() => canManageClub.value || documents.value.length > 0)
</script>

<template>
  <div v-if="isVisible" class="card mt-6">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-medium text-gray-900">Unterlagen</h2>
      <NuxtLink v-if="canManageClub" :to="`/ini/${props.slug}/documents`" class="btn-secondary text-xs">Bearbeiten</NuxtLink>
    </div>
    <p v-if="documents.length === 0" class="text-sm text-gray-500">Noch keine Unterlagen.</p>
    <ul v-else class="space-y-1">
      <li v-for="doc in documents" :key="doc.id">
        <a
          :href="`/api/ini/${props.slug}/documents/${doc.id}/download`"
          class="text-sm font-medium text-primary-700 hover:text-primary-900"
          target="_blank"
          rel="noopener noreferrer"
        >{{ doc.name }} ↗</a>
      </li>
    </ul>
  </div>
</template>
