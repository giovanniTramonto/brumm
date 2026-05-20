import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canViewAll =
    currentUser.role === 'SUPERUSER' ||
    currentUser.role === 'TEAM' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  if (!canViewAll) {
    const ownMd = await getMemberData(currentUser.id, club)
    const md = await getMemberData(memberId, club)
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

  const [templates, submissions] = await Promise.all([
    prisma.documentTemplate.findMany({
      where: { clubId: club.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, documentType: true, driveFileId: true, driveFileName: true },
    }),
    prisma.memberDocument.findMany({
      where: { memberId, template: { clubId: club.id } },
      select: {
        id: true,
        templateId: true,
        filename: true,
        uploadedAt: true,
        readAt: true,
        driveFileId: true,
      },
    }),
  ])

  const submissionMap = new Map(submissions.map((s) => [s.templateId, s]))

  const result = templates.map((t) => ({
    ...t,
    hasFile: !!t.driveFileId,
    submission: submissionMap.get(t.id) ?? null,
  }))

  const uploadRequired = result.filter((t) => t.documentType === 'upload' && t.hasFile)
  return { templates: result, allSubmitted: uploadRequired.every((t) => t.submission !== null) }
})
