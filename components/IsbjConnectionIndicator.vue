<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useIsbjStore } from '~/stores/isbj'

// Shows in the navigation whether ISBJ works. Checks on first load, every 5 minutes (the server's
// credential cache TTL) and when the tab becomes visible again; the store skips fresh results.
const props = defineProps<{ slug: string }>()

const POLL_INTERVAL_MS = 5 * 60_000

const isbjStore = useIsbjStore()
const { connectionStatus, connectionError, isCheckingConnection } = storeToRefs(isbjStore)

function check() {
  isbjStore.checkConnection(props.slug)
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') check()
}

let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  check()
  interval = setInterval(check, POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(() => props.slug, check)

const isVisible = computed(
  () => connectionStatus.value === 'connected' || connectionStatus.value === 'error',
)

const label = computed(() =>
  connectionStatus.value === 'connected'
    ? 'ISBJ verbunden'
    : `ISBJ-Verbindung gestört: ${connectionError.value ?? 'unbekannter Fehler'}`,
)
</script>

<template>
  <NuxtLink
    v-if="isVisible"
    :to="`/ini/${slug}/contracts`"
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="connectionStatus === 'connected' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'"
    :title="label"
    :aria-label="label"
  >
    <span
      aria-hidden="true"
      class="h-2 w-2 rounded-full"
      :class="[
        connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500',
        isCheckingConnection && 'animate-pulse',
      ]"
    />
    ISBJ
  </NuxtLink>
</template>
