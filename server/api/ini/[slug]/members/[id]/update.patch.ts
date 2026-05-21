import { sendEmailAddedNotification, sendEmailRemovedNotification } from '~/server/utils/email'
import { getMemberData, updateMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, updateMemberSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = updateMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const existing = await getMemberData(memberId, club)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const {
    firstName,
    lastName,
    birthDate,
    guardian1Name,
    guardian2Name,
    email1,
    email2,
    phone1,
    phone2,
    groupId,
    contractEnd,
  } = parsed.data

  const newEmail1 = email1.toLowerCase()
  const newEmail2 = email2 ? email2.toLowerCase() : null

  await updateMemberData(
    memberId,
    {
      firstName,
      lastName,
      birthDate,
      guardian1Name,
      guardian2Name: guardian2Name || null,
      email1: newEmail1,
      email2: newEmail2,
      phone1: phone1 || null,
      phone2: phone2 || null,
      groupId: groupId || null,
      contractEnd: contractEnd || null,
    },
    club,
  )

  const oldEmailSet = new Set([existing.email1, existing.email2].filter(Boolean) as string[])
  const newEmails = [newEmail1, ...(newEmail2 ? [newEmail2] : [])]
  const removedEmails = [...oldEmailSet].filter((e) => !newEmails.includes(e))
  const addedEmails = newEmails.filter((e) => !oldEmailSet.has(e))
  const childName = `${existing.firstName} ${existing.lastName}`

  await Promise.allSettled([
    ...removedEmails.map((to) =>
      sendEmailRemovedNotification({ to, clubName: club.name, childName }),
    ),
    ...addedEmails.map((to) =>
      sendEmailAddedNotification({ to, clubName: club.name, childName, clubSlug: club.slug }),
    ),
  ])

  return { ok: true }
})
