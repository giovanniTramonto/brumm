import { prisma } from "~/server/utils/prisma"
import { generateStorageRef } from "~/server/utils/storageRef"
import { initUserStorage } from "~/server/utils/storage"
import { sendImportSummary } from "~/server/utils/email"
import { importConfirmSchema, formatZodError } from "~/server/utils/schemas"
import type { ImportConfirmResult } from "~/types/import"
import type { GoogleDriveConfig, UserWithDateStrings } from "~/types"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== "SUPERUSER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
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
      const storageRef = generateStorageRef(new Date(row.birthDate), row.firstName, row.lastName)

      const user = await prisma.user.create({
        data: {
          clubId: club.id,
          firstName: row.firstName,
          lastName: row.lastName,
          birthDate: new Date(row.birthDate),
          guardian1Name: row.guardian1Name || null,
          guardian2Name: row.guardian2Name || null,
          groupId: row.groupId || null,
          storageRef,
          isActive: true,
          emails: {
            create: [
              { email: row.email1.toLowerCase(), isPrimary: true },
              ...(row.email2 ? [{ email: row.email2.toLowerCase(), isPrimary: false }] : []),
            ],
          },
        },
        include: { emails: true },
      })

      if (club.isSetupDone && storageConfig) {
        await initUserStorage({
          user: { ...user, birthDate: user.birthDate.toISOString() } as unknown as UserWithDateStrings,
          storageConfig,
          emails: user.emails,
        })
      }

      succeeded++
    } catch (err) {
      failed++
      errors.push({
        rowIndex: row.rowIndex,
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      })
    }
  }

  const superusers = await prisma.user.findMany({
    where: { clubId: club.id, role: "SUPERUSER" },
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
