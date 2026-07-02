import { deleteParentJob, getParentJob } from '~/server/utils/parentJobData'

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

  await deleteParentJob(club, jobId)
  return { ok: true }
})
