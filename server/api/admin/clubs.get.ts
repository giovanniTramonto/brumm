import { checkAdminAuth } from '~/server/utils/adminAuth'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)

  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: 'SUPERUSER' },
        select: {
          magicLinks: { where: { isUsed: true }, select: { id: true }, take: 1 },
        },
      },
    },
  })

  return {
    clubs: clubs.map((c) => ({
      ...c,
      superuserHasLoggedIn: c.users.some((u) => u.magicLinks.length > 0),
      users: undefined,
    })),
  }
})
