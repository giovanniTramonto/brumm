import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import type { Member } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canViewAll =
    currentUser.role === 'SUPERUSER' ||
    currentUser.role === 'TEAM' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  const [user, anyInvite, currentUserEmails] = await Promise.all([
    prisma.user.findFirst({
      where: { id: memberId, clubId: club.id },
      select: {
        id: true,
        clubId: true,
        role: true,
        status: true,
        storageId: true,
        isMemberManager: true,
        createdAt: true,
        hasSubmittedDocuments: true,
        deactivatedAt: true,
      },
    }),
    prisma.invite.findFirst({ where: { userId: memberId } }),
    currentUser.role === 'SUPERUSER'
      ? prisma.userEmail.findMany({ where: { userId: currentUser.id }, select: { email: true } })
      : Promise.resolve([] as { email: string }[]),
  ])

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const md = await getMemberData(memberId, club)

  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  if (!canViewAll && currentUser.id !== memberId) {
    const ownMd = await getMemberData(currentUser.id, club)
    const ownEmails = [ownMd?.email1, ownMd?.email2]
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
    const isGuardian =
      ownEmails.includes(md.email1.toLowerCase()) ||
      (md.email2 && ownEmails.includes(md.email2.toLowerCase()))
    if (!isGuardian) {
      throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
    }
  }

  const superUserEmailSet = new Set(currentUserEmails.map((e) => e.email.toLowerCase()))
  const isOwnChild =
    superUserEmailSet.has(md.email1.toLowerCase()) ||
    (!!md.email2 && superUserEmailSet.has(md.email2.toLowerCase()))

  const member: Member = {
    id: user.id,
    clubId: user.clubId,
    role: user.role,
    status: user.status,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    storageId: user.storageId,
    isMemberManager: user.isMemberManager,
    createdAt: user.createdAt.toISOString(),
    firstName: md.firstName,
    lastName: md.lastName,
    birthDate: md.birthDate,
    guardian1Name: md.guardian1Name,
    guardian2Name: md.guardian2Name,
    email1: md.email1,
    email2: md.email2,
    phone1: md.phone1,
    phone2: md.phone2,
    groupId: md.groupId,
    careType: md.careType,
    surcharges: md.surcharges,
    storageRef: md.storageRef,
    contractEnd: md.contractEnd,
    address: md.address,
    lastEditedAt: md.lastEditedAt,
    lastEditedBy: md.lastEditedBy,
    hasInvite: !!anyInvite,
    hasSubmittedDocuments: user.hasSubmittedDocuments,
  }

  return { member, isOwnChild }
})
