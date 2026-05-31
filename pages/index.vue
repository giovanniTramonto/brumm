<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'Brumm – Verwaltungssoftware für Elterninitiativ-Kitas' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24 text-center">
    <h1 class="text-4xl font-bold text-gray-900 tablet:text-5xl">Hallo bei Brumm</h1>
    <p class="mx-auto mt-6 max-w-xl text-lg text-gray-500">
      Die Verwaltungssoftware für Berliner Elterninitiativ-Kindertagesstätten.
    </p>
    <div class="mt-10 flex justify-center gap-4">
      <NuxtLink to="/login" class="btn-primary">Jetzt anmelden</NuxtLink>
      <NuxtLink to="/register" class="btn-secondary">Kita registrieren</NuxtLink>
    </div>
  </main>
</template>
