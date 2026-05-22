<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const isMember = computed(() => authStore.currentUser?.role === 'MEMBER')
</script>

<template>
  <div
    class="mt-8 mb-8 border-t pt-4"
    :class="isMember ? 'border-member-300 text-member-800' : 'border-ini-300 text-ini-800'"
  >
    <slot />
  </div>
</template>
