import { ensureDocumentsFolder } from '~/server/utils/clubDocuments'
import { prisma } from '~/server/utils/prisma'
import { deleteDriveFile, uploadClubDocument } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '~/utils/config'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const fileId = getRouterParam(event, 'fileId')

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }
  if (!fileId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const existing = await prisma.document.findFirst({ where: { id: fileId, clubId: club.id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Dokument nicht gefunden' })

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find((p) => p.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei hochgeladen' })
  }
  if (filePart.data.length > MAX_UPLOAD_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `Datei zu groß (max. ${MAX_UPLOAD_SIZE_LABEL})`,
    })
  }

  const tokens = club.oauthToken as OAuthTokens

  if (existing.driveFileId) {
    try {
      await deleteDriveFile({ tokens, fileId: existing.driveFileId })
    } catch {
      // ignore if already deleted
    }
  }

  const folderId = await ensureDocumentsFolder(club)
  const newDriveFileId = await uploadClubDocument({
    tokens,
    folderId,
    filename: filePart.filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    buffer: filePart.data,
  })

  const document = await prisma.document.update({
    where: { id: fileId },
    data: { name: filePart.filename, driveFileId: newDriveFileId },
    select: { id: true, name: true, createdAt: true },
  })

  return { document }
})
