import { z } from 'zod'
import { reorderParentJobMembers } from '~/server/utils/parentJobData'

const schema = z.object({ ids: z.array(z.string()).min(1) })

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const jobId = getRouterParam(event, 'id') as string

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Reihenfolge' })
  }

  await reorderParentJobMembers(club, jobId, parsed.data.ids)
  return { ok: true }
})
