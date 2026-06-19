import { prisma } from '~/server/utils/prisma'
import { s3DeleteFile, s3UploadFile } from '~/server/utils/storage/s3/files'
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

  if (existing.type === 'link') {
    const body = await readBody<{ name?: string; url?: string }>(event)
    const document = await prisma.document.update({
      where: { id: fileId },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.url && { url: body.url.trim() }),
      },
      select: { id: true, name: true, order: true, type: true, url: true, createdAt: true },
    })
    return { document }
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

  if (existing.s3Key) {
    try {
      await s3DeleteFile(club.id, existing.s3Key)
    } catch {
      // ignore if already deleted
    }
  }

  const result = await s3UploadFile(
    club.id,
    'documents',
    filePart.data,
    filePart.type ?? 'application/octet-stream',
    filePart.filename,
  )

  const document = await prisma.document.update({
    where: { id: fileId },
    data: { name: filePart.filename, fileName: filePart.filename, s3Key: result.key },
    select: { id: true, name: true, order: true, type: true, url: true, createdAt: true },
  })

  return { document }
})
