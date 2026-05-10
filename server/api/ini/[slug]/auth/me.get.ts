export default defineEventHandler((event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet' })
  }

  return { user, club }
})
