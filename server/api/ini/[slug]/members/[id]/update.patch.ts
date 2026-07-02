import { sendEmailAddedNotification, sendEmailRemovedNotification } from '~/server/utils/email'
import { getManagerData } from '~/server/utils/managerData'
import { batchUpdateMembersData, getAllMemberData } from '~/server/utils/memberData'
import { syncParentJobMemberContact } from '~/server/utils/parentJobData'
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

  const [user, allMemberUsers] = await Promise.all([
    prisma.user.findFirst({ where: { id: memberId, clubId: club.id } }),
    prisma.user.findMany({ where: { clubId: club.id, role: 'MEMBER' }, select: { id: true } }),
  ])

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  // Single sheet read for all member data
  const allMemberData = await getAllMemberData(
    allMemberUsers.map((u) => u.id),
    club,
  )
  const existing = allMemberData.find((m) => m.userId === memberId)
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
    address,
    lastEditedAt: expectedLastEditedAt,
  } = parsed.data

  const newEmail1 = email1.toLowerCase()
  const newEmail2 = email2 ? email2.toLowerCase() : null

  const mainPatch: Partial<typeof existing> = {
    firstName,
    lastName,
    birthDate,
    guardian1Name,
    guardian2Name: guardian2Name || null,
    email1: newEmail1,
    email2: newEmail2,
    phone1: phone1 || null,
    phone2: phone2 || null,
    groupId: isSelfUpdate ? existing.groupId : groupId || null,
    careType: isSelfUpdate ? existing.careType : careType || null,
    contractEnd: isSelfUpdate ? existing.contractEnd : contractEnd || null,
    address: address || null,
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: await resolveEditorName(currentUser, existing, club),
  }

  if (canManageMembers && surcharges !== undefined) {
    mainPatch.surcharges = surcharges
  }

  // Find siblings from already-loaded data, no second sheet read
  const email1Changed = existing.email1 !== newEmail1
  const email2Changed = (existing.email2 ?? null) !== (newEmail2 ?? null)
  const affectedSiblingNames: string[] = []

  const batchUpdates: { userId: string; patch: Partial<typeof existing> }[] = [
    { userId: memberId, patch: mainPatch },
  ]

  if (email1Changed || email2Changed) {
    const affectedSiblings = allMemberData.filter(
      (md) =>
        md.userId !== memberId &&
        ((email1Changed && md.email1 === existing.email1) ||
          (email2Changed && existing.email2 && md.email2 === existing.email2)),
    )
    for (const s of affectedSiblings) {
      affectedSiblingNames.push(`${s.firstName} ${s.lastName}`)
      const siblingPatch: Record<string, string | null> = {}
      if (email1Changed && s.email1 === existing.email1) siblingPatch.email1 = newEmail1
      if (email2Changed && existing.email2 && s.email2 === existing.email2)
        siblingPatch.email2 = newEmail2
      batchUpdates.push({ userId: s.userId, patch: siblingPatch })
    }
  }

  // Single write for main member + all siblings
  await batchUpdateMembersData(batchUpdates, club, expectedLastEditedAt)

  // Sync parent job member contacts (fire-and-forget, non-critical)
  const syncPromises: Promise<void>[] = [
    syncParentJobMemberContact(club, {
      oldEmail: existing.email1,
      newEmail: newEmail1,
      name: guardian1Name,
      phone: phone1 || null,
    }),
  ]
  if (existing.email2) {
    syncPromises.push(
      syncParentJobMemberContact(club, {
        oldEmail: existing.email2,
        newEmail: newEmail2 ?? existing.email2,
        name: guardian2Name || null,
        phone: phone2 || null,
      }),
    )
  }
  await Promise.allSettled(syncPromises)

  const oldEmailSet = new Set([existing.email1, existing.email2].filter(Boolean) as string[])
  const newEmails = [newEmail1, ...(newEmail2 ? [newEmail2] : [])]
  const removedEmails = [...oldEmailSet].filter((e) => !newEmails.includes(e))
  const addedEmails = newEmails.filter((e) => !oldEmailSet.has(e))
  const childNames = [`${existing.firstName} ${existing.lastName}`, ...affectedSiblingNames]

  const anyInvite = await prisma.invite.findFirst({ where: { userId: memberId } })
  const hasInvite = !!anyInvite
  const sendEmailNotifications = hasInvite || user.status === 'ACTIVE' || user.status === 'INACTIVE'

  if (sendEmailNotifications) {
    await Promise.allSettled([
      ...removedEmails.map((to) =>
        sendEmailRemovedNotification({ to, clubName: club.name, childNames }),
      ),
      ...addedEmails.map((to) =>
        sendEmailAddedNotification({ to, clubName: club.name, childNames, clubSlug: club.slug }),
      ),
    ])
  }

  return { ok: true }
})
