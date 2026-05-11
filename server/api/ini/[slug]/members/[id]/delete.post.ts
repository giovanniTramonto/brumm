import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { deleteMemberFolder, findMemberFolderId } from '~/server/utils/storage/googleDrive'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  if (club.isSetupDone) {
    const tokens = club.oauthToken as OAuthTokens
    const storageConfig = club.storageConfig as GoogleDriveConfig
    const memberData = await getMemberData(memberId, club)
    if (memberData?.storageRef) {
      const folderId = await findMemberFolderId({
        tokens,
        membersFolderId: storageConfig.membersFolderId,
        storageRef: memberData.storageRef,
      })
      if (folderId) {
        await deleteMemberFolder({ tokens, folderId })
      }
    }
  }

  await prisma.session.deleteMany({ where: { userId: memberId } })
  await prisma.invite.deleteMany({ where: { userId: memberId } })
  await prisma.magicLink.deleteMany({ where: { userId: memberId } })
  await prisma.memberDocument.deleteMany({ where: { memberId } })
  await prisma.userEmail.deleteMany({ where: { userId: memberId } })
  await prisma.user.delete({ where: { id: memberId } })

  return { ok: true }
})
