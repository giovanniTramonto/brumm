import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import {
  downloadDriveFile,
  findDriveFileByName,
  getOrCreateTemplateSubfolder,
} from '~/server/utils/storage/googleDrive'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const templateId = getRouterParam(event, 'id')

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template?.fileName) {
    throw createError({ statusCode: 404, statusMessage: 'Keine Vorlage hochgeladen' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

  if (template.s3Key && (await getClubStorageType(club.id)) === 'S3') {
    const url = await s3GetPresignedUrl(club.id, template.s3Key)
    return sendRedirect(event, url, 302)
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig
  if (!storageConfig.templatesFolderId)
    throw createError({ statusCode: 500, statusMessage: 'Templates-Ordner nicht konfiguriert' })

  const drive = getDriveClientFromTokens(tokens)
  const subfolderId = await getOrCreateTemplateSubfolder({
    tokens,
    templatesFolderId: storageConfig.templatesFolderId,
    ref: template.ref,
  })
  const fileId = await findDriveFileByName(drive, subfolderId, template.fileName)
  if (!fileId) throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  const { buffer, filename, mimeType } = await downloadDriveFile({ tokens, fileId })
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return send(event, buffer)
})
