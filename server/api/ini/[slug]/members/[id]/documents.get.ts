import { s3ListFiles } from '~/server/utils/storage/s3/files'

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

  if (!canViewAll) {
    const { getMemberData } = await import('~/server/utils/memberData')
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

  const documents = await s3ListFiles(club.id, `members/${memberId}/contract`)
  return { documents }
})
