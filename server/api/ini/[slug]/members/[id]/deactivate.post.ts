import { prisma } from "~/server/utils/prisma"
import { sendDeactivationConfirmation, sendSuperUserNotification } from "~/server/utils/email"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, "id")

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: "ID fehlt" })
  }

  const isSelf = currentUser.id === memberId
  const isSuperUser = currentUser.role === "SUPERUSER"

  if (!isSelf && !isSuperUser) {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
    include: { emails: true },
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: "Mitglied nicht gefunden" })
  }

  if (!member.isActive) {
    throw createError({ statusCode: 409, statusMessage: "Mitglied bereits inaktiv" })
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: isSelf ? "self" : currentUser.id,
    },
  })

  await prisma.session.deleteMany({ where: { userId: memberId } })

  const memberEmails = member.emails.map((e) => e.email)
  const childName = `${member.firstName} ${member.lastName}`

  await sendDeactivationConfirmation({
    to: memberEmails,
    clubName: club.name,
    childName,
  })

  if (isSelf) {
    const superusers = await prisma.user.findMany({
      where: { clubId: club.id, role: "SUPERUSER" },
      include: { emails: true },
    })
    const superuserEmails = superusers.flatMap((su) => su.emails.map((e) => e.email))

    await sendSuperUserNotification({
      to: superuserEmails,
      clubName: club.name,
      childName,
      clubSlug: club.slug,
      userId: memberId,
    })
  }

  if (isSelf) {
    deleteCookie(event, "session_token", { path: "/" })
  }

  return { member: updated }
})
