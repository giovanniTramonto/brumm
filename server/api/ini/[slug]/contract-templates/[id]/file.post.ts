import { prisma } from '~/server/utils/prisma'
import { s3DeleteFile, s3UploadFile } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const templateId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find((p) => p.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei hochgeladen' })
  }

  if (template.s3Key) {
    try {
      await s3DeleteFile(club.id, template.s3Key)
    } catch {
      // ignore
    }
  }

  const result = await s3UploadFile(
    club.id,
    `contract-templates/${template.id}`,
    filePart.data,
    filePart.type ?? 'application/octet-stream',
    filePart.filename,
  )

  const updated = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: { fileName: filePart.filename, s3Key: result.key },
  })

  return { template: updated }
})
