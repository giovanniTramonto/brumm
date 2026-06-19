import { sendMagicLink } from '~/server/utils/email'
import { createMagicLink } from '~/server/utils/magicLink'
import { findManagerIdByEmailPg } from '~/server/utils/managerData'
import { findMemberIdByEmail } from '~/server/utils/memberData'
import { hashPin } from '~/server/utils/pinHash'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, magicLinkSchema } from '~/server/utils/schemas'
import { findTeamMemberIdByEmailPg } from '~/server/utils/teamData'

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

  // First: check UserEmail in Neon (covers SUPERUSER)
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

  // Second: search in Postgres
  let userId: string | null = null

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
