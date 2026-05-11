import { prisma } from '~/server/utils/prisma'
import { uploadTemplateFile } from '~/server/utils/storage/googleDrive'
import { generateStorageId } from '~/server/utils/storageRef'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const formData = await readMultipartFormData(event)
  const namePart = formData?.find((p) => p.name === 'name')
  const typePart = formData?.find((p) => p.name === 'documentType')
  const filePart = formData?.find((p) => p.name === 'file')

  const name = namePart?.data?.toString('utf-8')?.trim()
  const documentType = typePart?.data?.toString('utf-8')?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name fehlt' })
  if (documentType !== 'read' && documentType !== 'upload') {
    throw createError({ statusCode: 400, statusMessage: 'Typ fehlt' })
  }

  const ref = generateStorageId()

  let driveFileId: string | null = null
  let driveFileName: string | null = null

  if (filePart?.data && filePart.filename && club.isSetupDone) {
    const tokens = club.oauthToken as OAuthTokens
    const storageConfig = club.storageConfig as GoogleDriveConfig
    const result = await uploadTemplateFile({
      tokens,
      appFolderId: storageConfig.appFolderId,
      ref,
      filename: filePart.filename,
      mimeType: filePart.type ?? 'application/octet-stream',
      buffer: filePart.data,
    })
    driveFileId = result.driveFileId
    driveFileName = filePart.filename
  }

  const template = await prisma.documentTemplate.create({
    data: { clubId: club.id, name, ref, documentType, driveFileId, driveFileName },
  })

  return { template }
})
