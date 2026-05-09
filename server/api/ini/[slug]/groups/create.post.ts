import { prisma } from '~/server/utils/prisma'
import { createGroupSchema, formatZodError } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = createGroupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email } = parsed.data

  const group = await prisma.group.create({
    data: {
      clubId: club.id,
      name: name.trim(),
      email: email || null,
    },
  })

  return { group }
})
