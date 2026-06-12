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

const deviceStatus = await authStore.checkDevice(slug)
const deviceSessions = ref(deviceStatus.sessions)

// Which session the user selected (auto-selected if only one)
const selectedSession = ref(deviceSessions.value.length === 1 ? deviceSessions.value[0] : null)
const showPinLogin = ref(deviceSessions.value.length > 0)

// Email-Login State
const email = ref('')
const isLoading = ref(false)
const isSent = ref(false)
const error = ref<string | null>(null)
const rememberMe = ref(false)
const pin = ref('')

// OTP State
const otpCode = ref('')
const otpLoading = ref(false)
const otpError = ref<string | null>(null)

async function onVerifyOtp() {
  otpLoading.value = true
  otpError.value = null
  try {
    await authStore.verifyOtp(slug, otpCode.value)
    const target = authStore.currentClub?.isSetupDone
      ? `/ini/${slug}/dashboard`
      : `/ini/${slug}/settings/onboarding`
    await navigateTo(target, { replace: true })
  } catch (err: unknown) {
    otpError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Code ungültig oder abgelaufen'
    otpCode.value = ''
  } finally {
    otpLoading.value = false
  }
}

// PIN-Login State
const pinLoading = ref(false)
const pinError = ref<string | null>(null)
const pinInput = ref<{ focus: () => void } | null>(null)
const pinForgotSent = ref(false)
const pinForgotLoading = ref(false)

const isDeviceLocked = computed(() => !!selectedSession.value?.isLocked)

onMounted(() => {
  if (showPinLogin.value && selectedSession.value && !isDeviceLocked.value) {
    nextTick(() => pinInput.value?.focus())
  }
})

function onSelectSession(session: (typeof deviceSessions.value)[number]) {
  selectedSession.value = session
  nextTick(() => pinInput.value?.focus())
}

async function onSubmit() {
  if (!email.value) return
  if (rememberMe.value && pin.value.length !== 4) {
    error.value = 'Bitte gib eine 4-stellige PIN ein.'
    return
  }
  isLoading.value = true
  error.value = null
  try {
    await authStore.login(slug, email.value, rememberMe.value ? pin.value : undefined)
    isSent.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Fehler beim Senden'
  } finally {
    isLoading.value = false
  }
}

async function onPinSubmit() {
  if (pin.value.length !== 4 || !selectedSession.value) return
  pinLoading.value = true
  pinError.value = null
  try {
    await authStore.loginWithPin(slug, pin.value, selectedSession.value.userId)
    await navigateTo(`/ini/${slug}/dashboard`, { replace: true })
  } catch (err: unknown) {
    pinError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Fehler bei der Anmeldung'
    const statusCode = (err as { data?: { statusCode?: number } })?.data?.statusCode
    if (statusCode === 403) {
      if (selectedSession.value)
        selectedSession.value = { ...selectedSession.value, isLocked: true }
    }
    pin.value = ''
    nextTick(() => pinInput.value?.focus())
  } finally {
    pinLoading.value = false
  }
}

async function onPinForgot() {
  pinForgotLoading.value = true
  try {
    await $fetch(`/api/ini/${slug}/auth/pin-forgot`, {
      method: 'POST',
      body: selectedSession.value ? { userId: selectedSession.value.userId } : {},
    })
    pinForgotSent.value = true
  } finally {
    pinForgotLoading.value = false
  }
}

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Elternteil',
  MANAGER: 'Vorstand',
  TEAM: 'Team',
  SUPERUSER: 'Admin',
}
</script>

