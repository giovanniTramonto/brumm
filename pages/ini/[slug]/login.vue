<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

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
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Brumm Anmeldung</h1>
      </div>

      <div class="card">
        <template v-if="!isSent">
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
            <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {{ error }}
            </div>
            <button type="submit" class="btn-primary w-full" :disabled="isLoading">
              {{ isLoading ? "Wird gesendet…" : "Magic Link senden" }}
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
  </div>
</template>
