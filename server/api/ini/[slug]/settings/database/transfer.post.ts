import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const record = await prisma.clubDatabase.findUnique({ where: { clubId: club.id } })
  if (
    !record ||
    (!record.pendingEncryptedDsn && !(record.type === 'POSTGRES' && record.encryptedDsn))
  ) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Zuerst eine Postgres-Datenbank konfigurieren.',
    })
  }

  const isPostgresToPostgres = record.type === 'POSTGRES' && !!record.pendingEncryptedDsn

  // Check no transfer is already running
  const running = await prisma.auditLog.findFirst({
    where: { clubId: club.id, event: 'DB_TRANSFER_STARTED' },
    orderBy: { createdAt: 'desc' },
  })
  const completed = await prisma.auditLog.findFirst({
    where: { clubId: club.id, event: { in: ['DB_TRANSFER_DONE', 'DB_TRANSFER_FAILED'] } },
    orderBy: { createdAt: 'desc' },
  })
  const isRunning = running && (!completed || running.createdAt > completed.createdAt)

  if (isRunning) {
    throw createError({ statusCode: 409, statusMessage: 'Ein Transfer läuft bereits.' })
  }

  await prisma.auditLog.create({
    data: { clubId: club.id, event: 'DB_TRANSFER_STARTED', severity: 'INFO' },
  })

  runTransfer(club.id, isPostgresToPostgres).catch(() => {})

  setResponseStatus(event, 202)
  return { ok: true }
})

async function runTransfer(clubId: string, isPostgresToPostgres: boolean) {
  try {
    const { transferSheetsToPostgres, transferPostgresToPostgres } = await import(
      '~/server/utils/dataTransfer'
    )

    if (isPostgresToPostgres) {
      // Postgres→Postgres: migrations + copy + swap handled inside transferPostgresToPostgres
      await transferPostgresToPostgres(clubId)
    } else {
      // Sheets→Postgres: migrations + copy + swap handled inside transferSheetsToPostgres
      await transferSheetsToPostgres(clubId)
    }

    // Postgres→Postgres: log done after swap
    await prisma.auditLog.create({
      data: { clubId, event: 'DB_TRANSFER_DONE', severity: 'INFO' },
    })
  } catch (err) {
    await prisma.auditLog.create({
      data: {
        clubId,
        event: 'DB_TRANSFER_FAILED',
        severity: 'ERROR',
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      },
    })
  }
}