<template>
  <main id="main-content" class="flex flex-grow flex-col items-center bg-gray-50 px-4 py-8 mobile:py-12 tablet:py-16">
    <div class="w-full max-w-md">
      <h1 class="sr-only">Anmelden</h1>

      <!-- PIN-Login -->
      <template v-if="showPinLogin">
        <div class="rounded-lg px-6 tablet:bg-white tablet:py-6 tablet:shadow-sm tablet:ring-1 tablet:ring-gray-900/5" aria-live="polite" aria-atomic="true">

          <!-- Account-Selector (mehrere Sessions) -->
          <template v-if="!selectedSession">
            <h2 class="mb-1 text-xl font-semibold text-gray-900">Willkommen zurück</h2>
            <p class="mb-5 text-sm text-gray-600">Mit welchem Account möchtest du dich anmelden?</p>
            <div class="space-y-2">
              <button
                v-for="session in deviceSessions"
                :key="session.userId"
                class="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                @click="onSelectSession(session)"
              >
                <span class="font-medium text-gray-900">{{ session.displayName || ROLE_LABELS[session.role] || session.role }}</span>
                <span class="ml-3 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{{ ROLE_LABELS[session.role] || session.role }}</span>
              </button>
            </div>
            <div class="mt-6 text-center text-xs text-gray-400">
              <button class="hover:text-gray-600" @click="showPinLogin = false; pin = ''">
                Per E-Mail anmelden
              </button>
            </div>
          </template>

          <!-- PIN-Eingabe -->
          <template v-else>
            <h2 class="mb-1 hidden text-xl font-semibold text-gray-900 tablet:block">Willkommen zurück</h2>
            <p v-if="deviceSessions.length > 1" class="mb-1 text-sm text-gray-500">
              {{ selectedSession.displayName || ROLE_LABELS[selectedSession.role] }}
              <button class="ml-1 text-gray-400 underline hover:text-gray-600" @click="selectedSession = null; pin = ''">
                wechseln
              </button>
            </p>
            <p class="mb-6 hidden text-sm text-gray-600 tablet:block">Gib deinen PIN ein.</p>

            <template v-if="isDeviceLocked">
              <div role="alert" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                Zu viele Fehlversuche. Bitte melde dich per E-Mail an.
              </div>
              <button class="btn-primary w-full" @click="showPinLogin = false; selectedSession = null">
                Per E-Mail anmelden
              </button>
            </template>

            <template v-else>
              <div class="space-y-4">
                <PinInput ref="pinInput" v-model="pin" :disabled="pinLoading" showSubmit @complete="onPinSubmit" />
                <div v-if="pinError" role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {{ pinError }}
                </div>
                <div v-if="pinLoading" class="text-center text-sm text-gray-400">Wird geprüft…</div>
              </div>
            </template>

            <div class="mt-8 space-y-2 text-center text-xs text-gray-400">
              <template v-if="pinForgotSent">
                <p class="text-gray-500">Link gesendet! Prüfe deine E-Mails.</p>
              </template>
              <template v-else>
                <div class="flex justify-center gap-4">
                  <button class="hover:text-gray-600" @click="showPinLogin = false; selectedSession = null; pin = ''">
                    Per E-Mail anmelden
                  </button>
                  <span>·</span>
                  <button class="hover:text-gray-600" :disabled="pinForgotLoading" @click="onPinForgot">
                    {{ pinForgotLoading ? 'Wird gesendet…' : 'PIN löschen' }}
                  </button>
                </div>
              </template>
            </div>
          </template>

        </div>
      </template>

      <!-- E-Mail-Login -->
      <template v-else>
        <div class="card" aria-live="polite" aria-atomic="true">
          <template v-if="!isSent">
            <h2 class="mb-1 text-xl font-semibold text-gray-900">Link anfordern</h2>
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

              <div class="space-y-3">
                <label class="flex cursor-pointer items-center gap-2.5">
                  <input
                    v-model="rememberMe"
                    type="checkbox"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span class="text-sm text-gray-700">Angemeldet bleiben</span>
                </label>

                <template v-if="rememberMe">
                  <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p class="text-sm font-medium text-gray-700">PIN festlegen (4 Ziffern)</p>
                    <PinInput v-model="pin" />
                    <p class="text-xs text-gray-400">
                      Eine Gerätekennung wird auf diesem Gerät gespeichert (90 Tage).
                      Mehr Infos in der
                      <NuxtLink to="/privacy" class="underline hover:text-gray-600">Datenschutzerklärung</NuxtLink>.
                    </p>
                  </div>
                </template>
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
            <div class="space-y-4">
              <div>
                <p class="text-lg font-medium text-gray-900">Link gesendet!</p>
                <p class="mt-1 text-sm text-gray-600">
                  Falls diese E-Mail in unserem System vorhanden ist, hast du einen Anmelde-Link
                  erhalten. Der Link ist 15 Minuten gültig.
                </p>
              </div>

              <form class="space-y-3" @submit.prevent="onVerifyOtp">
                <div>
                  <label class="label mb-2 block">Code aus der E-Mail</label>
                  <OtpInput v-model="otpCode" :disabled="otpLoading" @complete="onVerifyOtp" />
                </div>
                <div v-if="otpError" role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {{ otpError }}
                </div>
                <button
                  type="submit"
                  class="btn-primary w-full"
                  :disabled="otpCode.length !== 6 || otpLoading"
                >
                  {{ otpLoading ? 'Wird geprüft…' : 'Anmelden' }}
                </button>
              </form>

              <div class="text-center">
                <button class="btn-secondary text-sm" @click="isSent = false; email = ''; pin = ''; rememberMe = false; otpCode = ''; otpError = null">
                  Andere E-Mail verwenden
                </button>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </main>
</template>
