import { setupClubStorage } from '~/server/utils/storage/setupClubStorage'
import { prisma } from '~/server/utils/prisma'
import { storageSetupSchema, formatZodError } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (club.isSetupDone) {
    throw createError({ statusCode: 409, statusMessage: 'Storage bereits eingerichtet' })
  }

  const parsed = storageSetupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  if (parsed.data.managed === true) {
    await prisma.club.update({
      where: { id: club.id },
      data: { isSetupRequested: true },
    })
    return { managed: true }
  }

  const { serviceAccountEmail, serviceAccountKey } = parsed.data

  const storageConfig = await setupClubStorage({
    clubId: club.id,
    clubName: club.name,
    credentials: { serviceAccountEmail, serviceAccountKey },
  })

  return { storageConfig: { ...storageConfig, serviceAccountKey: '[versteckt]' } }
})
