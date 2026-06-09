<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

const props = defineProps<{ slug: string }>()

const membersStore = useMembersStore()

onMounted(() => {
  if (membersStore.members.length === 0) {
    membersStore.fetchMembers(props.slug)
  }
})

const WITHOUT_GROUP = 'Ohne Gruppe'

function formatBirthDate(birthDate: string): string {
  return new Date(birthDate).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const active = computed(() =>
  membersStore.members.filter((m) => m.status === 'ACTIVE' || m.status === 'INACTIVE'),
)

const ungrouped = computed(() => active.value.filter((m) => !m.groupId))

const groupedChildren = computed(() => {
  const map = new Map<string, { id: string; name: string; children: typeof active.value }>()

  for (const m of active.value.filter((m) => m.groupId)) {
    const key = m.group?.name ?? m.groupId ?? ''
    if (!map.has(key)) {
      map.set(key, { id: m.group?.id ?? key, name: key, children: [] })
    }
    const entry = map.get(key)
    if (entry) entry.children.push(m)
  }

  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'de')).map(([, group]) => group)
})
</script>

<template>
  <div class="card">
    <h2 class="mb-4 text-lg font-semibold text-gray-900">Gruppen</h2>

    <LoadingBrumm v-if="membersStore.isLoading" />

    <p v-else-if="groupedChildren.length === 0" class="text-sm text-gray-500">
      Keine aktiven Kinder vorhanden.
    </p>

    <div
      v-else
      class="flex flex-col divide-y tablet:grid tablet:divide-y-0 tablet:divide-x divide-gray-200"
      :style="`grid-template-columns: repeat(${groupedChildren.length}, minmax(0, 1fr))`"
    >
      <div v-for="(group, i) in groupedChildren" :key="group.id" :class="i === 0 ? 'pb-5 tablet:pb-0 tablet:pr-5' : i === groupedChildren.length - 1 ? 'pt-5 tablet:pt-0 tablet:px-5' : 'py-5 tablet:py-0 tablet:px-5'">
        <p class="font-mono text-3xl font-bold text-gray-900">{{ group.children.length }}</p>
        <h3 class="mb-2 mt-1 text-sm font-medium text-gray-500 uppercase tracking-wide">{{ group.name }}</h3>
        <ul class="space-y-1">
          <li v-for="child in group.children" :key="child.id" class="text-sm">
            <NuxtLink
              :to="`/ini/${slug}/members/${child.id}`"
              class="flex items-center justify-between gap-4 font-medium text-primary-700 hover:text-primary-900"
            >
              <span>{{ child.firstName }} {{ child.lastName }}&nbsp;→</span>
              <span class="font-mono text-gray-400">{{ formatBirthDate(child.birthDate) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="ungrouped.length > 0 && !membersStore.isLoading" class="mt-6 text-sm text-orange-800">
      {{ ungrouped.length }} {{ ungrouped.length === 1 ? 'Kind' : 'Kinder' }} ohne Gruppe:
      {{ ungrouped.map(m => `${m.firstName} ${m.lastName}`).join(', ') }}
    </div>
  </div>
</template>
