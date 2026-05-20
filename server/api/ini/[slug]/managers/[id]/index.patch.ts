import { updateManagerData } from '~/server/utils/managerData'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, updateManagerSchema } from '~/server/utils/schemas'

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

  const parsed = updateManagerSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const manager = await prisma.manager.findFirst({ where: { id: managerId, clubId: club.id } })
  if (!manager) {
    throw createError({ statusCode: 404, statusMessage: 'Vorstandsmitglied nicht gefunden' })
  }

  const { name, email, isMemberManager } = parsed.data

  const managerUser = await prisma.user.findFirst({
    where: { storageId: manager.storageId, clubId: club.id, role: 'MANAGER' },
    include: { emails: true },
  })

  const [updated] = await Promise.all([
    isMemberManager !== undefined
      ? prisma.manager.update({ where: { id: managerId }, data: { isMemberManager } })
      : Promise.resolve(manager),
    name !== undefined || email !== undefined
      ? updateManagerData(managerId, { ...(name && { name }), ...(email && { email }) }, club)
      : Promise.resolve(),
  ])

  if (managerUser && isMemberManager !== undefined) {
    await prisma.user.update({ where: { id: managerUser.id }, data: { isMemberManager } })
  }

  return { manager: { id: managerId, isMemberManager: updated.isMemberManager } }
})
