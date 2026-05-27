import { deleteGroup, getGroup } from '~/server/utils/groupData'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const groupId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const existing = await getGroup(club, groupId)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Gruppe nicht gefunden' })
  }

  await deleteGroup(club, groupId)
  return { ok: true }
})
