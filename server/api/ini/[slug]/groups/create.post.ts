import { createGroup } from '~/server/utils/groupData'
import { createGroupSchema, formatZodError } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  // TODO: remove – temporarily open for all roles
  const parsed = createGroupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email } = parsed.data
  const group = await createGroup(club, { name, email: email || null })
  return { group }
})
