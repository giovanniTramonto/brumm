<script setup lang="ts">
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

defineProps<{ members: Address[] }>()
</script>

<template>
  <div class="overflow-x-auto">
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
        <template v-for="m in members" :key="`${m.firstName}-${m.lastName}`">
          <tr class="border-t border-gray-100 whitespace-nowrap">
            <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 font-medium text-gray-900 align-middle">
              {{ m.firstName }} {{ m.lastName }}
            </td>
            <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 text-gray-600 align-middle font-mono">
              {{ new Date(m.birthDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
            </td>
            <td :rowspan="m.guardian2Name || m.email2 ? 2 : 1" class="py-4 pr-8 w-1/5 text-gray-600 align-middle">
              {{ m.address ?? '–' }}
            </td>
            <td class="pt-4 pb-1 pr-8 text-gray-700">{{ m.guardian1Name ?? '' }}</td>
            <td class="pt-4 pb-1 pr-8 text-gray-700"><a :href="`mailto:${m.email1}`" class="text-blue-600 hover:underline">{{ m.email1 }}</a></td>
            <td class="pt-4 pb-1 text-gray-700 font-mono"><a v-if="m.phone1" :href="`tel:${m.phone1}`" class="text-blue-600 hover:underline">{{ m.phone1 }}</a></td>
          </tr>
          <tr v-if="m.guardian2Name || m.email2" class="whitespace-nowrap">
            <td class="pb-4 pr-8 text-gray-700">{{ m.guardian2Name ?? '' }}</td>
            <td class="pb-4 pr-8 text-gray-700"><a v-if="m.email2" :href="`mailto:${m.email2}`" class="text-blue-600 hover:underline">{{ m.email2 }}</a></td>
            <td class="pb-4 text-gray-700 font-mono"><a v-if="m.phone2" :href="`tel:${m.phone2}`" class="text-blue-600 hover:underline">{{ m.phone2 }}</a></td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
