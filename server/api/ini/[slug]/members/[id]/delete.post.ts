import { sendMemberRemovedEmail } from '~/server/utils/email'
import { deleteMemberData, getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { s3DeleteByPrefix } from '~/server/utils/storage/s3/files'

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

  try {
    await s3DeleteByPrefix(club.id, `members/${memberId}`)
  } catch {
    // non-fatal: S3 cleanup failure should not block DB deletion
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
  await prisma.user.delete({ where: { id: memberId } })

  return { ok: true }
})
