import { getAllGroups } from '~/server/utils/groupData'
import { getAllManagerData } from '~/server/utils/managerData'
import { getAllMemberDataForClub } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import type { Member } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  const [[users, memberManagerRecords, invites], [allMemberData, groups, allManagerData]] =
    await Promise.all([
      Promise.all([
        prisma.user.findMany({
          where: { clubId: club.id },
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
        prisma.manager.findMany({
          where: { clubId: club.id, isMemberManager: true },
          select: { id: true },
        }),
        prisma.invite.findMany({ where: { clubId: club.id }, select: { userId: true } }),
      ]),
      Promise.all([getAllMemberDataForClub(club), getAllGroups(club), getAllManagerData(club)]),
    ])

  const inviteUserIds = new Set(invites.map((i) => i.userId))

  const groupMap = new Map(groups.map((g) => [g.id, g]))
  const memberDataMap = new Map(allMemberData.map((md) => [md.userId, md]))

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    currentUser.role === 'TEAM' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  let guardianEmails: Set<string> | null = null
  if (currentUser.role === 'MEMBER') {
    const ownMd = memberDataMap.get(currentUser.id)
    const emails = [ownMd?.email1, ownMd?.email2]
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
    guardianEmails = new Set(emails)
  }

  const members: Member[] = users
    .map((u) => {
      const md = memberDataMap.get(u.id)
      if (!md) return null
      const isOwnChild = guardianEmails
        ? guardianEmails.has(md.email1.toLowerCase()) ||
          !!(md.email2 && guardianEmails.has(md.email2.toLowerCase()))
        : false
      return {
        id: u.id,
        clubId: u.clubId,
        role: u.role,
        status: u.status,
        deactivatedAt: u.deactivatedAt?.toISOString() ?? null,
        storageId: u.storageId,
        isMemberManager: u.isMemberManager,
        createdAt: u.createdAt.toISOString(),
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
        contractStart: md.contractStart,
        surcharges: canManageMembers || isOwnChild ? md.surcharges : null,
        group: md.groupId ? (groupMap.get(md.groupId) ?? null) : null,
        storageRef: md.storageRef,
        contractEnd: md.contractEnd,
        lastEditedAt: md.lastEditedAt,
        lastEditedBy: md.lastEditedBy,
        address: md.address,
        isOwnChild,
        hasInvite: inviteUserIds.has(u.id),
        hasSubmittedDocuments: u.hasSubmittedDocuments,
      }
    })
    .filter((m) => m !== null)
    .sort((a, b) => {
      const lastCmp = a.lastName.localeCompare(b.lastName, 'de')
      return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName, 'de')
    }) as Member[]

  const memberManagerIds = new Set(memberManagerRecords.map((m) => m.id))
  const memberManagerNames = allManagerData
    .filter((md) => memberManagerIds.has(md.managerId))
    .map((md) => md.name)

  return { members, groups, hasAnyMemberManager: memberManagerNames.length > 0, memberManagerNames }
})
