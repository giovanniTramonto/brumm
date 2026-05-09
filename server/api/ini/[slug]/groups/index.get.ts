import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const groups = await prisma.group.findMany({
    where: { clubId: club.id },
    orderBy: { name: 'asc' },
  })

  return { groups }
})
