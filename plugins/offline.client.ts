export default defineNuxtPlugin(() => {
  const router = useRouter()

  const goOffline = () => {
    if (router.currentRoute.value.path !== '/offline') {
      router.replace('/offline')
    }
  }

  const goOnline = () => {
    if (router.currentRoute.value.path === '/offline') {
      router.replace('/')
    }
  }

  window.addEventListener('offline', goOffline)
  window.addEventListener('online', goOnline)

  if (!navigator.onLine) goOffline()
})
