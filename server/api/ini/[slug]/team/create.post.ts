import { sendTeamAddedEmail } from '~/server/utils/email'
import { createMagicLink } from '~/server/utils/magicLink'
import { prisma } from '~/server/utils/prisma'
import { createTeamSchema, formatZodError } from '~/server/utils/schemas'
import { generateStorageId } from '~/server/utils/storageRef'
import { saveTeamMemberData } from '~/server/utils/teamData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = createTeamSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email } = parsed.data
  const storageId = generateStorageId()

  const member = await prisma.team.create({
    data: { clubId: club.id, storageId },
  })

  const user = await prisma.user.create({
    data: { clubId: club.id, storageId, role: 'TEAM' },
  })

  await saveTeamMemberData({ teamId: member.id, storageId, name, email }, club)

  const magicLink = await createMagicLink({ userId: user.id })

  await sendTeamAddedEmail({
    to: email,
    name,
    clubName: club.name,
    clubSlug: club.slug,
    magicLinkToken: magicLink.token,
  }).catch(() => {})

  return {
    member: {
      id: member.id,
      storageId,
      name,
      email,
      createdAt: member.createdAt.toISOString(),
    },
  }
})
