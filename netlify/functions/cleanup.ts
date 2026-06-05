import { PrismaClient } from '@prisma/client'
import { google } from 'googleapis'
import type { GoogleDriveConfig, OAuthTokens } from '../../types/index'

const prisma = new PrismaClient()

function getGoogleAuth(tokens: OAuthTokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials(tokens)
  return auth
}

async function deleteFromDrive(tokens: OAuthTokens, folderId: string): Promise<void> {
  const auth = getGoogleAuth(tokens)
  const drive = google.drive({ version: 'v3', auth })
  try {
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true })
  } catch {
    // Ordner bereits gelöscht oder nicht vorhanden
  }
}

async function findAndDeleteMemberFolder(
  tokens: OAuthTokens,
  membersFolderId: string,
  storageId: string,
): Promise<void> {
  const auth = getGoogleAuth(tokens)
  const drive = google.drive({ version: 'v3', auth })
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name contains '${storageId}' and mimeType = 'application/vnd.google-apps.folder' and '${membersFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  const folder = result.data.files?.[0]
  if (folder?.id) {
    await deleteFromDrive(tokens, folder.id)
  }
}

async function removeMemberFromSheet(
  tokens: OAuthTokens,
  membersSheetId: string,
  userId: string,
): Promise<void> {
  const auth = getGoogleAuth(tokens)
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: membersSheetId,
    range: 'A:A',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row) => row[0] === userId)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: membersSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  })
}

export default async function handler() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const expiredUsers = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'DEACTIVATED',
      deactivatedAt: { lte: oneYearAgo },
    },
    include: { club: true },
  })

  console.log(`DSGVO-Cleanup: ${expiredUsers.length} Mitglieder zu bereinigen`)

  let cleaned = 0

  for (const user of expiredUsers) {
    try {
      const storageConfig = user.club.storageConfig as unknown as GoogleDriveConfig | null
      const oauthToken = user.club.oauthToken as unknown as OAuthTokens | null

      if (storageConfig && oauthToken && user.storageId) {
        await findAndDeleteMemberFolder(oauthToken, storageConfig.membersFolderId, user.storageId)
        await removeMemberFromSheet(oauthToken, storageConfig.membersSheetId, user.id)
      }

      await prisma.session.deleteMany({ where: { userId: user.id } })
      await prisma.magicLink.deleteMany({ where: { userId: user.id } })
      await prisma.invite.deleteMany({ where: { userId: user.id } })
      await prisma.memberDocument.deleteMany({ where: { memberId: user.id } })
      await prisma.userEmail.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })

      cleaned++
      console.log(`Bereinigt: user.id=${user.id}`)
    } catch (err) {
      console.error(`Fehler bei user.id=${user.id}:`, err)
    }
  }

  console.log(`DSGVO-Cleanup: ${cleaned} Mitglieder bereinigt`)

  const deletedDeviceSessions = await prisma.deviceSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  console.log(`Cleanup: ${deletedDeviceSessions.count} abgelaufene DeviceSessions gelöscht`)

  await prisma.$disconnect()

  return {
    statusCode: 200,
    body: JSON.stringify({ cleaned }),
  }
}
