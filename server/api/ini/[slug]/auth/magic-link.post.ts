import { Prisma } from '@prisma/client'
import { sendMagicLink } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, magicLinkSchema } from '~/server/utils/schemas'
import { findUserIdByEmail } from '~/server/utils/storage/sheets'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const parsed = magicLinkSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { email } = parsed.data
  const normalizedEmail = email.toLowerCase()

  // First: check UserEmail in Neon (covers SUPERUSER role)
  const userEmail = await prisma.userEmail.findUnique({
    where: { email: normalizedEmail },
    include: { user: true },
  })

  if (userEmail && userEmail.user.clubId === club.id) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const magicLink = await prisma.magicLink.create({
      data: { userId: userEmail.userId, expiresAt },
    })
    await sendMagicLink({
      to: email,
      clubName: club.name,
      clubSlug: club.slug,
      token: magicLink.token,
    })
    return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
  }

  // Second: search in Sheets (setup done) or localData (setup not done)
  let userId: string | null = null

  if (club.isSetupDone && club.storageConfig && club.oauthToken) {
    const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
    const tokens = club.oauthToken as unknown as OAuthTokens
    userId = await findUserIdByEmail({
      tokens,
      masterSheetId: storageConfig.masterSheetId,
      email: normalizedEmail,
    })
  } else {
    const usersWithLocalData = await prisma.user.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    const match = usersWithLocalData.find((u) => {
      const d = u.localData as Record<string, unknown> | null
      if (!d) return false
      return (
        (d.email1 as string)?.toLowerCase() === normalizedEmail ||
        (d.email2 as string)?.toLowerCase() === normalizedEmail
      )
    })
    userId = match?.id ?? null
  }

  if (userId) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const magicLink = await prisma.magicLink.create({
      data: { userId, expiresAt },
    })
    await sendMagicLink({
      to: email,
      clubName: club.name,
      clubSlug: club.slug,
      token: magicLink.token,
    })
  }

  return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
})
