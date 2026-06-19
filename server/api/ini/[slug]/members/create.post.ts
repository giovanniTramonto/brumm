import { sendInviteEmail } from '~/server/utils/email'
import { saveMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { createMemberSchema, formatZodError } from '~/server/utils/schemas'
import { buildStorageRef, generateStorageId } from '~/server/utils/storageRef'
import type { MemberData } from '~/types'

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
    careType,
    surcharges,
    contractEnd,
    address,
    sendInvite,
  } = parsed.data

  const storageId = generateStorageId()
  const storageRef = buildStorageRef(new Date(birthDate), firstName, lastName, storageId)

  const emails = [email1.toLowerCase(), ...(email2 ? [email2.toLowerCase()] : [])]

  const [superUserEmails, existingUserEmail] = await Promise.all([
    prisma.userEmail.findMany({ where: { userId: currentUser.id }, select: { email: true } }),
    prisma.userEmail.findFirst({ where: { email: { in: emails }, user: { clubId: club.id } } }),
  ])

  const superUserEmailSet = new Set(superUserEmails.map((e) => e.email.toLowerCase()))
  const inviteEmails = emails.filter((e) => !superUserEmailSet.has(e))
  const hasSuperUserEmail = emails.some((e) => superUserEmailSet.has(e))
  const parentAlreadyRegistered =
    !!existingUserEmail && inviteEmails.includes(existingUserEmail.email.toLowerCase())

  const willHavePendingInvite =
    !hasSuperUserEmail && sendInvite && inviteEmails.length > 0 && !parentAlreadyRegistered

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      role: 'MEMBER',
      status: willHavePendingInvite ? 'PENDING_INVITE' : 'REGISTERED',
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
    careType: careType || null,
    surcharges: surcharges ?? [],
    contractEnd: contractEnd || null,
    address: address || null,
    lastEditedAt: null,
    lastEditedBy: null,
  }

  try {
    await saveMemberData(memberData, club)
  } catch {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    throw createError({
      statusCode: 500,
      statusMessage: 'Fehler beim Speichern der Mitgliedsdaten. Bitte versuche es erneut.',
    })
  }

  let emailError: string | null = null
  const childName = `${firstName} ${lastName}`

  if (hasSuperUserEmail) {
    await prisma.invite.create({
      data: {
        clubId: club.id,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isUsed: true,
      },
    })

    if (sendInvite && inviteEmails.length > 0 && !parentAlreadyRegistered) {
      const magicLink = await prisma.magicLink.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      try {
        for (const to of inviteEmails) {
          await sendInviteEmail({
            to,
            clubName: club.name,
            clubSlug: club.slug,
            token: magicLink.token,
            childName,
          })
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Unbekannter Fehler'
      }
    }
  } else if (sendInvite && inviteEmails.length > 0 && !parentAlreadyRegistered) {
    const invite = await prisma.invite.create({
      data: {
        clubId: club.id,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    try {
      for (const to of inviteEmails) {
        await sendInviteEmail({
          to,
          clubName: club.name,
          clubSlug: club.slug,
          token: invite.token,
          childName,
        })
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Unbekannter Fehler'
    }
  }

  return { user, emailError }
})
