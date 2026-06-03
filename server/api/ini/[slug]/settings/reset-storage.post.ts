import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { createMembersSheet } from '~/server/utils/storage/sheets'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const storageConfig = club.storageConfig as unknown as GoogleDriveConfig | null
  const tokens = club.oauthToken as unknown as OAuthTokens | null

  if (!storageConfig || !tokens) {
    throw createError({ statusCode: 400, statusMessage: 'Kein Storage konfiguriert' })
  }

  const drive = getDriveClientFromTokens(tokens)

  try {
    await drive.files.delete({ fileId: storageConfig.membersSheetId, supportsAllDrives: true })
  } catch {
    // Sheet already deleted or not accessible
  }

  const members = await prisma.user.findMany({
    where: { clubId: club.id, role: 'MEMBER' },
    select: { id: true },
  })
  const memberIds = members.map((m) => m.id)

  await prisma.session.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.magicLink.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.invite.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.memberDocument.deleteMany({ where: { memberId: { in: memberIds } } })
  await prisma.userEmail.deleteMany({ where: { userId: { in: memberIds } } })
  await prisma.user.deleteMany({ where: { clubId: club.id, role: 'MEMBER' } })
  await prisma.documentTemplate.deleteMany({ where: { clubId: club.id } })

  const newMembersSheetId = await createMembersSheet({
    tokens,
    memberFolderId: storageConfig.memberFolderId,
    clubName: club.name,
  })

  await prisma.club.update({
    where: { id: club.id },
    data: {
      storageConfig: { ...storageConfig, membersSheetId: newMembersSheetId } as object,
    },
  })

  return { ok: true }
})
