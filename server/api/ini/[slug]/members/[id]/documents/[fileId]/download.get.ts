import { getMemberData } from '~/server/utils/memberData'
import { getClubStorageType } from '~/server/utils/s3Client'
import { downloadDriveFile } from '~/server/utils/storage/googleDrive'
import { decodeS3FileId, s3GetPresignedUrl } from '~/server/utils/storage/s3/files'
import type { OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const fileId = getRouterParam(event, 'fileId')

  if (!memberId || !fileId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canViewAll =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  if (!canViewAll) {
    const md = await getMemberData(memberId, club)
    const ownMd = await getMemberData(currentUser.id, club)
    const ownEmails = [ownMd?.email1?.toLowerCase(), ownMd?.email2?.toLowerCase()].filter(Boolean)
    const isGuardian =
      (md?.email1 && ownEmails.includes(md.email1.toLowerCase())) ||
      (md?.email2 && ownEmails.includes(md.email2.toLowerCase())) ||
      currentUser.id === memberId
    if (!isGuardian) {
      throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
    }
  }

  if ((await getClubStorageType(club.id)) === 'S3') {
    const url = await s3GetPresignedUrl(club.id, decodeS3FileId(fileId))
    return sendRedirect(event, url, 302)
  }

  const tokens = club.oauthToken as OAuthTokens
  const { buffer, filename, mimeType } = await downloadDriveFile({ tokens, fileId })

  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return buffer
})
