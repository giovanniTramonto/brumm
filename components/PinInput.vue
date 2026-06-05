<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: []
}>()

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

function onDigit(key: string) {
  if (props.disabled) return
  if (key === '⌫') {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  } else if (props.modelValue.length < 4) {
    const next = props.modelValue + key
    emit('update:modelValue', next)
    if (next.length === 4) emit('complete')
  }
}

function focus() {}
defineExpose({ focus })
</script>

<template>
  <div class="select-none space-y-4">
    <!-- 4 Dots -->
    <div class="flex justify-center gap-4 py-4">
      <div
        v-for="i in 4"
        :key="i"
        class="h-4 w-4 rounded-full border-2 transition-all duration-150"
        :class="
          i <= modelValue.length
            ? 'border-primary-500 bg-primary-500 scale-110'
            : 'border-gray-300 bg-transparent'
        "
      />
    </div>

    <!-- Numpad -->
    <div class="space-y-4 px-6">
      <div v-for="(row, ri) in ROWS" :key="ri" class="flex gap-6">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          :disabled="disabled || (!key && key !== '0')"
          class="flex aspect-square flex-1 items-center justify-center rounded-full text-3xl font-medium transition-all duration-100 active:scale-95"
          :class="
            !key
              ? 'pointer-events-none opacity-0'
              : key === '⌫'
                ? 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'
                : 'bg-white shadow-sm hover:bg-gray-50 active:bg-gray-200 border border-gray-200 text-gray-900'
          "
          @click="onDigit(key)"
        >
          {{ key }}
        </button>
      </div>
    </div>
  </div>
</template>
