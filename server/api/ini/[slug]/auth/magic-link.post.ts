import { Prisma } from '@prisma/client'
import { sendMagicLink } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, magicLinkSchema } from '~/server/utils/schemas'
import { findManagerIdByEmail } from '~/server/utils/storage/managersSheet'
import { findUserIdByEmail } from '~/server/utils/storage/sheets'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

async function findOrCreateManagerUser(managerId: string, clubId: string) {
  const manager = await prisma.manager.findFirst({ where: { id: managerId, clubId } })
  if (!manager) return null

  const existing = await prisma.user.findFirst({
    where: { storageId: manager.storageId, clubId, role: 'MANAGER' },
  })
  if (existing) return existing

  return prisma.user.create({
    data: {
      clubId,
      storageId: manager.storageId,
      role: 'MANAGER',
      isActive: true,
      isMemberManager: manager.isMemberManager,
    },
  })
}

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const parsed = magicLinkSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { email } = parsed.data
  const normalizedEmail = email.toLowerCase()

  // First: check UserEmail in Neon (covers SUPERUSER and MANAGER roles)
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
    const [memberId, managerId] = await Promise.all([
      findUserIdByEmail({
        tokens,
        membersSheetId: storageConfig.membersSheetId,
        email: normalizedEmail,
      }),
      storageConfig.managersSheetId
        ? findManagerIdByEmail({
            tokens,
            managersSheetId: storageConfig.managersSheetId,
            email: normalizedEmail,
          })
        : null,
    ])

    if (memberId) {
      userId = memberId
    } else if (managerId) {
      const managerUser = await findOrCreateManagerUser(managerId, club.id)
      if (managerUser) userId = managerUser.id
    }
  } else {
    const usersWithLocalData = await prisma.user.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    const memberMatch = usersWithLocalData.find((u) => {
      const d = u.localData as Record<string, unknown> | null
      if (!d) return false
      return (
        (d.email1 as string)?.toLowerCase() === normalizedEmail ||
        (d.email2 as string)?.toLowerCase() === normalizedEmail
      )
    })

    if (memberMatch) {
      userId = memberMatch.id
    } else {
      const managers = await prisma.manager.findMany({
        where: { clubId: club.id, localData: { not: Prisma.DbNull } },
      })
      const managerMatch = managers.find((m) => {
        const d = m.localData as Record<string, unknown> | null
        return d && (d.email as string)?.toLowerCase() === normalizedEmail
      })
      if (managerMatch) {
        const managerUser = await findOrCreateManagerUser(managerMatch.id, normalizedEmail, club.id)
        if (managerUser) userId = managerUser.id
      }
    }
  }

  if (userId) {
    const userExists = await prisma.user.findFirst({ where: { id: userId, clubId: club.id } })
    if (!userExists) {
      return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
    }

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
