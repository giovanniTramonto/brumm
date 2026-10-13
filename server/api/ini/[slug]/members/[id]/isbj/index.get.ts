import { loadMemberForIsbj, loadMemberIsbjData } from '~/server/utils/memberIsbj'
import type { MemberISBJResponse } from '~/types'

export default defineEventHandler(async (event): Promise<MemberISBJResponse> => {
  const { member } = await loadMemberForIsbj(event)
  return loadMemberIsbjData(event.context.club.id, member)
})
