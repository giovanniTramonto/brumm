import { getParentJobWithMembers } from '~/server/utils/parentJobData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const jobId = getRouterParam(event, 'id')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const job = await getParentJobWithMembers(club, jobId)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Elternposten nicht gefunden' })
  }

  return { parentJob: job }
})
