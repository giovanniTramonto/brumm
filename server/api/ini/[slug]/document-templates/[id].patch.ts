import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const templateId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const body = await readBody<{ name?: string; documentType?: string }>(event)

  const template = await prisma.documentTemplate.findFirst({ where: { id: templateId, clubId: club.id } })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  const data: { name?: string; documentType?: string } = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) throw createError({ statusCode: 400, statusMessage: 'Name fehlt' })
    data.name = body.name.trim()
  }
  if (body.documentType !== undefined) {
    if (body.documentType !== 'read' && body.documentType !== 'upload') {
      throw createError({ statusCode: 400, statusMessage: 'Ungültiger Typ' })
    }
    data.documentType = body.documentType
  }

  const updated = await prisma.documentTemplate.update({
    where: { id: templateId },
    data,
  })

  return { template: updated }
})
