import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const memberIds = await prisma.user
    .findMany({ where: { clubId: club.id, role: 'MEMBER' }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id))

  const [templates, memberDocs, wallDocs] = await Promise.all([
    prisma.documentTemplate.updateMany({
      where: { clubId: club.id },
      data: { s3Key: null },
    }),
    prisma.memberDocument.updateMany({
      where: { memberId: { in: memberIds } },
      data: { s3Key: null },
    }),
    prisma.document.updateMany({
      where: { clubId: club.id, type: 'document' },
      data: { s3Key: null },
    }),
  ])

  return {
    ok: true,
    cleared: {
      templates: templates.count,
      memberDocs: memberDocs.count,
      wallDocs: wallDocs.count,
    },
  }
})
