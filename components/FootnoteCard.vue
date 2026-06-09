<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const { isMember, isTeam, isSuperUser } = storeToRefs(authStore)

const borderClass = computed(() => {
  if (isMember.value) return 'border-member-300 text-member-800'
  if (isTeam.value) return 'border-team-300 text-team-800'
  if (isSuperUser.value) return 'border-admin-300 text-admin-800'
  return 'border-ini-300 text-ini-800'
})
</script>

<template>
  <div
    class="mt-8 mb-8 border-t pt-4"
    :class="borderClass"
  >
    <slot />
  </div>
</template>
