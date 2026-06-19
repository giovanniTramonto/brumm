import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { s3CopyFile } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const templateId = getRouterParam(event, 'templateId')

  if (!memberId || !templateId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canActForAll = currentUser.role === 'SUPERUSER' || currentUser.role === 'TEAM'

  if (!canActForAll) {
    const md = await getMemberData(memberId, club)
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

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template || template.documentType !== 'read') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vorlage nicht gefunden oder falscher Typ',
    })
  }

  const existing = await prisma.memberDocument.findUnique({
    where: { memberId_templateId: { memberId, templateId } },
  })

  if (existing?.readAt) {
    return { submission: existing }
  }

  let newS3Key: string | null = null

  if (template.s3Key) {
    try {
      const result = await s3CopyFile(club.id, template.s3Key, `members/${memberId}/contract`)
      newS3Key = result.key
    } catch {
      // non-fatal: submission recorded without file copy
    }
  }

  const submission = await prisma.memberDocument.upsert({
    where: { memberId_templateId: { memberId, templateId } },
    create: {
      memberId,
      templateId,
      readAt: new Date(),
      s3Key: newS3Key,
      fileName: template.fileName,
    },
    update: { readAt: new Date(), s3Key: newS3Key, fileName: template.fileName },
  })

  return { submission }
})
