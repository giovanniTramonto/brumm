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
    const user = authStore.currentUser
    let target: string
    if (user?.role === 'MEMBER') {
      target = `/ini/${slug}/members`
    } else if (authStore.currentClub?.isSetupDone) {
      target = `/ini/${slug}/dashboard`
    } else {
      target = `/ini/${slug}/onboarding`
    }
    await navigateTo(target)
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
        <NuxtLink :to="`/ini/${slug}/login`" class="btn-primary inline-block">
          Erneut anmelden
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
