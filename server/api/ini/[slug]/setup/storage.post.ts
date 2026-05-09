import { prisma } from '~/server/utils/prisma'
import { formatZodError, storageSetupSchema } from '~/server/utils/schemas'
import { setupClubStorage } from '~/server/utils/storage/setupClubStorage'
import { writeMemberToSheet } from '~/server/utils/storage/sheets'
import type { MemberData } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (club.isSetupDone) {
    throw createError({ statusCode: 409, statusMessage: 'Storage bereits eingerichtet' })
  }

  const parsed = storageSetupSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  if (parsed.data.managed === true) {
    await prisma.club.update({
      where: { id: club.id },
      data: { isSetupRequested: true },
    })
    return { managed: true }
  }

  const { serviceAccountEmail, serviceAccountKey } = parsed.data

  const storageConfig = await setupClubStorage({
    clubId: club.id,
    clubName: club.name,
    credentials: { serviceAccountEmail, serviceAccountKey },
  })

  // Migrate localData from Neon users to the newly created master sheet
  const usersWithLocalData = await prisma.user.findMany({
    where: { clubId: club.id, localData: { not: null } },
  })

  if (usersWithLocalData.length > 0) {
    const credentials = {
      serviceAccountEmail: storageConfig.serviceAccountEmail,
      serviceAccountKey: storageConfig.serviceAccountKey,
    }

    for (const user of usersWithLocalData) {
      try {
        const d = user.localData as Record<string, unknown>
        const memberData: MemberData = {
          userId: user.id,
          storageRef: (d.storageRef as string) ?? '',
          firstName: (d.firstName as string) ?? '',
          lastName: (d.lastName as string) ?? '',
          birthDate: (d.birthDate as string) ?? '',
          guardian1Name: (d.guardian1Name as string | null) ?? null,
          guardian2Name: (d.guardian2Name as string | null) ?? null,
          email1: (d.email1 as string) ?? '',
          email2: (d.email2 as string | null) ?? null,
          groupId: (d.groupId as string | null) ?? null,
          isActive: user.isActive,
          deactivatedAt: (d.deactivatedAt as string | null) ?? null,
          deactivatedBy: (d.deactivatedBy as string | null) ?? null,
        }

        await writeMemberToSheet({
          credentials,
          masterSheetId: storageConfig.masterSheetId,
          data: memberData,
        })

        await prisma.user.update({
          where: { id: user.id },
          data: { localData: null },
        })
      } catch (err) {
        console.error(`Migration fehlgeschlagen für user.id=${user.id}:`, err)
      }
    }
  }

  return { storageConfig: { ...storageConfig, serviceAccountKey: '[versteckt]' } }
})
