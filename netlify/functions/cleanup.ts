import { Prisma, PrismaClient } from '@prisma/client'
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
    await drive.files.delete({ fileId: folderId })
  } catch {
    // Ordner bereits gelöscht oder nicht vorhanden
  }
}

async function removeFromMasterSheet(
  tokens: OAuthTokens,
  masterSheetId: string,
  storageRef: string,
): Promise<void> {
  const auth = getGoogleAuth(tokens)
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: masterSheetId,
    range: 'B:B',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row) => row[0] === storageRef)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: masterSheetId,
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

type LocalData = {
  storageRef?: string
  deactivatedAt?: string
  [key: string]: unknown
}

export default async function handler() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const inactiveUsers = await prisma.user.findMany({
    where: {
      isActive: false,
      storageId: { not: null },
    },
    include: { club: true },
  })

  const expiredLocalUsers = inactiveUsers.filter((user) => {
    const d = user.localData as LocalData | null
    if (!d?.deactivatedAt) return false
    return new Date(d.deactivatedAt) <= oneYearAgo
  })

  console.log(`DSGVO-Cleanup (localData): ${expiredLocalUsers.length} Mitglieder zu bereinigen`)

  for (const user of expiredLocalUsers) {
    try {
      const storageConfig = user.club.storageConfig as unknown as GoogleDriveConfig | null
      const oauthToken = user.club.oauthToken as unknown as OAuthTokens | null
      const localData = user.localData as LocalData | null
      const storageRef = localData?.storageRef ?? null

      if (storageConfig && oauthToken && storageRef) {
        const drive = google.drive({ version: 'v3', auth: getGoogleAuth(oauthToken) })

        const searchResult = await drive.files.list({
          q: `name = '${storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${storageConfig.membersFolderId}' in parents`,
          fields: 'files(id)',
        })

        const folder = searchResult.data.files?.[0]
        if (folder?.id) {
          await deleteFromDrive(oauthToken, folder.id)
        }

        await removeFromMasterSheet(oauthToken, storageConfig.masterSheetId, storageRef)
      }

      await prisma.session.deleteMany({ where: { userId: user.id } })
      await prisma.magicLink.deleteMany({ where: { userId: user.id } })
      await prisma.invite.deleteMany({ where: { userId: user.id } })

      await prisma.user.update({
        where: { id: user.id },
        data: {
          localData: Prisma.DbNull,
          storageId: null,
        },
      })

      console.log(`Bereinigt: user.id=${user.id}`)
    } catch (err) {
      console.error(`Fehler bei user.id=${user.id}:`, err)
    }
  }

  const clubs = await prisma.club.findMany({
    where: {
      isSetupDone: true,
      storageConfig: { not: Prisma.DbNull },
      oauthToken: { not: Prisma.DbNull },
    },
  })

  let sheetCleaned = 0

  for (const club of clubs) {
    try {
      const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
      const oauthToken = club.oauthToken as unknown as OAuthTokens
      const auth = getGoogleAuth(oauthToken)
      const sheets = google.sheets({ version: 'v4', auth })

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: storageConfig.masterSheetId,
        range: 'A:M',
      })

      const rows = response.data.values ?? []
      for (const row of rows.slice(1)) {
        const userId = row[0] as string
        const storageRef = row[1] as string
        const isActiveStr = row[10] as string
        const deactivatedAtStr = row[11] as string

        if (isActiveStr === 'true') continue
        if (!deactivatedAtStr) continue

        const deactivatedAt = new Date(deactivatedAtStr)
        if (deactivatedAt > oneYearAgo) continue

        const user = await prisma.user.findFirst({
          where: { id: userId, clubId: club.id },
        })
        if (!user) continue

        if (storageRef) {
          const drive = google.drive({ version: 'v3', auth })
          const searchResult = await drive.files.list({
            q: `name = '${storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${storageConfig.membersFolderId}' in parents`,
            fields: 'files(id)',
          })
          const folder = searchResult.data.files?.[0]
          if (folder?.id) {
            await deleteFromDrive(oauthToken, folder.id)
          }
          await removeFromMasterSheet(oauthToken, storageConfig.masterSheetId, storageRef)
        }

        await prisma.session.deleteMany({ where: { userId } })
        await prisma.magicLink.deleteMany({ where: { userId } })
        await prisma.invite.deleteMany({ where: { userId } })

        await prisma.user.update({
          where: { id: userId },
          data: { storageId: null },
        })

        sheetCleaned++
        console.log(`Bereinigt (Sheet): user.id=${userId}`)
      }
    } catch (err) {
      console.error(`Fehler bei club.id=${club.id}:`, err)
    }
  }

  console.log(`DSGVO-Cleanup (Sheet): ${sheetCleaned} Mitglieder bereinigt`)

  await prisma.$disconnect()

  return {
    statusCode: 200,
    body: JSON.stringify({ cleaned: expiredLocalUsers.length + sheetCleaned }),
  }
}
