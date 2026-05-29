<script setup lang="ts">
defineProps<{ error: string; slug: string }>()
</script>

<template>
  <div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
    <p>{{ error }}</p>
    <NuxtLink
      v-if="error.includes('Google')"
      :to="`/ini/${slug}/settings`"
      class="mt-2 inline-block font-medium underline hover:no-underline"
    >
      Zu den Einstellungen →
    </NuxtLink>
  </div>
</template>
