import { prisma } from "~/server/utils/prisma"
import { updateGroupSchema, formatZodError } from "~/server/utils/schemas"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const groupId = getRouterParam(event, "id")

  if (currentUser.role !== "SUPERUSER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: "ID fehlt" })
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, clubId: club.id },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: "Gruppe nicht gefunden" })
  }

  const parsed = updateGroupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, email } = parsed.data

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
    },
  })

  return { group: updated }
})
