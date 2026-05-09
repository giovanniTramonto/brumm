export default defineEventHandler(async (event) => {
  const { secret } = await readBody(event)

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    throw createError({ statusCode: 401, statusMessage: 'Falsches Passwort' })
  }

  setCookie(event, 'admin_session', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })

  return { ok: true }
})
