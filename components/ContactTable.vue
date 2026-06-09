<script setup lang="ts">
defineProps<{
  title: string
  members: { id: string; name: string; email: string }[]
  emptyText: string
}>()
</script>

<template>
  <div class="card mt-6">
    <h2 class="mb-4 text-xl font-semibold text-gray-900">{{ title }}</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th class="pb-3 pr-8">Name</th>
            <th class="pb-3">E-Mail</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-t border-gray-100 whitespace-nowrap">
            <td class="py-4 pr-8 font-medium text-gray-900">{{ m.name }}</td>
            <td class="py-4 text-gray-600">
              <a :href="`mailto:${m.email}`" class="text-blue-600 hover:underline">{{ m.email }}</a>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="members.length === 0" class="mt-4 text-sm text-gray-500">{{ emptyText }}</p>
    </div>
  </div>
</template>
