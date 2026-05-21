<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useGroupsStore } from '~/stores/groups'
import type { Group } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const isCreating = ref(false)
const newGroupName = ref('')
const newGroupEmail = ref('')
const editingGroup = ref<Group | null>(null)
const editName = ref('')
const editEmail = ref('')
const isLoading = ref(false)

onMounted(() => groupsStore.fetchGroups(slug))

async function onCreateGroup() {
  if (!newGroupName.value.trim()) return
  isLoading.value = true
  try {
    await groupsStore.createGroup(slug, {
      name: newGroupName.value.trim(),
      email: newGroupEmail.value || undefined,
    })
    newGroupName.value = ''
    newGroupEmail.value = ''
    isCreating.value = false
  } finally {
    isLoading.value = false
  }
}

function onStartEdit(group: Group) {
  editingGroup.value = group
  editName.value = group.name
  editEmail.value = group.email ?? ''
}

async function onSaveEdit() {
  if (!editingGroup.value) return
  isLoading.value = true
  try {
    await groupsStore.updateGroup(slug, editingGroup.value.id, {
      name: editName.value.trim() || undefined,
      email: editEmail.value || null,
    })
    editingGroup.value = null
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Gruppen</h1>
      <button
        v-if="authStore.currentUser?.role === 'SUPERUSER'"
        class="btn-primary"
        @click="isCreating = !isCreating"
      >
        Neue Gruppe
      </button>
    </div>

    <!-- Neue Gruppe -->
    <div v-if="isCreating" class="card mb-4 space-y-4">
      <h2 class="font-semibold text-gray-900">Gruppe anlegen</h2>
      <div>
        <label class="label">Name</label>
        <input v-model="newGroupName" type="text" class="input mt-1" placeholder="z.B. Schmetterlinge" />
      </div>
      <div>
        <label class="label">Verteiler-E-Mail (optional)</label>
        <input v-model="newGroupEmail" type="email" class="input mt-1" />
      </div>
      <div class="flex gap-3">
        <button class="btn-primary" :disabled="isLoading" @click="onCreateGroup">
          Anlegen
        </button>
        <button class="btn-secondary" @click="isCreating = false">Abbrechen</button>
      </div>
    </div>

    <div v-if="groupsStore.isLoading" class="py-12 text-center text-gray-500">Brumm, brumm …</div>

    <div v-else-if="groupsStore.groups.length === 0" class="py-12 text-center text-gray-500">
      Noch keine Gruppen vorhanden.
    </div>

    <div v-else class="space-y-3">
      <div v-for="group in groupsStore.groups" :key="group.id" class="card">
        <template v-if="editingGroup?.id === group.id">
          <div class="space-y-3">
            <div>
              <label class="label">Name</label>
              <input v-model="editName" type="text" class="input mt-1" />
            </div>
            <div>
              <label class="label">Verteiler-E-Mail</label>
              <input v-model="editEmail" type="email" class="input mt-1" />
            </div>
            <div class="flex gap-3">
              <button class="btn-primary text-sm" :disabled="isLoading" @click="onSaveEdit">Speichern</button>
              <button class="btn-secondary text-sm" @click="editingGroup = null">Abbrechen</button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900">{{ group.name }}</h3>
              <p v-if="group.email" class="text-sm text-gray-500">{{ group.email }}</p>
            </div>
            <button
              v-if="authStore.currentUser?.role === 'SUPERUSER'"
              class="btn-secondary text-sm"
              @click="onStartEdit(group)"
            >
              Bearbeiten
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
