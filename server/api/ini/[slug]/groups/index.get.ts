import { getAllGroups } from '~/server/utils/groupData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const groups = await getAllGroups(club)
  return { groups }
})
