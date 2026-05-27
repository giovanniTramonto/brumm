import { getGroup, updateGroup } from '~/server/utils/groupData'
import { formatZodError, updateGroupSchema } from '~/server/utils/schemas'

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

  const parsed = updateGroupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email } = parsed.data
  const group = await updateGroup(club, groupId, {
    ...(name ? { name } : {}),
    ...(email !== undefined ? { email: email || null } : {}),
  })

  return { group }
})
