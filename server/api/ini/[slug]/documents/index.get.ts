import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const documents = await prisma.document.findMany({
    where: { clubId: club.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, order: true, createdAt: true },
  })

  return { documents }
})
