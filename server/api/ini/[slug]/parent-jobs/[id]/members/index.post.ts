import { addParentJobMember, getParentJob } from '~/server/utils/parentJobData'
import { addParentJobMemberSchema, formatZodError } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const jobId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const existing = await getParentJob(club, jobId)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Elternposten nicht gefunden' })
  }

  const parsed = addParentJobMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { email, name, phone, isLeader } = parsed.data
  const member = await addParentJobMember(club, {
    jobId,
    email,
    name: name ?? null,
    phone: phone ?? null,
    isLeader,
  })
  return { member }
})
