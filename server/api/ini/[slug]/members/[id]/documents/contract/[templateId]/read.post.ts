import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import {
  copyFileToMemberDocuments,
  findDriveFileByName,
  getOrCreateTemplateSubfolder,
} from '~/server/utils/storage/googleDrive'
import { s3CopyFile } from '~/server/utils/storage/s3/files'
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

  let newS3Key: string | null = null
  const fileName: string | null = template.fileName

  if (club.isSetupDone && template.fileName) {
    const memberData = await getMemberData(memberId, club)
    if (memberData?.storageRef) {
      if ((await getClubStorageType(club.id)) === 'S3' && template.s3Key) {
        try {
          const result = await s3CopyFile(club.id, template.s3Key, `members/${memberId}/contract`)
          newS3Key = result.key
        } catch {
          // non-fatal: submission recorded without file copy
        }
      } else if ((await getClubStorageType(club.id)) !== 'S3') {
        const tokens = club.oauthToken as OAuthTokens
        const storageConfig = club.storageConfig as GoogleDriveConfig
        try {
          const drive = getDriveClientFromTokens(tokens)
          const subfolderId = await getOrCreateTemplateSubfolder({
            tokens,
            templatesFolderId: storageConfig.templatesFolderId,
            ref: template.ref,
          })
          const sourceFileId = await findDriveFileByName(drive, subfolderId, template.fileName)
          if (sourceFileId) {
            await copyFileToMemberDocuments({
              tokens,
              membersFolderId: storageConfig.membersFolderId,
              storageRef: memberData.storageRef,
              sourceFileId,
              filename: template.fileName,
            })
          }
        } catch {
          // non-fatal
        }
      }
    }
  }

  const submission = await prisma.memberDocument.upsert({
    where: { memberId_templateId: { memberId, templateId } },
    create: { memberId, templateId, readAt: new Date(), s3Key: newS3Key, fileName },
    update: { readAt: new Date(), s3Key: newS3Key, fileName },
  })

  return { submission }
})
