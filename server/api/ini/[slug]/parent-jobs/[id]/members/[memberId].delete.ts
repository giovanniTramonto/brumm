import { removeParentJobMember } from '~/server/utils/parentJobData'

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

  await removeParentJobMember(club, jobId, memberId)
  return { ok: true }
})
