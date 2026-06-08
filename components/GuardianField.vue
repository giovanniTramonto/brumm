<script setup lang="ts">
import { useMembersStore } from '~/stores/members'

type GuardianFieldModel = {
  name: string
  email: string
  phone: string
}

const props = defineProps<{
  label: string
  fieldId: string
  required?: boolean
  readonly?: boolean
  memberId?: string | null
  otherEmail?: string
  originalEmail?: string
  isNoInviteWorkflow?: boolean
}>()

const model = defineModel<GuardianFieldModel>({ required: true })

const local = reactive({ ...model.value })

watch(
  () => model.value,
  (v) => Object.assign(local, v),
  { deep: true },
)

watch(local, () => {
  model.value = { ...local }
})

const membersStore = useMembersStore()

function findSiblings(email: string) {
  if (!email) return []
  return membersStore.members.filter(
    (m) =>
      m.id !== props.memberId &&
      m.status !== 'DEACTIVATED' &&
      (m.email1.toLowerCase() === email || (m.email2 && m.email2.toLowerCase() === email)),
  )
}

const hint = computed(() => {
  const current = local.email.trim().toLowerCase()
  const isCreate = props.originalEmail === undefined
  const original = (props.originalEmail ?? '').trim().toLowerCase()
  const isChanged = isCreate || (!!original && current !== original)
  const emailToCheck = !isCreate && isChanged ? original : current
  const siblings = findSiblings(emailToCheck)
  if (!siblings.length) return null
  return {
    names: joinWithAnd(siblings.map((s) => `${s.firstName} ${s.lastName}`)),
    isChanged,
  }
})

const isDuplicateEmail = computed(() => {
  const e = local.email.trim().toLowerCase()
  const other = (props.otherEmail ?? '').trim().toLowerCase()
  return !!e && !!other && e === other
})

const emailInput = ref<HTMLInputElement | null>(null)

watch(isDuplicateEmail, (isDuplicate) => {
  emailInput.value?.setCustomValidity(isDuplicate ? 'Diese E-Mail-Adressen sind identisch.' : '')
})
</script>

<template>
  <div>
    <label :for="`${fieldId}-name`" class="label">
      {{ label }}<template v-if="required"> *</template>
    </label>
    <input
      :id="`${fieldId}-name`"
      v-model="local.name"
      type="text"
      class="input mt-1"
      :readonly="readonly"
      :required="required"
    />
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div>
      <label :for="`${fieldId}-email`" class="label">
        E-Mail<template v-if="required"> *</template>
      </label>
      <input
        :id="`${fieldId}-email`"
        ref="emailInput"
        v-model="local.email"
        type="email"
        class="input mt-1"
        :readonly="readonly"
        :required="required"
        :aria-invalid="isDuplicateEmail || undefined"
        :class="{ 'ring-1 ring-red-400': isDuplicateEmail }"
      />
    </div>
    <div>
      <label :for="`${fieldId}-phone`" class="label">Telefon</label>
      <input
        :id="`${fieldId}-phone`"
        v-model="local.phone"
        type="tel"
        class="input mt-1"
        :readonly="readonly"
      />
    </div>
  </div>

  <p v-if="isDuplicateEmail" class="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
    Diese E-Mail-Adressen sind identisch.
  </p>
  <p v-else-if="hint" class="rounded-md px-3 py-2 text-xs" :class="hint.isChanged ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'">
    <template v-if="hint.isChanged">Änderung wird auch automatisch für {{ hint.names }} übernommen.</template>
    <template v-else>Diese E-Mail gehört auch zu {{ hint.names }}.</template>
  </p>
  <p v-if="isNoInviteWorkflow" class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
    Es wird keine E-Mail-Einladung versendet.
  </p>
</template>
