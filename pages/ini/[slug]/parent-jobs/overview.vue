<script setup lang="ts">
import type { ParentJob, ParentJobMember } from '~/types'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const slug = route.params.slug as string

const { data, status } = await useFetch<{ parentJobs: ParentJob[] }>(
  `/api/ini/${slug}/parent-jobs/overview`,
)

const jobs = computed(() => data.value?.parentJobs ?? [])

type Row = { job: ParentJob; member: ParentJobMember; isFirst: boolean; isLast: boolean }

const rows = computed<Row[]>(() =>
  jobs.value.flatMap((job) => {
    const members = job.members ?? []
    if (!members.length) return []
    return members.map((member, i) => ({
      job,
      member,
      isFirst: i === 0,
      isLast: i === members.length - 1,
    }))
  }),
)
</script>

<template>
  <div>
    <div class="mb-6">
      <NuxtLink :to="`/ini/${slug}/dashboard`" class="text-sm text-gray-500 hover:text-gray-900">← Zurück</NuxtLink>
    </div>

    <div class="card">
      <h1 class="mb-4 text-2xl font-bold text-gray-900">Elternposten</h1>

      <LoadingBrumm v-if="status === 'pending'" />

      <p v-else-if="jobs.length === 0" class="text-sm text-gray-500">Noch keine Elternposten vorhanden.</p>

      <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Posten</th>
            <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">Mitglied</th>
            <th class="pb-2 pr-6 text-left text-xs font-medium text-gray-500">E-Mail</th>
            <th class="pb-2 text-left text-xs font-medium text-gray-500">Telefon</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.member.id">
            <tr :class="row.isFirst && 'border-t border-gray-100'" class="leading-none">
              <td
                v-if="row.isFirst"
                :rowspan="row.job.members?.length"
                class="pr-6 align-top font-medium text-gray-900"
                :class="{ 'pt-3': row.isFirst, 'pb-3': row.isLast }"
              >
                {{ row.job.name }}
              </td>
              <td
                class="pr-6 text-gray-900"
                :class="{ 'pt-3': row.isFirst, 'pb-3': row.isLast, 'py-1': !row.isFirst && !row.isLast }"
              >
                {{ row.member.name ?? row.member.email }}
                <span v-if="row.member.isLeader" class="ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">Leitung</span>
              </td>
              <td
                class="pr-6"
                :class="{ 'pt-3': row.isFirst, 'pb-3': row.isLast, 'py-1': !row.isFirst && !row.isLast }"
              >
                <a :href="`mailto:${row.member.email}`" class="text-sm text-blue-600 hover:text-blue-800">{{ row.member.email }}</a>
              </td>
              <td :class="{ 'pt-3': row.isFirst, 'pb-3': row.isLast, 'py-1': !row.isFirst && !row.isLast }">
                <a v-if="row.member.phone" :href="`tel:${row.member.phone}`" class="font-mono text-sm text-blue-600 hover:underline">{{ row.member.phone }}</a>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>
