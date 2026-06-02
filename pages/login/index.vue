<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Anmelden – Brumm' })

const { data } = await useFetch<{ clubs: { name: string; slug: string }[] }>('/api/clubs')
const clubs = computed(() => data.value?.clubs ?? [])

const selectedSlug = ref('')

function onSubmit() {
  if (!selectedSlug.value) return
  navigateTo(`/login/${selectedSlug.value}`)
}
</script>

<template>
  <main id="main-content" class="flex flex-grow flex-col items-center bg-gray-50 px-4 py-12 tablet:py-16">
    <div class="w-full max-w-md">
      <h1 class="sr-only">Anmelden</h1>
      <div class="card">
        <h2 class="mb-6 text-xl font-semibold text-gray-900">Anmelden</h2>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="club" class="label">Kita auswählen</label>
            <select id="club" v-model="selectedSlug" class="input mt-1" required>
              <option value="" disabled>Bitte auswählen …</option>
              <option v-for="club in clubs" :key="club.slug" :value="club.slug">
                {{ club.name }}
              </option>
            </select>
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="!selectedSlug">
            Weiter
          </button>
        </form>
      </div>
    </div>
  </main>
</template>
