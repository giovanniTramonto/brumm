import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingabe' })
  }

  const updated = await prisma.club.update({
    where: { id: club.id },
    data: { name: parsed.data.name },
  })

  return { name: updated.name }
})
