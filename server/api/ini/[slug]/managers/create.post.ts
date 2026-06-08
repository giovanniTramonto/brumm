import { sendManagerAddedEmail } from '~/server/utils/email'
import { createMagicLink } from '~/server/utils/magicLink'
import { saveManagerData } from '~/server/utils/managerData'
import { prisma } from '~/server/utils/prisma'
import { createManagerSchema, formatZodError } from '~/server/utils/schemas'
import { generateStorageId } from '~/server/utils/storageRef'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = createManagerSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email, isMemberManager } = parsed.data
  const storageId = generateStorageId()

  const manager = await prisma.manager.create({
    data: { clubId: club.id, storageId, isMemberManager: isMemberManager ?? false },
  })

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      storageId,
      role: 'MANAGER',
      isMemberManager: isMemberManager ?? false,
    },
  })

  await saveManagerData({ managerId: manager.id, storageId, name, email }, club)

  const magicLink = await createMagicLink({ userId: user.id })

  await sendManagerAddedEmail({
    to: email,
    name,
    clubName: club.name,
    clubSlug: club.slug,
    magicLinkToken: magicLink.token,
  }).catch(() => {})

  return {
    manager: {
      id: manager.id,
      storageId,
      isMemberManager: manager.isMemberManager,
      name,
      email,
      createdAt: manager.createdAt.toISOString(),
    },
  }
})
