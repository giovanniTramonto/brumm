import { ensureDocumentsFolder } from '~/server/utils/clubDocuments'
import { prisma } from '~/server/utils/prisma'
import { uploadClubDocument } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '~/utils/config'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

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

  const folderId = await ensureDocumentsFolder(club)
  const tokens = club.oauthToken as OAuthTokens
  const namePart = formData?.find((p) => p.name === 'name')
  const name = namePart?.data?.toString().trim() || filePart.filename

  const driveFileId = await uploadClubDocument({
    tokens,
    folderId,
    filename: filePart.filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    buffer: filePart.data,
  })

  const count = await prisma.document.count({ where: { clubId: club.id } })
  const document = await prisma.document.create({
    data: { clubId: club.id, name, driveFileId, order: count },
    select: { id: true, name: true, order: true, createdAt: true },
  })

  return { document }
})
