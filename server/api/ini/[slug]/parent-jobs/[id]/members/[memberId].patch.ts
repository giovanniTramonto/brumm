import { updateParentJobMember } from '~/server/utils/parentJobData'
import { formatZodError, updateParentJobMemberSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const jobId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!jobId || !memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const parsed = updateParentJobMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const member = await updateParentJobMember(club, jobId, memberId, parsed.data)
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  return { member }
})
