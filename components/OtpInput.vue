<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: []
}>()

const LENGTH = 6
const inputRefs = ref<HTMLInputElement[]>([])

function digitAt(i: number) {
  return props.modelValue[i] ?? ''
}

function update(arr: string[]) {
  const value = arr.join('')
  emit('update:modelValue', value)
  if (value.length === LENGTH) emit('complete')
}

function onInput(index: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  const arr = Array.from({ length: LENGTH }, (_, i) => props.modelValue[i] ?? '')

  if (raw.length > 1) {
    for (let i = 0; i < raw.length && index + i < LENGTH; i++) {
      arr[index + i] = raw[i]
    }
    update(arr)
    nextTick(() => inputRefs.value[Math.min(index + raw.length, LENGTH - 1)]?.focus())
  } else {
    arr[index] = raw
    update(arr)
    if (raw && index < LENGTH - 1) {
      nextTick(() => inputRefs.value[index + 1]?.focus())
    }
  }
}

function onKeydown(index: number, e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    const arr = Array.from({ length: LENGTH }, (_, i) => props.modelValue[i] ?? '')
    if (arr[index]) {
      arr[index] = ''
      update(arr)
    } else if (index > 0) {
      arr[index - 1] = ''
      update(arr)
      nextTick(() => inputRefs.value[index - 1]?.focus())
    }
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' && index > 0) {
    inputRefs.value[index - 1]?.focus()
  } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
    inputRefs.value[index + 1]?.focus()
  }
}

function onFocus(e: FocusEvent) {
  ;(e.target as HTMLInputElement).select()
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, LENGTH)
  const arr = Array.from({ length: LENGTH }, (_, i) => text[i] ?? '')
  update(arr)
  nextTick(() => inputRefs.value[Math.min(text.length, LENGTH - 1)]?.focus())
}

function focus() {
  inputRefs.value[0]?.focus()
}
defineExpose({ focus })
</script>

<template>
  <div class="flex gap-2 justify-center" @paste="onPaste">
    <input
      v-for="i in LENGTH"
      :key="i"
      :ref="(el) => { if (el) inputRefs[i - 1] = el as HTMLInputElement }"
      :value="digitAt(i - 1)"
      :disabled="disabled"
      :autocomplete="i === 1 ? 'one-time-code' : 'off'"
      type="text"
      inputmode="numeric"
      maxlength="2"
      class="h-12 w-10 rounded-lg border border-gray-300 bg-white text-center text-xl font-semibold text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:opacity-50"
      @input="onInput(i - 1, $event)"
      @keydown="onKeydown(i - 1, $event)"
      @focus="onFocus"
    />
  </div>
</template>
