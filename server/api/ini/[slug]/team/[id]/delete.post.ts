import { sendTeamRemovedEmail } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { deleteTeamMemberData, getTeamMemberData } from '~/server/utils/teamData'

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

  const teamUser = await prisma.user.findFirst({
    where: { storageId: member.storageId, clubId: club.id, role: 'TEAM' },
  })

  await deleteTeamMemberData(teamId, club)
  await prisma.team.delete({ where: { id: teamId } })

  if (teamUser) {
    await prisma.deviceSession.deleteMany({ where: { userId: teamUser.id } })
    await prisma.session.deleteMany({ where: { userId: teamUser.id } })
    await prisma.magicLink.deleteMany({ where: { userId: teamUser.id } })
    await prisma.user.delete({ where: { id: teamUser.id } })
  }

  if (data) {
    await sendTeamRemovedEmail({ to: data.email, name: data.name, clubName: club.name }).catch(
      () => {},
    )
  }

  return { ok: true }
})
