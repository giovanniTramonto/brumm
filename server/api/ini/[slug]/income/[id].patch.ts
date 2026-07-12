import { z } from 'zod'
import { getClubDb } from '~/server/utils/clubDatabase'
import { updateIncome } from '~/server/utils/storage/postgres/financials'

const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  recurrenceType: z.enum(['once', 'recurring', 'period']).optional(),
  startAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club
  const id = getRouterParam(event, 'id') ?? ''

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingabe' })
  }

  const sql = await getClubDb(club.id)
  const item = await updateIncome(sql, id, parsed.data)

  return { item }
})
