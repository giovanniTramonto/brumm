<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

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

const addresses = ref<Address[]>([])
const groups = ref<Group[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const data = await $fetch<{ addresses: Address[]; groups: Group[] }>(
      `/api/ini/${slug}/addresses`,
    )
    addresses.value = data.addresses
    groups.value = data.groups
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

    <div v-else class="card">
      <AddressTable :members="addresses" />
      <p v-if="addresses.length === 0" class="mt-4 text-sm text-gray-500">
        Keine aktiven Kinder vorhanden.
      </p>
    </div>
  </div>
</template>
