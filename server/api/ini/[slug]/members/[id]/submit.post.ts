import { sendDocumentsSubmittedNotification } from '~/server/utils/email'
import { getAllManagerData } from '~/server/utils/managerData'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

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

  const [user, md] = await Promise.all([
    prisma.user.findFirst({ where: { id: memberId, clubId: club.id } }),
    getMemberData(memberId, club),
  ])

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  if (!canManageMembers) {
    const ownMd = await getMemberData(currentUser.id, club)
    const ownEmails = [ownMd?.email1, ownMd?.email2]
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
    const isGuardian =
      currentUser.id === memberId ||
      (md?.email1 && ownEmails.includes(md.email1.toLowerCase())) ||
      (md?.email2 && ownEmails.includes(md.email2.toLowerCase()))
    if (!isGuardian) {
      throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
    }
  }

  if (user.isActive || md?.deactivatedAt) {
    throw createError({ statusCode: 409, statusMessage: 'Einreichung nicht möglich' })
  }

  const childName = md ? `${md.firstName} ${md.lastName}` : memberId

  const memberManagers = await prisma.manager.findMany({
    where: { clubId: club.id, isMemberManager: true },
  })

  let notifyEmails: string[]

  if (memberManagers.length > 0) {
    const allManagerData = await getAllManagerData(club)
    const memberManagerIds = new Set(memberManagers.map((m) => m.id))
    notifyEmails = allManagerData
      .filter((d) => memberManagerIds.has(d.managerId) && d.email)
      .map((d) => d.email)
  } else {
    const superUserEmails = await prisma.userEmail.findMany({
      where: { user: { clubId: club.id, role: 'SUPERUSER' } },
      select: { email: true },
    })
    notifyEmails = superUserEmails.map((e) => e.email)
  }

  await prisma.user.update({
    where: { id: memberId },
    data: { hasSubmittedDocuments: true },
  })

  if (notifyEmails.length > 0) {
    await sendDocumentsSubmittedNotification({
      to: notifyEmails,
      clubName: club.name,
      childName,
      clubSlug: club.slug,
      userId: memberId,
    })
  }

  return { ok: true }
})
