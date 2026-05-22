import { sendEmailAddedNotification, sendEmailRemovedNotification } from '~/server/utils/email'
import { getManagerData } from '~/server/utils/managerData'
import { getAllMemberData, getMemberData, updateMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, updateMemberSchema } from '~/server/utils/schemas'

async function resolveEditorName(
  user: { id: string; role: string; storageId: string | null },
  existingMember: { guardian1Name: string | null },
  club: Parameters<typeof getManagerData>[1],
): Promise<string | null> {
  if (user.role === 'MEMBER') return existingMember.guardian1Name ?? null
  if (user.role === 'MANAGER' && user.storageId) {
    const manager = await prisma.manager.findFirst({
      where: { storageId: user.storageId, clubId: club.id },
    })
    if (manager) {
      const data = await getManagerData(manager.id, club)
      if (data?.name) return data.name
    }
  }
  return 'Admin'
}

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
  const isSelfUpdate = currentUser.role === 'MEMBER' && currentUser.id === memberId
  if (!canManageMembers && !isSelfUpdate) {
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
    careType,
    surcharges,
    contractEnd,
  } = parsed.data

  const newEmail1 = email1.toLowerCase()
  const newEmail2 = email2 ? email2.toLowerCase() : null

  const updates: Parameters<typeof updateMemberData>[1] = {
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
    careType: careType || null,
    contractEnd: contractEnd || null,
  }

  if (canManageMembers && surcharges !== undefined) {
    updates.surcharges = surcharges
  }

  updates.lastEditedAt = new Date().toISOString()
  updates.lastEditedBy = await resolveEditorName(currentUser, existing, club)

  await updateMemberData(memberId, updates, club)

  // Cascade email changes to sibling members (other children of the same guardian)
  const email1Changed = existing.email1 !== newEmail1
  const email2Changed = (existing.email2 ?? null) !== (newEmail2 ?? null)
  if (email1Changed || email2Changed) {
    const siblingUsers = await prisma.user.findMany({
      where: { clubId: club.id, role: 'MEMBER', id: { not: memberId } },
    })
    if (siblingUsers.length > 0) {
      const siblingDataList = await getAllMemberData(
        siblingUsers.map((u) => u.id),
        club,
      )
      await Promise.allSettled(
        siblingDataList
          .filter(
            (md) =>
              (email1Changed && md.email1 === existing.email1) ||
              (email2Changed && existing.email2 && md.email2 === existing.email2),
          )
          .map((sibling) => {
            const siblingUpdates: Record<string, string | null> = {}
            if (email1Changed && sibling.email1 === existing.email1)
              siblingUpdates.email1 = newEmail1
            if (email2Changed && existing.email2 && sibling.email2 === existing.email2)
              siblingUpdates.email2 = newEmail2
            return updateMemberData(sibling.userId, siblingUpdates, club)
          }),
      )
    }
  }

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
