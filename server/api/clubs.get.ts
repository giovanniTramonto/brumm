import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const clubs = await prisma.club.findMany({
    where: { clubDatabase: { encryptedDsn: { not: null } } },
    select: { name: true, slug: true },
    orderBy: { name: 'asc' },
  })
  return { clubs }
})
