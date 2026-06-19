import { Prisma } from '@prisma/client'
import { getClubDbType } from '~/server/utils/clubDatabase'
import { sendMagicLink } from '~/server/utils/email'
import { createMagicLink } from '~/server/utils/magicLink'
import { findManagerIdByEmailPg } from '~/server/utils/managerData'
import { findMemberIdByEmail } from '~/server/utils/memberData'
import { hashPin } from '~/server/utils/pinHash'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, magicLinkSchema } from '~/server/utils/schemas'
import { findManagerIdByEmail } from '~/server/utils/storage/managersSheet'
import { findUserIdByEmail } from '~/server/utils/storage/sheets'
import { findTeamMemberIdByEmail } from '~/server/utils/storage/teamSheet'
import { findTeamMemberIdByEmailPg } from '~/server/utils/teamData'
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
      isMemberManager: manager.isMemberManager,
    },
  })
}

async function findTeamUser(teamId: string, clubId: string) {
  const member = await prisma.team.findFirst({ where: { id: teamId, clubId } })
  if (!member) return null
  return prisma.user.findFirst({ where: { storageId: member.storageId, clubId, role: 'TEAM' } })
}

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const parsed = magicLinkSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { email, pin } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const pendingPinHash = pin ? await hashPin(pin) : undefined

  // First: check UserEmail in Neon (covers SUPERUSER and MANAGER roles)
  const userEmail = await prisma.userEmail.findUnique({
    where: { email: normalizedEmail },
    include: { user: true },
  })

  if (userEmail && userEmail.user.clubId === club.id) {
    const magicLink = await createMagicLink({
      userId: userEmail.userId,
      pendingPinHash,
      withOtp: true,
    })
    await sendMagicLink({
      to: email,
      clubName: club.name,
      clubSlug: club.slug,
      token: magicLink.token,
      otpCode: magicLink.otpCode ?? '',
    })
    return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
  }

  // Second: search in Postgres, Sheets (setup done) or localData (setup not done)
  let userId: string | null = null

  if (club.isSetupDone && (await getClubDbType(club.id)) === 'POSTGRES') {
    const [memberId, managerId, teamId] = await Promise.all([
      findMemberIdByEmail(club.id, normalizedEmail),
      findManagerIdByEmailPg(club.id, normalizedEmail),
      findTeamMemberIdByEmailPg(club.id, normalizedEmail),
    ])

    if (managerId) {
      const managerUser = await findOrCreateManagerUser(managerId, club.id)
      if (managerUser) userId = managerUser.id
    } else if (teamId) {
      const teamUser = await findTeamUser(teamId, club.id)
      if (teamUser) userId = teamUser.id
    } else if (memberId) {
      userId = memberId
    }
  } else if (club.isSetupDone && club.storageConfig && club.oauthToken) {
    const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
    const tokens = club.oauthToken as unknown as OAuthTokens
    const [memberId, managerId, teamId] = await Promise.all([
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
      storageConfig.teamSheetId
        ? findTeamMemberIdByEmail({
            tokens,
            teamSheetId: storageConfig.teamSheetId,
            email: normalizedEmail,
          })
        : null,
    ])

    if (managerId) {
      const managerUser = await findOrCreateManagerUser(managerId, club.id)
      if (managerUser) userId = managerUser.id
    } else if (teamId) {
      const teamUser = await findTeamUser(teamId, club.id)
      if (teamUser) userId = teamUser.id
    } else if (memberId) {
      userId = memberId
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

    const managers = await prisma.manager.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    const managerMatch = managers.find((m) => {
      const d = m.localData as Record<string, unknown> | null
      return d && (d.email as string)?.toLowerCase() === normalizedEmail
    })

    if (managerMatch) {
      const managerUser = await findOrCreateManagerUser(managerMatch.id, club.id)
      if (managerUser) userId = managerUser.id
    } else if (memberMatch) {
      userId = memberMatch.id
    }
  }

  if (userId) {
    const userExists = await prisma.user.findFirst({ where: { id: userId, clubId: club.id } })
    if (!userExists) {
      return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
    }

    const magicLink = await createMagicLink({ userId, pendingPinHash, withOtp: true })
    await sendMagicLink({
      to: email,
      clubName: club.name,
      clubSlug: club.slug,
      token: magicLink.token,
      otpCode: magicLink.otpCode ?? '',
    })
  }

  return { message: 'Falls diese E-Mail bekannt ist, wurde ein Link gesendet' }
})
