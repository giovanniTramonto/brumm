import { getAllManagerData } from '~/server/utils/managerData'
import { prisma } from '~/server/utils/prisma'
import type { Manager } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (!currentUser) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht eingeloggt' })
  }

  const managers = await prisma.manager.findMany({ where: { clubId: club.id } })
  const dataList = await getAllManagerData(club)
  const dataMap = new Map(dataList.map((d) => [d.managerId, d]))

  const result: Manager[] = managers
    .map((m) => {
      const data = dataMap.get(m.id)
      if (!data) return null
      return {
        id: m.id,
        clubId: m.clubId,
        storageId: m.storageId,
        isMemberManager: m.isMemberManager,
        name: data.name,
        email: data.email,
        createdAt: m.createdAt.toISOString(),
      } satisfies Manager
    })
    .filter((m): m is Manager => m !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return { managers: result }
})
