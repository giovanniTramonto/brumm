import { prisma } from '~/server/utils/prisma'
import { downloadDriveFile } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const fileId = getRouterParam(event, 'fileId')

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }
  if (!fileId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const document = await prisma.document.findFirst({ where: { id: fileId, clubId: club.id } })
  if (!document?.driveFileId) {
    throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })
  }

  const { buffer, filename, mimeType } = await downloadDriveFile({
    tokens: club.oauthToken as OAuthTokens,
    fileId: document.driveFileId,
  })

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return buffer
})
