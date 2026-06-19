import { getMemberData } from '~/server/utils/memberData'
import { getClubStorageType } from '~/server/utils/s3Client'
import { listMemberDocuments } from '~/server/utils/storage/googleDrive'
import { s3ListFiles } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canViewAll =
    currentUser.role === 'SUPERUSER' ||
    currentUser.role === 'TEAM' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

  const md = await getMemberData(memberId, club)
  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  if (!canViewAll) {
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

  if (!club.isSetupDone) {
    return { documents: [] }
  }

  if ((await getClubStorageType(club.id)) === 'S3') {
    const documents = await s3ListFiles(club.id, `members/${memberId}/contract`)
    return { documents }
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig

  const documents = await listMemberDocuments({
    tokens,
    membersFolderId: storageConfig.membersFolderId,
    storageRef: md.storageRef,
  })

  return { documents }
})
