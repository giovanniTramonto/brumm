import { prisma } from '~/server/utils/prisma'
import { downloadDriveFile } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const templateId = getRouterParam(event, 'id')

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template?.driveFileId) {
    throw createError({ statusCode: 404, statusMessage: 'Keine Vorlage hochgeladen' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

  const tokens = club.oauthToken as OAuthTokens
  const { buffer, filename, mimeType } = await downloadDriveFile({
    tokens,
    fileId: template.driveFileId,
  })

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return send(event, buffer)
})
