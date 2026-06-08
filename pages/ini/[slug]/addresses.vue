<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const { isSuperUser } = storeToRefs(useAuthStore())

type Address = {
  firstName: string
  lastName: string
  birthDate: string
  guardian1Name: string | null
  guardian2Name: string | null
  email1: string
  email2: string | null
  phone1: string | null
  phone2: string | null
  address: string | null
  groupId: string | null
}

type Group = { id: string; name: string }
type TeamMember = { id: string; name: string; email: string }

const addresses = ref<Address[]>([])
const groups = ref<Group[]>([])
const teamMembers = ref<TeamMember[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [addressData, teamData] = await Promise.all([
      $fetch<{ addresses: Address[]; groups: Group[] }>(`/api/ini/${slug}/addresses`),
      $fetch<{ team: TeamMember[] }>(`/api/ini/${slug}/team`).catch(() => ({ team: [] })),
    ])
    addresses.value = addressData.addresses
    groups.value = addressData.groups
    teamMembers.value = teamData.team
  } finally {
    isLoading.value = false
  }
})

const groupedSections = computed(() => {
  if (groups.value.length === 0) return null

  const sections = groups.value.map((g) => ({
    name: g.name,
    members: addresses.value.filter((a) => a.groupId === g.id),
  }))

  const ungrouped = addresses.value.filter((a) => !a.groupId)
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

    <div v-else class="card mb-6">
      <AddressTable :members="addresses" />
      <p v-if="addresses.length === 0" class="mt-4 text-sm text-gray-500">
        Keine aktiven Kinder vorhanden.
      </p>
    </div>

    <div v-if="!isLoading" class="card">
      <h2 class="mb-4 text-xl font-semibold text-gray-900">Team</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th class="pb-3 pr-8">Name</th>
              <th class="pb-3">E-Mail</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in teamMembers" :key="m.id" class="border-t border-gray-100 whitespace-nowrap">
              <td class="py-4 pr-8 font-medium text-gray-900">{{ m.name }}</td>
              <td class="py-4 text-gray-600">
                <a :href="`mailto:${m.email}`" class="text-blue-600 hover:underline">{{ m.email }}</a>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="teamMembers.length === 0" class="mt-4 text-sm text-gray-500">
          Noch keine Teammitglieder eingetragen.
        </p>
      </div>
    </div>
  </div>
</template>
