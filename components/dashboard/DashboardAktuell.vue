<script setup lang="ts">
defineProps<{ slug: string }>()
</script>

<template>
  <div class="card mt-6">
    <h2 class="mb-3 text-sm font-medium text-gray-900">Aktuell</h2>
    <NuxtLink :to="`/ini/${$props.slug}/addresses`" class="text-sm font-medium text-primary-700 hover:text-primary-900">
      Adressliste →
    </NuxtLink>
  </div>
</template>
