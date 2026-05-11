import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { uploadMemberDocument } from '~/server/utils/storage/googleDrive'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const templateId = getRouterParam(event, 'templateId')

  if (!memberId || !templateId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

  const canUploadAll = currentUser.role === 'SUPERUSER' || currentUser.role === 'TEAM'

  if (!canUploadAll) {
    const member = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
    const md = await getMemberData(memberId, club)
    const ownMd = await getMemberData(currentUser.id, club)
    const ownEmails = [ownMd?.email1, ownMd?.email2].filter((e): e is string => !!e).map((e) => e.toLowerCase())
    const isGuardian =
      currentUser.id === memberId ||
      (md?.email1 && ownEmails.includes(md.email1.toLowerCase())) ||
      (md?.email2 && ownEmails.includes(md.email2.toLowerCase()))
    if (!isGuardian) {
      throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
    }
    if (member?.isActive || md?.deactivatedAt) {
      throw createError({ statusCode: 403, statusMessage: 'Upload nur für Kinder mit Status Bestätigt möglich' })
    }
  }

  const template = await prisma.documentTemplate.findFirst({ where: { id: templateId, clubId: club.id } })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find((p) => p.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei hochgeladen' })
  }

  const md = await getMemberData(memberId, club)
  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig

  const existing = await prisma.memberDocument.findUnique({ where: { memberId_templateId: { memberId, templateId } } })
  if (existing) {
    try {
      const drive = (await import('~/server/utils/googleAuth')).getDriveClientFromTokens(tokens)
      await drive.files.delete({ fileId: existing.driveFileId, supportsAllDrives: true })
    } catch {
      // ignore if already deleted
    }
  }

  const uploaded = await uploadMemberDocument({
    tokens,
    membersFolderId: storageConfig.membersFolderId,
    storageRef: md.storageRef,
    filename: filePart.filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    buffer: filePart.data,
  })

  const submission = await prisma.memberDocument.upsert({
    where: { memberId_templateId: { memberId, templateId } },
    create: { memberId, templateId, driveFileId: uploaded.id, filename: filePart.filename },
    update: { driveFileId: uploaded.id, filename: filePart.filename, uploadedAt: new Date() },
  })

  return { submission }
})
