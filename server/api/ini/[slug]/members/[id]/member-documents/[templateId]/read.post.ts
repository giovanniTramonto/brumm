import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { copyFileToMemberDocuments } from '~/server/utils/storage/googleDrive'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

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

  let driveFileId: string | null = null

  if (club.isSetupDone && template.driveFileId && template.driveFileName) {
    const tokens = club.oauthToken as OAuthTokens
    const storageConfig = club.storageConfig as GoogleDriveConfig
    const memberData = await getMemberData(memberId, club)
    if (memberData?.storageRef) {
      driveFileId = await copyFileToMemberDocuments({
        tokens,
        membersFolderId: storageConfig.membersFolderId,
        storageRef: memberData.storageRef,
        sourceFileId: template.driveFileId,
        filename: template.driveFileName,
      })
    }
  }

  const submission = await prisma.memberDocument.upsert({
    where: { memberId_templateId: { memberId, templateId } },
    create: {
      memberId,
      templateId,
      readAt: new Date(),
      driveFileId,
      filename: template.driveFileName,
    },
    update: { readAt: new Date(), driveFileId, filename: template.driveFileName },
  })

  return { submission }
})
