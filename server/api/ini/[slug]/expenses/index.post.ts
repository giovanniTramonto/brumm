import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import { getClubDb } from '~/server/utils/clubDatabase'
import { createExpense, getMaxExpenseSortOrder } from '~/server/utils/storage/postgres/financials'

const schema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().min(0),
  recurrenceType: z.enum(['once', 'recurring', 'period']).default('once'),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
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

  const { name, amount, recurrenceType, startAt, endAt } = parsed.data
  const sql = await getClubDb(club.id)
  const sortOrder = await getMaxExpenseSortOrder(sql)

  const item = await createExpense(sql, {
    id: createId(),
    name,
    amount,
    startAt,
    endAt,
    recurrenceType,
    sortOrder,
  })

  return { item }
})
