import { checkAdminAuth } from '~/server/utils/adminAuth'
import { protectSheet } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)

  const clubs = await prisma.club.findMany({
    where: { isSetupDone: true },
    select: { id: true, name: true, oauthToken: true, storageConfig: true },
  })

  const results: { clubId: string; name: string; ok: boolean; error?: string }[] = []

  for (const club of clubs) {
    try {
      const tokens = club.oauthToken as unknown as OAuthTokens
      const config = club.storageConfig as unknown as GoogleDriveConfig

      const sheetIds = [config.membersSheetId, config.managersSheetId, config.groupsSheetId].filter(
        (id): id is string => !!id,
      )

      await Promise.all(sheetIds.map((spreadsheetId) => protectSheet({ tokens, spreadsheetId })))

      results.push({ clubId: club.id, name: club.name, ok: true })
    } catch (err) {
      results.push({
        clubId: club.id,
        name: club.name,
        ok: false,
        error: (err as { message?: string })?.message ?? 'Unbekannter Fehler',
      })
    }
  }

  return { results }
})
