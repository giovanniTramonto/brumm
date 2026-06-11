<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string
const authStore = useAuthStore()

const { isMember, canManageClub } = storeToRefs(authStore)
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">
        Willkommen{{ authStore.currentUser?.firstName ? `, ${authStore.currentUser.firstName}` : '' }}!
      </h1>
    </div>

    <Suspense>
      <template #default>
        <div class="space-y-6">
          <DashboardMyKids v-if="isMember" :slug="slug" />
          
          <DashboardOverview v-if="canManageClub" :slug="slug" />

          <template v-if="authStore.currentUser?.role === 'TEAM'">
            <div class="grid gap-4 desktop:grid-cols-3">
              <div class="desktop:col-span-2 desktop:h-full">
                <DashboardGroups :slug="slug" class="h-full" />
              </div>
              <DashboardBirthdays :slug="slug" class="h-full" />
            </div>
          </template>

          <DashboardWall :slug="slug" />
          <DashboardContacts :slug="slug" />
        </div>
      </template>
      <template #fallback>
        <LoadingBrumm />
      </template>
    </Suspense>
  </div>
</template>
