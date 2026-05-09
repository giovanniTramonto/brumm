import { sendInviteEmail } from '~/server/utils/email'
import { saveMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { createMemberSchema, formatZodError } from '~/server/utils/schemas'
import { initUserStorage } from '~/server/utils/storage'
import { findUserIdByEmail } from '~/server/utils/storage/sheets'
import { buildStorageRef, generateStorageId } from '~/server/utils/storageRef'
import type { GoogleDriveConfig, MemberData } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = createMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { firstName, lastName, birthDate, guardian1Name, guardian2Name, email1, email2, groupId } =
    parsed.data

  // Check email uniqueness: SUPERUSER emails in Neon, member emails in Sheets/localData
  const existingNeonEmail = await prisma.userEmail.findUnique({
    where: { email: email1.toLowerCase() },
  })
  if (existingNeonEmail) {
    throw createError({ statusCode: 409, statusMessage: 'E-Mail-Adresse bereits registriert' })
  }

  if (email2) {
    const existingNeonEmail2 = await prisma.userEmail.findUnique({
      where: { email: email2.toLowerCase() },
    })
    if (existingNeonEmail2) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Zweite E-Mail-Adresse bereits registriert',
      })
    }
  }

  // Check email uniqueness in Sheets if setup is done
  if (club.isSetupDone && club.storageConfig) {
    const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
    const credentials = {
      serviceAccountEmail: storageConfig.serviceAccountEmail,
      serviceAccountKey: storageConfig.serviceAccountKey,
    }
    const existingUserId = await findUserIdByEmail({
      credentials,
      masterSheetId: storageConfig.masterSheetId,
      email: email1.toLowerCase(),
    })
    if (existingUserId) {
      throw createError({ statusCode: 409, statusMessage: 'E-Mail-Adresse bereits registriert' })
    }
  }

  const storageId = generateStorageId()
  const storageRef = buildStorageRef(new Date(birthDate), firstName, lastName, storageId)

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      role: 'MEMBER',
      isActive: false,
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
    groupId: groupId ?? null,
    isActive: false,
    deactivatedAt: null,
    deactivatedBy: null,
  }

  await saveMemberData(memberData, club)

  const invite = await prisma.invite.create({
    data: {
      clubId: club.id,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  if (club.isSetupDone && club.storageConfig) {
    try {
      await initUserStorage({
        memberData,
        storageConfig: club.storageConfig as unknown as GoogleDriveConfig,
      })
    } catch (err) {
      console.error('Storage-Initialisierung fehlgeschlagen:', err)
    }
  }

  await sendInviteEmail({
    to: email1,
    clubName: club.name,
    clubSlug: club.slug,
    token: invite.token,
    childName: `${firstName} ${lastName}`,
  })

  if (email2) {
    await sendInviteEmail({
      to: email2,
      clubName: club.name,
      clubSlug: club.slug,
      token: invite.token,
      childName: `${firstName} ${lastName}`,
    })
  }

  return { user }
})
