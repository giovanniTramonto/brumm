import { checkAdminAuth } from '~/server/utils/adminAuth'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, storageSetupSchema } from '~/server/utils/schemas'
import { setupClubStorage } from '~/server/utils/storage/setupClubStorage'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)

  const clubId = getRouterParam(event, 'id')
  if (!clubId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const club = await prisma.club.findUnique({ where: { id: clubId } })
  if (!club) throw createError({ statusCode: 404, statusMessage: 'Verein nicht gefunden' })

  const parsed = storageSetupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { serviceAccountEmail, serviceAccountKey } = parsed.data

  const storageConfig = await setupClubStorage({
    clubId: club.id,
    clubName: club.name,
    credentials: { serviceAccountEmail, serviceAccountKey },
  })

  return { storageConfig: { ...storageConfig, serviceAccountKey: '[versteckt]' } }
})
