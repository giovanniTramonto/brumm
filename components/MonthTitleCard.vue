<script setup lang="ts">
const props = defineProps<{
  monthLabel: string
  prevMonthQuery: { year: number; month: number }
  nextMonthQuery: { year: number; month: number }
  displayYear: number
  isEditing: boolean
  editTab?: string
  canGoPrev?: boolean
  canGoNext?: boolean
  showNav?: boolean
}>()

const emit = defineEmits<{ action: [] }>()

const prevLinkQuery = computed(() =>
  props.isEditing
    ? { ...props.prevMonthQuery, edit: '1', tab: props.editTab }
    : props.prevMonthQuery,
)

const nextLinkQuery = computed(() =>
  props.isEditing
    ? { ...props.nextMonthQuery, edit: '1', tab: props.editTab }
    : props.nextMonthQuery,
)

function monthShort(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'short' })
}

function monthLong(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
}
</script>

<template>
  <div
    class="card sticky top-4 z-10 mb-4"
    :class="isEditing && 'bg-gray-900 ring-gray-700'"
  >
    <div class="relative flex flex-col gap-2 mobile:grid mobile:grid-cols-[1fr_auto_1fr] mobile:items-start">
      <h2
        class="whitespace-nowrap pr-16 text-lg font-semibold mobile:pr-0"
        :class="isEditing ? 'text-white' : 'text-gray-900'"
      >{{ monthLabel }}</h2>
      <div class="flex items-center gap-3 py-2 text-xs">
        <NuxtLink v-if="canGoPrev !== false" :to="{ query: prevLinkQuery }" class="whitespace-nowrap hover:underline" :class="isEditing ? 'text-blue-300' : 'text-blue-600'">←
          <span class="hidden desktop:inline">{{ monthLong(prevMonthQuery.year, prevMonthQuery.month) }}</span><span class="desktop:hidden">{{ monthShort(prevMonthQuery.year, prevMonthQuery.month) }}</span>
        </NuxtLink>
        <span v-else class="whitespace-nowrap" :class="isEditing ? 'text-gray-600' : 'text-gray-400'">←
          <span class="hidden desktop:inline">{{ monthLong(prevMonthQuery.year, prevMonthQuery.month) }}</span><span class="desktop:hidden">{{ monthShort(prevMonthQuery.year, prevMonthQuery.month) }}</span>
        </span>
        <span :class="isEditing ? 'text-gray-600' : 'text-gray-300'">|</span>
        <NuxtLink v-if="canGoNext !== false" :to="{ query: nextLinkQuery }" class="whitespace-nowrap hover:underline" :class="isEditing ? 'text-blue-300' : 'text-blue-600'">
          <span class="hidden desktop:inline">{{ monthLong(nextMonthQuery.year, nextMonthQuery.month) }}</span><span class="desktop:hidden">{{ monthShort(nextMonthQuery.year, nextMonthQuery.month) }}</span> →
        </NuxtLink>
        <span v-else class="whitespace-nowrap" :class="isEditing ? 'text-gray-600' : 'text-gray-400'">
          <span class="hidden desktop:inline">{{ monthLong(nextMonthQuery.year, nextMonthQuery.month) }}</span><span class="desktop:hidden">{{ monthShort(nextMonthQuery.year, nextMonthQuery.month) }}</span> →
        </span>
      </div>
      <div class="absolute right-0 top-0 mobile:static mobile:flex mobile:justify-end">
        <button type="button" class="text-xs mobile:text-sm" :class="isEditing ? 'btn-primary' : 'btn-secondary'" @click="emit('action')">
          {{ isEditing ? 'Fertig' : 'Bearbeiten' }}
        </button>
      </div>
    </div>
    <slot />
  </div>
</template>
