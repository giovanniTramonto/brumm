import { prisma } from '~/server/utils/prisma'
import { decodeS3FileId, s3DeleteFile } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')

  if (!memberId || !fileId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const member = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  await s3DeleteFile(club.id, decodeS3FileId(fileId))

  return { ok: true }
})
