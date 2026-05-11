import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const { ids } = await readBody<{ ids: string[] }>(event)
  if (!Array.isArray(ids)) {
    throw createError({ statusCode: 400, statusMessage: 'ids fehlt' })
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.documentTemplate.updateMany({
        where: { id, clubId: club.id },
        data: { order: index },
      }),
    ),
  )

  return { ok: true }
})
