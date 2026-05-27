import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { findUserIdByEmail } from '~/server/utils/storage/sheets'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body?.email as string | undefined)?.toLowerCase()?.trim()
  if (!email) throw createError({ statusCode: 400, statusMessage: 'E-Mail fehlt' })

  const found = new Map<string, { name: string; slug: string }>()

  // 1. UserEmail in Neon (SUPERUSER / MANAGER)
  const userEmails = await prisma.userEmail.findMany({
    where: { email },
    include: { user: { include: { club: true } } },
  })
  for (const ue of userEmails) {
    const { slug, name } = ue.user.club
    found.set(slug, { slug, name })
  }

  // 2. localData in Neon (MEMBER dev-fallback)
  const localUsers = await prisma.user.findMany({
    where: { localData: { not: Prisma.DbNull } },
    include: { club: true },
  })
  for (const u of localUsers) {
    const d = u.localData as Record<string, unknown> | null
    if (!d) continue
    if (
      (d.email1 as string)?.toLowerCase() === email ||
      (d.email2 as string)?.toLowerCase() === email
    ) {
      const { slug, name } = u.club
      found.set(slug, { slug, name })
    }
  }

  // 3. Sheets-Suche (MEMBER, setup done) – alle Clubs parallel
  const setupClubs = await prisma.club.findMany({
    where: {
      isSetupDone: true,
      oauthToken: { not: Prisma.DbNull },
      storageConfig: { not: Prisma.DbNull },
    },
  })

  await Promise.allSettled(
    setupClubs
      .filter((c) => !found.has(c.slug))
      .map(async (club) => {
        try {
          const tokens = club.oauthToken as unknown as OAuthTokens
          const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
          const userId = await findUserIdByEmail({
            tokens,
            membersSheetId: storageConfig.membersSheetId,
            email,
          })
          if (userId) found.set(club.slug, { slug: club.slug, name: club.name })
        } catch {
          // ignore per-club errors
        }
      }),
  )

  return { clubs: [...found.values()] }
})
