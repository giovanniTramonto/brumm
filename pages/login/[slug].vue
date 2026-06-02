<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'public' })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

if (authStore.currentUser) {
  await navigateTo(`/ini/${slug}/dashboard`, { replace: true })
}

const { data: clubsData } = await useFetch<{ clubs: { name: string; slug: string }[] }>(
  '/api/clubs',
)
const clubName = computed(() => clubsData.value?.clubs.find((c) => c.slug === slug)?.name ?? slug)

const email = ref('')
const isLoading = ref(false)
const isSent = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  if (!email.value) return
  isLoading.value = true
  error.value = null
  try {
    await authStore.login(slug, email.value)
    isSent.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Senden'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main id="main-content" class="flex flex-grow flex-col items-center bg-gray-50 px-4 py-12 tablet:py-16">
    <div class="w-full max-w-md">
      <h1 class="sr-only">Anmelden</h1>
      <div class="card" aria-live="polite" aria-atomic="true">
        <template v-if="!isSent">
          <h2 class="mb-1 text-xl font-semibold text-gray-900">Anmelden</h2>
          <p class="mb-6 text-sm text-gray-500">{{ clubName }}</p>
          <p class="mb-4 text-sm text-gray-600">
            Gib deine E-Mail-Adresse ein. Wir senden dir einen Anmelde-Link.
          </p>
          <form class="space-y-4" @submit.prevent="onSubmit">
            <div>
              <label for="email" class="label">E-Mail-Adresse</label>
              <input
                id="email"
                v-model="email"
                type="email"
                class="input mt-1"
                placeholder="deine@email.de"
                required
              />
            </div>
            <div v-if="error" role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {{ error }}
            </div>
            <button type="submit" class="btn-primary w-full" :disabled="isLoading">
              {{ isLoading ? 'Wird gesendet…' : 'Anmelde-Link senden' }}
            </button>
          </form>
        </template>

        <template v-else>
          <div class="text-center">
            <p class="text-lg font-medium text-gray-900">Link gesendet!</p>
            <p class="mt-2 text-sm text-gray-600">
              Falls diese E-Mail in unserem System vorhanden ist, hast du einen Anmelde-Link
              erhalten. Der Link ist 15 Minuten gültig.
            </p>
            <button class="btn-secondary mt-4 text-sm" @click="isSent = false; email = ''">
              Andere E-Mail verwenden
            </button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>
