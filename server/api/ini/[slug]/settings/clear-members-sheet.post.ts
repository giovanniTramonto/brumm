import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { createMembersSheet } from '~/server/utils/storage/sheets'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const storageConfig = club.storageConfig as unknown as GoogleDriveConfig | null
  const tokens = club.oauthToken as unknown as OAuthTokens | null

  if (!storageConfig || !tokens) {
    throw createError({ statusCode: 400, statusMessage: 'Kein Storage konfiguriert' })
  }

  const drive = getDriveClientFromTokens(tokens)

  // 1. Alten members-Ordner löschen (inkl. Sheet + Kind-Ordner)
  try {
    await drive.files.delete({ fileId: storageConfig.memberFolderId, supportsAllDrives: true })
  } catch {
    // Ordner bereits gelöscht oder nicht vorhanden
  }

  // 2. Neuen members-Ordner unter rootFolderId anlegen
  const newFolder = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'members',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [storageConfig.rootFolderId],
    },
    fields: 'id',
  })
  const newMemberFolderId = newFolder.data.id
  if (!newMemberFolderId) {
    throw createError({ statusCode: 500, statusMessage: 'Ordner konnte nicht erstellt werden' })
  }

  // 3. Neues members-Sheet im neuen Ordner anlegen
  const newMembersSheetId = await createMembersSheet({
    tokens,
    memberFolderId: newMemberFolderId,
    clubName: club.name,
  })

  // 4. storageConfig in Neon aktualisieren
  await prisma.club.update({
    where: { id: club.id },
    data: {
      storageConfig: {
        ...storageConfig,
        memberFolderId: newMemberFolderId,
        membersSheetId: newMembersSheetId,
      } as object,
    },
  })

  // 5. Alle MEMBER-Daten aus Neon löschen
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

  return { ok: true }
})
