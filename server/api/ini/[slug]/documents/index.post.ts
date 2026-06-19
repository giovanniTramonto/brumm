import { ensureDocumentsFolder } from '~/server/utils/clubDocuments'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import { uploadClubDocument } from '~/server/utils/storage/googleDrive'
import { s3UploadFile } from '~/server/utils/storage/s3/files'
import type { OAuthTokens } from '~/types'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '~/utils/config'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const contentType = getHeader(event, 'content-type') ?? ''
  const count = await prisma.document.count({ where: { clubId: club.id } })

  if (!contentType.includes('multipart/form-data')) {
    const body = await readBody<{ name: string; url: string }>(event)
    if (!body.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'Name fehlt' })
    if (!body.url?.trim()) throw createError({ statusCode: 400, statusMessage: 'URL fehlt' })

    const document = await prisma.document.create({
      data: {
        clubId: club.id,
        name: body.name.trim(),
        type: 'link',
        url: body.url.trim(),
        order: count,
      },
      select: { id: true, name: true, order: true, type: true, url: true, createdAt: true },
    })
    return { document }
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

  const namePart = formData?.find((p) => p.name === 'name')
  const name = namePart?.data?.toString().trim() || filePart.filename

  let s3Key: string | null = null

  if ((await getClubStorageType(club.id)) === 'S3') {
    const result = await s3UploadFile(
      club.id,
      'documents',
      filePart.data,
      filePart.type ?? 'application/octet-stream',
      filePart.filename,
    )
    s3Key = result.key
  } else {
    const folderId = await ensureDocumentsFolder(club)
    const tokens = club.oauthToken as OAuthTokens
    await uploadClubDocument({
      tokens,
      folderId,
      filename: filePart.filename,
      mimeType: filePart.type ?? 'application/octet-stream',
      buffer: filePart.data,
    })
  }

  const document = await prisma.document.create({
    data: { clubId: club.id, name, fileName: filePart.filename, s3Key, order: count },
    select: { id: true, name: true, order: true, type: true, url: true, createdAt: true },
  })

  return { document }
})
