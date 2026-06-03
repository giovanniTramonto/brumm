import { sendMemberRemovedEmail } from '~/server/utils/email'
import { deleteMemberData, getMemberData } from '~/server/utils/memberData'
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

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const memberData = await getMemberData(memberId, club)

  if (club.isSetupDone && memberData?.storageRef) {
    const tokens = club.oauthToken as OAuthTokens
    const storageConfig = club.storageConfig as GoogleDriveConfig
    const folderId = await findMemberFolderId({
      tokens,
      membersFolderId: storageConfig.membersFolderId,
      storageRef: memberData.storageRef,
    })
    if (folderId) {
      await deleteMemberFolder({ tokens, folderId })
    }
  }

  const anyInvite = await prisma.invite.findFirst({ where: { userId: memberId } })
  if (memberData && anyInvite) {
    const to = [memberData.email1, memberData.email2].filter(Boolean) as string[]
    const childName = `${memberData.firstName} ${memberData.lastName}`
    await Promise.allSettled(
      to.map((email) => sendMemberRemovedEmail({ to: [email], clubName: club.name, childName })),
    )
  }

  await deleteMemberData(memberId, club)

  await prisma.session.deleteMany({ where: { userId: memberId } })
  await prisma.invite.deleteMany({ where: { userId: memberId } })
  await prisma.magicLink.deleteMany({ where: { userId: memberId } })
  await prisma.memberDocument.deleteMany({ where: { memberId } })
  await prisma.userEmail.deleteMany({ where: { userId: memberId } })
  await prisma.user.delete({ where: { id: memberId } })

  return { ok: true }
})
