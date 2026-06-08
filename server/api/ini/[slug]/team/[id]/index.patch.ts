import { prisma } from '~/server/utils/prisma'
import { formatZodError, updateTeamSchema } from '~/server/utils/schemas'
import { updateTeamMemberData } from '~/server/utils/teamData'

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

  const parsed = updateTeamSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const member = await prisma.team.findFirst({ where: { id: teamId, clubId: club.id } })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Teammitglied nicht gefunden' })
  }

  const { name, email } = parsed.data

  if (name !== undefined || email !== undefined) {
    await updateTeamMemberData(teamId, { ...(name && { name }), ...(email && { email }) }, club)
  }

  return { member: { id: teamId } }
})
