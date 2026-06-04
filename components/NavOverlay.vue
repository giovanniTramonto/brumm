<script setup lang="ts">
defineProps<{ isOpen: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="isOpen"
    class="tablet:hidden fixed inset-0 top-16 z-[9] bg-black/20"
    aria-hidden="true"
    @click="$emit('close')"
  />
</template>
