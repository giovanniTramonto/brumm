<script setup lang="ts">
defineProps<{ name: 'person' | 'pencil' | 'chevron-down' }>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'person'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </template>
    <template v-if="name === 'pencil'">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <polygon points="7.5,20.5 2,22 3.5,16.5" fill="currentColor" stroke="none" />
    </template>
    <template v-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
  </svg>
</template>
