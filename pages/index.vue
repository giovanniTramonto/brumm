<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const isLoading = ref(false)
const step = ref<'email' | 'select' | 'sent'>('email')
const clubs = ref<{ name: string; slug: string }[]>([])
const error = ref<string | null>(null)

async function onSubmit() {
  if (!email.value) return
  isLoading.value = true
  error.value = null
  try {
    const result = await $fetch<{ clubs: { name: string; slug: string }[] }>('/api/login/lookup', {
      method: 'POST',
      body: { email: email.value },
    })

    if (result.clubs.length === 0) {
      step.value = 'sent'
    } else if (result.clubs.length === 1) {
      await sendMagicLink(result.clubs[0].slug)
    } else {
      clubs.value = result.clubs
      step.value = 'select'
    }
  } catch {
    error.value = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
  } finally {
    isLoading.value = false
  }
}

async function onSelectClub(slug: string) {
  isLoading.value = true
  error.value = null
  try {
    await sendMagicLink(slug)
  } finally {
    isLoading.value = false
  }
}

async function sendMagicLink(slug: string) {
  await $fetch(`/api/ini/${slug}/auth/magic-link`, {
    method: 'POST',
    body: { email: email.value },
  })
  step.value = 'sent'
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Brumm Anmeldung</h1>
      </div>

      <div class="card">
        <template v-if="step === 'email'">
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
              {{ isLoading ? 'Wird gesucht…' : 'Magic Link senden' }}
            </button>
          </form>
        </template>

        <template v-else-if="step === 'select'">
          <p class="mb-4 text-sm text-gray-600">
            Deine E-Mail ist bei mehreren Kitas registriert. Für welche möchtest du dich anmelden?
          </p>
          <div class="space-y-2">
            <button
              v-for="club in clubs"
              :key="club.slug"
              class="btn-secondary w-full text-left"
              :disabled="isLoading"
              @click="onSelectClub(club.slug)"
            >
              {{ club.name }}
            </button>
          </div>
          <button class="mt-4 text-sm text-gray-500 hover:text-gray-900" @click="step = 'email'">
            ← Andere E-Mail verwenden
          </button>
        </template>

        <template v-else>
          <div class="text-center">
            <p class="text-lg font-medium text-gray-900">Link gesendet!</p>
            <p class="mt-2 text-sm text-gray-600">
              Falls diese E-Mail in unserem System vorhanden ist, hast du einen Anmelde-Link
              erhalten. Der Link ist 15 Minuten gültig.
            </p>
            <button
              class="btn-secondary mt-4 text-sm"
              @click="step = 'email'; email = ''; clubs = []"
            >
              Andere E-Mail verwenden
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
