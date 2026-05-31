<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Anmelden – Brumm' })

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
  <main id="main-content" class="flex flex-grow flex-col items-center bg-gray-50 px-4 py-12 tablet:py-16">
    <div class="w-full max-w-md">
      <h1 class="sr-only">Anmelden</h1>
      <div class="card" aria-live="polite" aria-atomic="true">
        <template v-if="step === 'email'">
          <h2 class="mb-6 text-xl font-semibold text-gray-900">Anmelden</h2>
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
            Andere E-Mail verwenden
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
  </main>
</template>
