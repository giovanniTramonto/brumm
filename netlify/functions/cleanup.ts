import { PrismaClient } from "@prisma/client"
import { google } from "googleapis"
import { GoogleAuth } from "google-auth-library"
import type { GoogleDriveConfig } from "../../types/index"

const prisma = new PrismaClient()

function getGoogleAuth(config: GoogleDriveConfig): GoogleAuth {
  return new GoogleAuth({
    credentials: {
      client_email: config.serviceAccountEmail,
      private_key: config.serviceAccountKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  })
}

async function deleteFromDrive(config: GoogleDriveConfig, folderId: string): Promise<void> {
  const auth = getGoogleAuth(config)
  const drive = google.drive({ version: "v3", auth })
  try {
    await drive.files.delete({ fileId: folderId })
  } catch {
    // Ordner bereits gelöscht oder nicht vorhanden
  }
}

async function removeFromMasterSheet(config: GoogleDriveConfig, storageRef: string): Promise<void> {
  const auth = getGoogleAuth(config)
  const sheets = google.sheets({ version: "v4", auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.masterSheetId,
    range: "A:A",
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row) => row[0] === storageRef)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.masterSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
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
      isActive: false,
      deactivatedAt: { lte: oneYearAgo },
      storageRef: { not: null },
    },
    include: { club: true },
  })

  console.log(`DSGVO-Cleanup: ${expiredUsers.length} Mitglieder zu bereinigen`)

  for (const user of expiredUsers) {
    try {
      const storageConfig = user.club.storageConfig as unknown as GoogleDriveConfig | null

      if (storageConfig?.serviceAccountEmail && user.storageRef) {
        const auth = getGoogleAuth(storageConfig)
        const drive = google.drive({ version: "v3", auth })

        const searchResult = await drive.files.list({
          q: `name = '${user.storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${storageConfig.membersFolderId}' in parents`,
          fields: "files(id)",
        })

        const folder = searchResult.data.files?.[0]
        if (folder?.id) {
          await deleteFromDrive(storageConfig, folder.id)
        }

        await removeFromMasterSheet(storageConfig, user.storageRef)
      }

      await prisma.session.deleteMany({ where: { userId: user.id } })
      await prisma.magicLink.deleteMany({ where: { userId: user.id } })
      await prisma.invite.deleteMany({ where: { userId: user.id } })

      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: "Gelöscht",
          lastName: "Gelöscht",
          birthDate: new Date("1900-01-01"),
          guardian1Name: null,
          guardian2Name: null,
          storageRef: null,
          groupId: null,
        },
      })

      console.log(`Bereinigt: user.id=${user.id}`)
    } catch (err) {
      console.error(`Fehler bei user.id=${user.id}:`, err)
    }
  }

  await prisma.$disconnect()

  return {
    statusCode: 200,
    body: JSON.stringify({ cleaned: expiredUsers.length }),
  }
}
