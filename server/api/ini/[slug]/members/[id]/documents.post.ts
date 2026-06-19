import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { s3UploadFile } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const member = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const md = await getMemberData(memberId, club)
  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const canUploadAll =
    currentUser.role === 'SUPERUSER' ||
    currentUser.role === 'TEAM' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)

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
    if (
      member.status === 'ACTIVE' ||
      member.status === 'INACTIVE' ||
      member.status === 'DEACTIVATED'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Upload nur für Kinder mit Status Bestätigt möglich',
      })
    }
  }

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find((p) => p.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei hochgeladen' })
  }

  const result = await s3UploadFile(
    club.id,
    `members/${memberId}/contract`,
    filePart.data,
    filePart.type ?? 'application/octet-stream',
    filePart.filename,
  )
  return { document: { id: result.fileId, name: filePart.filename } }
})
