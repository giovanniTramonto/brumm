import { getAllParentJobs } from '~/server/utils/parentJobData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const jobs = await getAllParentJobs(club)
  return { parentJobs: jobs }
})
