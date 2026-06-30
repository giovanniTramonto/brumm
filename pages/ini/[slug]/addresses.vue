<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

const membersStore = useMembersStore()
const teamStore = useTeamStore()
const managersStore = useManagersStore()

const { members, groups } = storeToRefs(membersStore)
const { team } = storeToRefs(teamStore)
const { managers } = storeToRefs(managersStore)

const isLoading = computed(
  () => membersStore.isLoading || teamStore.isLoading || managersStore.isLoading,
)

const activeMembers = computed(() =>
  members.value.filter((m) => m.status === 'ACTIVE' || m.status === 'INACTIVE'),
)

const groupedSections = computed(() => {
  if (groups.value.length === 0) return null

  const sections = groups.value.map((g) => ({
    name: g.name,
    members: activeMembers.value.filter((m) => m.groupId === g.id),
  }))

  const ungrouped = activeMembers.value.filter((m) => !m.groupId)
  if (ungrouped.length > 0) sections.push({ name: 'Ohne Gruppe', members: ungrouped })

  return sections.filter((s) => s.members.length > 0)
})
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-900">← Zurück</NuxtLink>
    </div>

    <h1 class="mb-6 text-2xl font-bold text-gray-900">Adressliste</h1>

    <LoadingBrumm v-if="isLoading" />

    <template v-else-if="groupedSections && groupedSections.length > 0">
      <div v-for="section in groupedSections" :key="section.name" class="card mb-6">
        <h2 class="mb-4 text-xl font-semibold text-gray-900">{{ section.name }}</h2>
        <AddressTable :members="section.members" />
      </div>
    </template>

    <div v-else-if="!isLoading" class="card mb-6">
      <AddressTable :members="activeMembers" />
      <p v-if="activeMembers.length === 0" class="mt-4 text-sm text-gray-500">
        Keine aktiven Kinder vorhanden.
      </p>
    </div>

    <template v-if="!isLoading">
      <ContactTable title="Team" :members="team" emptyText="Noch keine Teammitglieder eingetragen." />
      <ContactTable title="Vorstand" :members="managers" emptyText="Noch keine Vorstandsmitglieder eingetragen." />
    </template>
  </div>
</template>
