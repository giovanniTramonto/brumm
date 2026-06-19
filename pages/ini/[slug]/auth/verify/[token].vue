<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const token = route.params.token as string
const authStore = useAuthStore()

const error = ref<string | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  try {
    await authStore.verifyToken(slug, token)
    await navigateTo(`/ini/${slug}/dashboard`)
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Anmeldung fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="text-center">
      <div v-if="isLoading">
        <p class="text-gray-600">Anmeldung wird überprüft…</p>
      </div>
      <div v-else-if="error" class="max-w-sm space-y-4">
        <p class="text-lg font-medium text-red-700">{{ error }}</p>
        <NuxtLink :to="`/login/${slug}`" class="btn-primary inline-block">
          Erneut anmelden
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
