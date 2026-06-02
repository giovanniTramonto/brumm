import { prisma } from '~/server/utils/prisma'
import { deleteDriveFile } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')

  if (!memberId || !fileId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
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

  const tokens = club.oauthToken as OAuthTokens

  await deleteDriveFile({ tokens, fileId })

  return { ok: true }
})
