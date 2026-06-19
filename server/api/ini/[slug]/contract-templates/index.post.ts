import { prisma } from '~/server/utils/prisma'
import { s3UploadFile } from '~/server/utils/storage/s3/files'
import { generateStorageId } from '~/server/utils/storageRef'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  const canManage =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const formData = await readMultipartFormData(event)
  const namePart = formData?.find((p) => p.name === 'name')
  const typePart = formData?.find((p) => p.name === 'documentType')
  const filePart = formData?.find((p) => p.name === 'file')

  const name = namePart?.data?.toString('utf-8')?.trim()
  const documentType = typePart?.data?.toString('utf-8')?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name fehlt' })
  if (documentType !== 'read' && documentType !== 'upload' && documentType !== 'submit') {
    throw createError({ statusCode: 400, statusMessage: 'Typ fehlt' })
  }

  const ref = generateStorageId()

  let fileName: string | null = null
  let s3Key: string | null = null

  if (filePart?.data && filePart.filename) {
    const result = await s3UploadFile(
      club.id,
      `contract-templates/${ref}`,
      filePart.data,
      filePart.type ?? 'application/octet-stream',
      filePart.filename,
    )
    s3Key = result.key
    fileName = filePart.filename
  }

  const template = await prisma.documentTemplate.create({
    data: { clubId: club.id, name, ref, documentType, fileName, s3Key },
  })

  return { template }
})
