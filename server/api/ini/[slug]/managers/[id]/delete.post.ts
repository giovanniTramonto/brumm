import { deleteManagerData, getManagerData } from '~/server/utils/managerData'
import { prisma } from '~/server/utils/prisma'
import { sendManagerRemovedEmail } from '~/server/utils/email'

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

  await deleteManagerData(managerId, manager.storageId, club)
  await prisma.manager.delete({ where: { id: managerId } })

  if (data) {
    await sendManagerRemovedEmail({ to: data.email, name: data.name, clubName: club.name }).catch(() => {})
  }

  return { ok: true }
})
