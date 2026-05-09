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

  const canViewAll = currentUser.role === 'SUPERUSER' || currentUser.role === 'TEAM'
  if (!canViewAll && currentUser.id !== memberId) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const md = await getMemberData(memberId, club)

  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const member: Member = {
    id: user.id,
    clubId: user.clubId,
    role: user.role,
    isActive: user.isActive,
    storageId: user.storageId,
    createdAt: user.createdAt.toISOString(),
    firstName: md.firstName,
    lastName: md.lastName,
    birthDate: md.birthDate,
    guardian1Name: md.guardian1Name,
    guardian2Name: md.guardian2Name,
    email1: md.email1,
    email2: md.email2,
    groupId: md.groupId,
    storageRef: md.storageRef,
  }

  return { member }
})
