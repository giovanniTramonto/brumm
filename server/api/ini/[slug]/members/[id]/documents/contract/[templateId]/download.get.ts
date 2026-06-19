import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import { downloadDriveFile, findMemberContractFileId } from '~/server/utils/storage/googleDrive'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const templateId = getRouterParam(event, 'templateId')

  if (!memberId || !templateId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'TEAM') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const submission = await prisma.memberDocument.findUnique({
    where: { memberId_templateId: { memberId, templateId } },
  })
  if (!submission?.fileName) {
    throw createError({ statusCode: 404, statusMessage: 'Dokument nicht gefunden' })
  }

  if (submission.s3Key && (await getClubStorageType(club.id)) === 'S3') {
    const url = await s3GetPresignedUrl(club.id, submission.s3Key)
    return sendRedirect(event, url, 302)
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig
  const md = await getMemberData(memberId, club)
  if (!md) throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })

  const fileId = await findMemberContractFileId({
    tokens,
    membersFolderId: storageConfig.membersFolderId,
    storageRef: md.storageRef,
    fileName: submission.fileName,
  })
  if (!fileId) throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  const { buffer, filename, mimeType } = await downloadDriveFile({ tokens, fileId })
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return buffer
})
