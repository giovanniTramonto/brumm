<script setup lang="ts">
const props = defineProps<{
  label: string
  columnKey: string
  activeSortKey: string
  activeSortDir: 'asc' | 'desc'
  class?: string
}>()

defineEmits<{ sort: [key: string] }>()

const isActive = computed(() => props.activeSortKey === props.columnKey)
const ariaSort = computed(() => {
  if (!isActive.value) return 'none'
  return props.activeSortDir === 'asc' ? 'ascending' : 'descending'
})
const ariaLabel = computed(() => {
  const state = isActive.value
    ? props.activeSortDir === 'asc'
      ? 'aufsteigend'
      : 'absteigend'
    : 'nicht aktiv'
  return `Nach ${props.label} sortieren, aktuell ${state}`
})
const icon = computed(() => {
  if (!isActive.value) return '↕'
  return props.activeSortDir === 'asc' ? '↑' : '↓'
})
</script>

<template>
  <th
    scope="col"
    :class="props.class"
    class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
    :aria-sort="ariaSort"
  >
    <button
      type="button"
      class="flex items-center gap-1 text-gray-500 hover:text-gray-900"
      :aria-label="ariaLabel"
      @click="$emit('sort', columnKey)"
    >
      {{ label }}
      <span aria-hidden="true" class="text-gray-300">{{ icon }}</span>
    </button>
  </th>
</template>
