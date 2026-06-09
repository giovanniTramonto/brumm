import { prisma } from '~/server/utils/prisma'
import { getAllTeamMemberData } from '~/server/utils/teamData'
import type { TeamMember } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (!currentUser) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht eingeloggt' })
  }

  const members = await prisma.team.findMany({ where: { clubId: club.id } })
  const dataList = await getAllTeamMemberData(club)
  const dataMap = new Map(dataList.map((d) => [d.teamId, d]))

  const result: TeamMember[] = members
    .map((m) => {
      const data = dataMap.get(m.id)
      if (!data) return null
      return {
        id: m.id,
        clubId: m.clubId,
        storageId: m.storageId,
        name: data.name,
        email: data.email,
        createdAt: m.createdAt.toISOString(),
      } satisfies TeamMember
    })
    .filter((m): m is TeamMember => m !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return { team: result }
})
