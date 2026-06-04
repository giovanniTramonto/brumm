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

    <div v-if="isLoading" class="text-sm text-gray-500" role="status" aria-live="polite">
      Brumm, brumm …
    </div>

    <template v-else-if="groupedSections && groupedSections.length > 0">
      <div v-for="section in groupedSections" :key="section.name" class="card overflow-x-auto mb-6">
        <h2 class="mb-4 text-xl font-semibold text-gray-900">{{ section.name }}</h2>
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th class="pb-3 pr-8 w-1/5">Kind</th>
              <th class="pb-3 pr-8">Geboren</th>
              <th class="pb-3 pr-8 w-1/5">Adresse</th>
              <th class="pb-3 pr-8">Name</th>
              <th class="pb-3 pr-8">E-Mail</th>
              <th class="pb-3">Telefon</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in section.members" :key="`${m.firstName}-${m.lastName}`">
              <tr class="border-t border-gray-100">
                <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 font-medium text-gray-900 whitespace-nowrap align-middle">
                  {{ m.firstName }} {{ m.lastName }}
                </td>
                <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 text-gray-600 align-middle whitespace-nowrap">
                  {{ new Date(m.birthDate).toLocaleDateString('de-DE') }}
                </td>
                <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 text-gray-600 align-middle">
                  {{ m.address ?? '–' }}
                </td>
                <td class="pt-4 pb-1 pr-8 text-gray-700">{{ m.guardian1Name ?? '' }}</td>
                <td class="pt-4 pb-1 pr-8 text-gray-700">{{ m.email1 }}</td>
                <td class="pt-4 pb-1 text-gray-700">{{ m.phone1 ?? '' }}</td>
              </tr>
              <tr v-if="m.guardian2Name || m.email2">
                <td class="pb-4 pr-8 text-gray-700">{{ m.guardian2Name ?? '' }}</td>
                <td class="pb-4 pr-8 text-gray-700">{{ m.email2 ?? '' }}</td>
                <td class="pb-4 text-gray-700">{{ m.phone2 ?? '' }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th class="pb-3 pr-8 w-1/5">Kind</th>
            <th class="pb-3 pr-8">Geboren</th>
            <th class="pb-3 pr-8 w-1/5">Adresse</th>
            <th class="pb-3 pr-8">Name</th>
            <th class="pb-3 pr-8">E-Mail</th>
            <th class="pb-3">Telefon</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="m in addresses" :key="`${m.firstName}-${m.lastName}`">
            <tr class="border-t border-gray-100">
              <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 font-medium text-gray-900 whitespace-nowrap align-middle">
                {{ m.firstName }} {{ m.lastName }}
              </td>
              <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 text-gray-600 align-middle whitespace-nowrap">
                {{ new Date(m.birthDate).toLocaleDateString('de-DE') }}
              </td>
              <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 text-gray-600 align-middle">
                {{ m.address ?? '–' }}
              </td>
              <td class="pt-4 pb-1 pr-8 text-gray-700">{{ m.guardian1Name ?? '' }}</td>
              <td class="pt-4 pb-1 pr-8 text-gray-700">{{ m.email1 }}</td>
              <td class="pt-4 pb-1 text-gray-700">{{ m.phone1 ?? '' }}</td>
            </tr>
            <tr v-if="m.guardian2Name || m.email2">
              <td class="pb-4 pr-8 text-gray-700">{{ m.guardian2Name ?? '' }}</td>
              <td class="pb-4 pr-8 text-gray-700">{{ m.email2 ?? '' }}</td>
              <td class="pb-4 text-gray-700">{{ m.phone2 ?? '' }}</td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="addresses.length === 0" class="mt-4 text-sm text-gray-500">
        Keine aktiven Kinder vorhanden.
      </p>
    </div>
  </div>
</template>
