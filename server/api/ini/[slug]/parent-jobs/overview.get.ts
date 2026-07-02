import { getAllParentJobsWithMembers } from '~/server/utils/parentJobData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const jobs = await getAllParentJobsWithMembers(club)
  return { parentJobs: jobs }
})
