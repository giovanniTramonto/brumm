import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  membershipFee: z.number().min(0).nullable(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingabe' })
  }

  const updated = await prisma.club.update({
    where: { id: club.id },
    data: { membershipFee: parsed.data.membershipFee },
  })

  return { membershipFee: updated.membershipFee }
})
