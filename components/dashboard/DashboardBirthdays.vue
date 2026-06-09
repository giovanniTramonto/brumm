<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

const props = defineProps<{ slug: string }>()

const membersStore = useMembersStore()
await membersStore.fetchMembers(props.slug)

function getNextBirthday(birthDate: string): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const birth = new Date(birthDate)
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next
}

function getNewAge(birthDate: string, nextBirthday: Date): number {
  return nextBirthday.getFullYear() - new Date(birthDate).getFullYear()
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '').toUpperCase()
  return `${day}. ${month}`
}

const upcoming = computed(() => {
  const active = membersStore.members.filter(
    (m) => m.status === 'ACTIVE' || m.status === 'INACTIVE',
  )
  return active
    .map((m) => {
      const nextBirthday = getNextBirthday(m.birthDate)
      return { member: m, nextBirthday, newAge: getNewAge(m.birthDate, nextBirthday) }
    })
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
})

type CardGroup = {
  label: string
  cards: { newAge: number; groupName: string | null; members: typeof upcoming.value }[]
}

function groupByDate(entries: typeof upcoming.value): CardGroup[] {
  const dateGroups: CardGroup[] = []
  for (const entry of entries) {
    const label = formatDate(entry.nextBirthday)
    let dateGroup = dateGroups.find((g) => g.label === label)
    if (!dateGroup) {
      dateGroup = { label, cards: [] }
      dateGroups.push(dateGroup)
    }
    const cardKey = `${entry.newAge}|${entry.member.group?.name ?? ''}`
    let card = dateGroup.cards.find((c) => `${c.newAge}|${c.groupName ?? ''}` === cardKey)
    if (!card) {
      card = { newAge: entry.newAge, groupName: entry.member.group?.name ?? null, members: [] }
      dateGroup.cards.push(card)
    }
    card.members.push(entry)
  }
  return dateGroups
}

const highlighted = computed(() => groupByDate(upcoming.value).slice(0, 1))

const rest = computed(() => {
  const skip = highlighted.value.reduce(
    (sum, g) => sum + g.cards.reduce((s, c) => s + c.members.length, 0),
    0,
  )
  return groupByDate(upcoming.value.slice(skip)).slice(0, 3)
})
</script>

<template>
  <div class="card h-full">
    <h2 class="mb-4 text-lg font-semibold text-gray-900">Geburtstage</h2>

    <p v-if="highlighted.length === 0" class="text-sm text-gray-500">
      Keine aktiven Kinder vorhanden.
    </p>

    <template v-else-if="highlighted.length > 0">
      <div v-for="group in highlighted" :key="group.label" class="flex items-start gap-3 mt-3 first:mt-0">
        <span class="w-20 shrink-0 font-mono pt-4 text-sm text-gray-400">{{ group.label }}</span>
        <div class="flex flex-wrap items-start gap-2 desktop:flex-1 desktop:flex-col desktop:items-stretch">
          <div
            v-for="card in group.cards"
            :key="`${card.newAge}-${card.groupName}`"
            class="birthday-card inline-block rounded-lg p-4 desktop:block"
          >
            <p class="flex items-baseline gap-1.5">
              <span class="font-mono text-2xl font-bold text-yellow-600">{{ card.newAge }}</span>
              <span class="text-sm font-semibold text-yellow-500">Jahre</span>
            </p>
            <div class="mt-1 space-y-0.5">
              <NuxtLink
                v-for="entry in card.members"
                :key="entry.member.id"
                :to="`/ini/${slug}/members/${entry.member.id}`"
                class="block text-base font-semibold text-gray-900 hover:underline"
              >
                {{ entry.member.firstName }} {{ entry.member.lastName }}&nbsp;→
              </NuxtLink>
            </div>
            <p v-if="card.groupName" class="mt-0.5 text-sm text-gray-500">
              {{ card.groupName }}
            </p>
          </div>
        </div>
      </div>

      <ul v-if="rest.length > 0" class="mt-3 divide-y divide-gray-100">
        <li v-for="group in rest" :key="group.label" class="flex items-center gap-3 py-2 text-sm">
          <span class="w-20 shrink-0 font-mono text-gray-400">{{ group.label }}</span>
          <span class="flex flex-wrap gap-x-3">
            <template v-for="card in group.cards" :key="`${card.newAge}-${card.groupName}`">
              <NuxtLink
                v-for="entry in card.members"
                :key="entry.member.id"
                :to="`/ini/${slug}/members/${entry.member.id}`"
                class="font-medium text-primary-700 hover:text-primary-900"
              >{{ entry.member.firstName }} {{ entry.member.lastName }}&nbsp;→</NuxtLink>
            </template>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.birthday-card {
  background-color: #fff2bc;
}

</style>
