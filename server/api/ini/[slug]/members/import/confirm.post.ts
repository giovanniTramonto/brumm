import { sendImportSummary } from '~/server/utils/email'
import { saveMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, importConfirmSchema } from '~/server/utils/schemas'
import { initUserStorage } from '~/server/utils/storage'
import { buildStorageRef, generateStorageId } from '~/server/utils/storageRef'
import type { GoogleDriveConfig, MemberData } from '~/types'
import type { ImportConfirmResult } from '~/types/import'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = importConfirmSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { rows } = parsed.data

  const storageConfig = club.storageConfig as unknown as GoogleDriveConfig | null
  let succeeded = 0
  let failed = 0
  const errors: Array<{ rowIndex: number; message: string }> = []

  for (const row of rows) {
    try {
      const storageId = generateStorageId()
      const storageRef = buildStorageRef(
        new Date(row.birthDate),
        row.firstName,
        row.lastName,
        storageId,
      )

      const user = await prisma.user.create({
        data: {
          clubId: club.id,
          role: 'MEMBER',
          isActive: true,
          storageId,
        },
      })

      const memberData: MemberData = {
        userId: user.id,
        storageRef,
        firstName: row.firstName,
        lastName: row.lastName,
        birthDate: row.birthDate,
        guardian1Name: row.guardian1Name || null,
        guardian2Name: row.guardian2Name || null,
        email1: row.email1.toLowerCase(),
        email2: row.email2 ? row.email2.toLowerCase() : null,
        groupId: row.groupId || null,
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
      }

      await saveMemberData(memberData, club)

      if (club.isSetupDone && storageConfig) {
        await initUserStorage({ memberData, storageConfig })
      }

      succeeded++
    } catch (err) {
      failed++
      errors.push({
        rowIndex: row.rowIndex,
        message: err instanceof Error ? err.message : 'Unbekannter Fehler',
      })
    }
  }

  const superusers = await prisma.user.findMany({
    where: { clubId: club.id, role: 'SUPERUSER' },
    include: { emails: true },
  })
  const superuserEmails = superusers.flatMap((su) => su.emails.map((e) => e.email))

  await sendImportSummary({
    to: superuserEmails,
    clubName: club.name,
    succeeded,
    failed,
    total: rows.length,
  })

  const result: ImportConfirmResult = { succeeded, failed, errors }
  return result
})
