import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import { uploadOtherDocument } from '~/server/utils/storage/googleDrive'
import { s3UploadFile } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '~/utils/config'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

  const canUploadAll =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  const [member, md] = await Promise.all([
    prisma.user.findFirst({ where: { id: memberId, clubId: club.id } }),
    getMemberData(memberId, club),
  ])

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }
  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }
  if (member.status !== 'ACTIVE' && member.status !== 'INACTIVE') {
    throw createError({ statusCode: 403, statusMessage: 'Nur für aktive Mitglieder verfügbar' })
  }

  if (!canUploadAll) {
    const ownMd = await getMemberData(currentUser.id, club)
    const ownEmails = [ownMd?.email1?.toLowerCase(), ownMd?.email2?.toLowerCase()].filter(Boolean)
    const isGuardian =
      (md.email1 && ownEmails.includes(md.email1.toLowerCase())) ||
      (md.email2 && ownEmails.includes(md.email2.toLowerCase())) ||
      currentUser.id === memberId
    if (!isGuardian) {
      throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
    }
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

  if ((await getClubStorageType(club.id)) === 'S3') {
    const result = await s3UploadFile(
      club.id,
      `members/${memberId}/other`,
      filePart.data,
      filePart.type ?? 'application/octet-stream',
      filePart.filename,
    )
    return { document: { id: result.fileId, name: filePart.filename } }
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig

  const uploaded = await uploadOtherDocument({
    tokens,
    membersFolderId: storageConfig.membersFolderId,
    storageRef: md.storageRef,
    filename: filePart.filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    buffer: filePart.data,
  })

  return { document: uploaded }
})
