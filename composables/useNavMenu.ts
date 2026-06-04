export function useNavMenu(breakpoint = 640) {
  const route = useRoute()
  const isMenuOpen = ref(false)

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') isMenuOpen.value = false
  }

  function onBreakpoint(e: MediaQueryListEvent) {
    if (e.matches) isMenuOpen.value = false
  }

  let mql: MediaQueryList | null = null

  onMounted(() => {
    mql = window.matchMedia(`(min-width: ${breakpoint}px)`)
    mql.addEventListener('change', onBreakpoint)
    document.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', onBreakpoint)
    document.removeEventListener('keydown', onKeydown)
  })

  watch(
    () => route.path,
    () => {
      isMenuOpen.value = false
    },
  )

  return { isMenuOpen }
}
