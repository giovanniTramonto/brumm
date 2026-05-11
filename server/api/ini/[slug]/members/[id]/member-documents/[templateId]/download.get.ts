import { prisma } from '~/server/utils/prisma'
import { downloadDriveFile } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'

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
  if (!submission) {
    throw createError({ statusCode: 404, statusMessage: 'Dokument nicht gefunden' })
  }

  const tokens = club.oauthToken as OAuthTokens
  const { buffer, filename, mimeType } = await downloadDriveFile({ tokens, fileId: submission.driveFileId })

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
  return buffer
})
