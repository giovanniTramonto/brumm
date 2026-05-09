import { prisma } from "~/server/utils/prisma"
import { generateStorageRef } from "~/server/utils/storageRef"
import { initUserStorage } from "~/server/utils/storage"
import { sendInviteEmail } from "~/server/utils/email"
import { createMemberSchema, formatZodError } from "~/server/utils/schemas"
import type { GoogleDriveConfig, UserWithDateStrings } from "~/types"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== "SUPERUSER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  const parsed = createMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { firstName, lastName, birthDate, guardian1Name, guardian2Name, email1, email2, groupId } =
    parsed.data

  const existingEmail = await prisma.userEmail.findUnique({
    where: { email: email1.toLowerCase() },
  })
  if (existingEmail) {
    throw createError({ statusCode: 409, statusMessage: "E-Mail-Adresse bereits registriert" })
  }

  if (email2) {
    const existingEmail2 = await prisma.userEmail.findUnique({
      where: { email: email2.toLowerCase() },
    })
    if (existingEmail2) {
      throw createError({
        statusCode: 409,
        statusMessage: "Zweite E-Mail-Adresse bereits registriert",
      })
    }
  }

  const storageRef = generateStorageRef(new Date(birthDate), firstName, lastName)

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      firstName,
      lastName,
      birthDate: new Date(birthDate),
      guardian1Name,
      guardian2Name,
      groupId: groupId ?? null,
      storageRef,
      emails: {
        create: [
          { email: email1.toLowerCase(), isPrimary: true },
          ...(email2 ? [{ email: email2.toLowerCase(), isPrimary: false }] : []),
        ],
      },
    },
    include: { emails: true },
  })

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
        user: { ...user, birthDate: user.birthDate.toISOString() } as unknown as UserWithDateStrings,
        storageConfig: club.storageConfig as unknown as GoogleDriveConfig,
        emails: user.emails,
      })
    } catch (err) {
      console.error("Storage-Initialisierung fehlgeschlagen:", err)
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
