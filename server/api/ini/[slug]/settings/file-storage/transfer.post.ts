import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const record = await prisma.clubFileStorage.findUnique({ where: { clubId: club.id } })
  if (!record?.pendingEncryptedConfig) {
    throw createError({ statusCode: 422, statusMessage: 'Keine ausstehende S3-Konfiguration.' })
  }

  const running = await prisma.auditLog.findFirst({
    where: { clubId: club.id, event: 'FILE_TRANSFER_STARTED' },
    orderBy: { createdAt: 'desc' },
  })
  const completed = await prisma.auditLog.findFirst({
    where: { clubId: club.id, event: { in: ['FILE_TRANSFER_DONE', 'FILE_TRANSFER_FAILED'] } },
    orderBy: { createdAt: 'desc' },
  })
  const isRunning = running && (!completed || running.createdAt > completed.createdAt)

  if (isRunning) {
    throw createError({ statusCode: 409, statusMessage: 'Ein Transfer läuft bereits.' })
  }

  await prisma.auditLog.create({
    data: { clubId: club.id, event: 'FILE_TRANSFER_STARTED', severity: 'INFO' },
  })

  runTransfer(club.id).catch(() => {})

  setResponseStatus(event, 202)
  return { ok: true }
})

async function runTransfer(clubId: string) {
  try {
    const { transferDriveToS3 } = await import('~/server/utils/fileTransfer')
    const result = await transferDriveToS3(clubId)
    await prisma.auditLog.create({
      data: { clubId, event: 'FILE_TRANSFER_DONE', severity: 'INFO', metadata: result },
    })
  } catch (err) {
    await prisma.auditLog.create({
      data: {
        clubId,
        event: 'FILE_TRANSFER_FAILED',
        severity: 'ERROR',
        metadata: { reason: err instanceof Error ? err.message : String(err) },
      },
    })
  }
}
