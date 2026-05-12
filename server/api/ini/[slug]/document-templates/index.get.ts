import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const templates = await prisma.documentTemplate.findMany({
    where: { clubId: club.id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      ref: true,
      documentType: true,
      driveFileId: true,
      driveFileName: true,
      createdAt: true,
    },
  })

  return { templates }
})
