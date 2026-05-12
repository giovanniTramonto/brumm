import { getManagerData } from '~/server/utils/managerData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const managerId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!managerId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const manager = await prisma.manager.findFirst({ where: { id: managerId, clubId: club.id } })
  if (!manager) {
    throw createError({ statusCode: 404, statusMessage: 'Vorstandsmitglied nicht gefunden' })
  }

  const data = await getManagerData(managerId, club)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Daten nicht gefunden' })
  }

  return {
    manager: {
      id: manager.id,
      clubId: manager.clubId,
      storageId: manager.storageId,
      isMemberManager: manager.isMemberManager,
      name: data.name,
      email: data.email,
      createdAt: manager.createdAt.toISOString(),
    },
  }
})
