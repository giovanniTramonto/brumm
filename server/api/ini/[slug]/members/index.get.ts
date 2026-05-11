import { getAllMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import type { Member } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  const users = await prisma.user.findMany({
    where: { clubId: club.id },
  })

  const userIds = users.map((u) => u.id)
  const [memberDataList, pendingInvites] = await Promise.all([
    getAllMemberData(userIds, club),
    prisma.invite.findMany({ where: { userId: { in: userIds }, isUsed: false }, select: { userId: true } }),
  ])
  const pendingInviteUserIds = new Set(pendingInvites.map((i) => i.userId))

  const memberDataMap = new Map(memberDataList.map((md) => [md.userId, md]))

  let guardianEmails: Set<string> | null = null
  if (currentUser.role === 'MEMBER') {
    const ownMd = memberDataMap.get(currentUser.id)
    const emails = [ownMd?.email1, ownMd?.email2].filter((e): e is string => !!e).map((e) => e.toLowerCase())
    guardianEmails = new Set(emails)
  }

  const members: Member[] = users
    .map((u) => {
      const md = memberDataMap.get(u.id)
      if (!md) return null
      if (guardianEmails) {
        const match =
          guardianEmails.has(md.email1.toLowerCase()) ||
          (md.email2 && guardianEmails.has(md.email2.toLowerCase()))
        if (!match) return null
      }
      return {
        id: u.id,
        clubId: u.clubId,
        role: u.role,
        isActive: u.isActive,
        storageId: u.storageId,
        createdAt: u.createdAt.toISOString(),
        firstName: md.firstName,
        lastName: md.lastName,
        birthDate: md.birthDate,
        guardian1Name: md.guardian1Name,
        guardian2Name: md.guardian2Name,
        email1: md.email1,
        email2: md.email2,
        groupId: md.groupId,
        storageRef: md.storageRef,
        deactivatedAt: md.deactivatedAt,
        contractEnd: md.contractEnd,
        hasPendingInvite: pendingInviteUserIds.has(u.id),
      } satisfies Member
    })
    .filter((m): m is Member => m !== null)
    .sort((a, b) => {
      const lastCmp = a.lastName.localeCompare(b.lastName, 'de')
      return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName, 'de')
    })

  return { members }
})
