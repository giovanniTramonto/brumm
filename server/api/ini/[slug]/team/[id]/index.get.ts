import { prisma } from '~/server/utils/prisma'
import { getTeamMemberData } from '~/server/utils/teamData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const teamId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!teamId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const member = await prisma.team.findFirst({ where: { id: teamId, clubId: club.id } })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Teammitglied nicht gefunden' })
  }

  const data = await getTeamMemberData(teamId, club)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Teammitglied nicht gefunden' })
  }

  return {
    member: {
      id: member.id,
      clubId: member.clubId,
      storageId: member.storageId,
      name: data.name,
      email: data.email,
      createdAt: member.createdAt.toISOString(),
    },
  }
})
