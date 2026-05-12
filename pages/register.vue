<script setup lang="ts">
definePageMeta({ layout: false })

const name = ref('')
const slug = ref('')
const email = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const isSuccess = ref(false)
const isSlugManuallyEdited = ref(false)

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

watch(name, (newName) => {
  if (!isSlugManuallyEdited.value) {
    slug.value = normalizeSlug(newName)
  }
})

function onSlugInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  slug.value = normalizeSlug(value)
  isSlugManuallyEdited.value = true
}

async function onSubmit() {
  if (!name.value.trim() || !slug.value || !email.value) return
  isLoading.value = true
  error.value = null
  try {
    await $fetch('/api/register', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        slug: slug.value,
        email: email.value.trim(),
      },
    })
    isSuccess.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Registrierung fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-gray-900">Brumm</h1>
        <p class="mt-2 text-gray-600">Kindergarten-Vereinsverwaltung</p>
      </div>

      <div class="card">
        <template v-if="isSuccess">
          <div class="space-y-4 text-center">
            <div class="text-4xl">✉️</div>
            <h2 class="text-xl font-semibold text-gray-900">E-Mail verschickt!</h2>
            <p class="text-sm text-gray-600">
              Wir haben einen Einrichtungs-Link an <strong>{{ email }}</strong> geschickt.
              Bitte prüfe dein Postfach und klicke auf den Link, um die Einrichtung abzuschließen.
            </p>
          </div>
        </template>

        <template v-else>
          <h2 class="mb-6 text-xl font-semibold text-gray-900">Verein registrieren</h2>

          <form class="space-y-4" @submit.prevent="onSubmit">
            <div>
              <label for="name" class="label">Vereinsname</label>
              <input
                id="name"
                v-model="name"
                type="text"
                class="input mt-1"
                placeholder="z.B. Kindergarten Sonnenschein"
                required
                minlength="2"
              />
            </div>

            <div>
              <label for="slug" class="label">URL-Kürzel</label>
              <div class="mt-1 flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-primary-600">
                <span class="flex select-none items-center pl-3 text-gray-500 sm:text-sm">brumm.app/ini/</span>
                <input
                  id="slug"
                  :value="slug"
                  type="text"
                  class="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                  placeholder="mein-verein"
                  required
                  minlength="2"
                  @input="onSlugInput"
                />
              </div>
            </div>

            <hr class="border-gray-200" />

            <p class="text-sm font-medium text-gray-700">Ihr Verwaltungs-Account</p>

            <div>
              <label for="email" class="label">E-Mail-Adresse</label>
              <input id="email" v-model="email" type="email" class="input mt-1" autocomplete="email" required />
            </div>

            <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {{ error }}
            </div>

            <button type="submit" class="btn-primary w-full" :disabled="isLoading">
              {{ isLoading ? "Wird registriert…" : "Verein registrieren" }}
            </button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
