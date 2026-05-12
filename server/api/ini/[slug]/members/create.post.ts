import { sendInviteEmail } from '~/server/utils/email'
import { saveMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { createMemberSchema, formatZodError } from '~/server/utils/schemas'
import { initUserStorage } from '~/server/utils/storage'
import { buildStorageRef, generateStorageId } from '~/server/utils/storageRef'
import type { GoogleDriveConfig, MemberData, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = createMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const {
    firstName,
    lastName,
    birthDate,
    guardian1Name,
    guardian2Name,
    email1,
    email2,
    phone1,
    phone2,
    groupId,
    contractEnd,
  } = parsed.data

  const storageId = generateStorageId()
  const storageRef = buildStorageRef(new Date(birthDate), firstName, lastName, storageId)

  const emails = [email1.toLowerCase(), ...(email2 ? [email2.toLowerCase()] : [])]

  const [superUserEmails, existingUserEmail] = await Promise.all([
    prisma.userEmail.findMany({ where: { userId: currentUser.id }, select: { email: true } }),
    prisma.userEmail.findFirst({ where: { email: { in: emails }, user: { clubId: club.id } } }),
  ])

  const superUserEmailSet = new Set(superUserEmails.map((e) => e.email.toLowerCase()))
  const isSuperUserChild = emails.some((e) => superUserEmailSet.has(e))
  const parentAlreadyRegistered = !!existingUserEmail

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      role: 'MEMBER',
      isActive: isSuperUserChild,
      storageId,
    },
  })

  const memberData: MemberData = {
    userId: user.id,
    storageRef,
    firstName,
    lastName,
    birthDate,
    guardian1Name: guardian1Name ?? null,
    guardian2Name: guardian2Name ?? null,
    email1: email1.toLowerCase(),
    email2: email2 ? email2.toLowerCase() : null,
    phone1: phone1 || null,
    phone2: phone2 || null,
    groupId: groupId ?? null,
    isActive: isSuperUserChild,
    deactivatedAt: null,
    deactivatedBy: null,
    contractEnd: contractEnd || null,
  }

  await saveMemberData(memberData, club)

  if (club.isSetupDone && club.storageConfig && club.oauthToken) {
    try {
      const tokens = club.oauthToken as unknown as OAuthTokens
      await initUserStorage({
        memberData,
        storageConfig: club.storageConfig as unknown as GoogleDriveConfig,
        tokens,
      })
    } catch (err) {
      console.error('Storage-Initialisierung fehlgeschlagen:', err)
    }
  }

  if (!isSuperUserChild && !parentAlreadyRegistered) {
    const invite = await prisma.invite.create({
      data: {
        clubId: club.id,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const childName = `${firstName} ${lastName}`
    await sendInviteEmail({
      to: email1,
      clubName: club.name,
      clubSlug: club.slug,
      token: invite.token,
      childName,
    })
    if (email2) {
      await sendInviteEmail({
        to: email2,
        clubName: club.name,
        clubSlug: club.slug,
        token: invite.token,
        childName,
      })
    }
  }

  return { user }
})
