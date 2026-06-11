<script setup lang="ts">
const EMOJIS = ['🚗', '🚙', '🏎️', '🐻']

function randomEmoji(current: string) {
  const others = EMOJIS.filter((e) => e !== current)
  return others[Math.floor(Math.random() * others.length)]
}

const emoji = ref(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])

let interval: ReturnType<typeof setInterval>
onMounted(() => {
  interval = setInterval(() => {
    emoji.value = randomEmoji(emoji.value)
  }, 2000)
})
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <span class="bounce select-none" aria-hidden="true">{{ emoji }}</span>
</template>

<style scoped>
.bounce {
  display: inline-block;
  transform-origin: bottom center;
  animation: bounce 0.75s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .bounce { animation: none; }
}

@keyframes bounce {
  0%   { transform: translateY(0)      scaleX(1.25) scaleY(0.75); animation-timing-function: ease-out; }
  12%  { transform: translateY(0)      scaleX(0.85) scaleY(1.2);  animation-timing-function: cubic-bezier(0.17, 0.67, 0.48, 1); }
  40%  { transform: translateY(-22px)  scaleX(1)    scaleY(1);    animation-timing-function: ease-in; }
  78%  { transform: translateY(-3px)   scaleX(0.9)  scaleY(1.1);  animation-timing-function: ease-in; }
  88%  { transform: translateY(0)      scaleX(1.3)  scaleY(0.7);  animation-timing-function: ease-out; }
  100% { transform: translateY(0)      scaleX(1.25) scaleY(0.75); }
}
</style>
