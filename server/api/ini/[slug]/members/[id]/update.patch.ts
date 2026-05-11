import { getMemberData, updateMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, updateMemberSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = updateMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const existing = await getMemberData(memberId, club)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const { firstName, lastName, birthDate, guardian1Name, guardian2Name, email1, email2, groupId, contractEnd } =
    parsed.data

  await updateMemberData(
    memberId,
    {
      firstName,
      lastName,
      birthDate,
      guardian1Name,
      guardian2Name: guardian2Name || null,
      email1: email1.toLowerCase(),
      email2: email2 ? email2.toLowerCase() : null,
      groupId: groupId || null,
      contractEnd: contractEnd || null,
    },
    club,
  )

  return { ok: true }
})
