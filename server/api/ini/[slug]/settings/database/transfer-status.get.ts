import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const last = await prisma.auditLog.findFirst({
    where: {
      clubId: club.id,
      event: { in: ['DB_TRANSFER_STARTED', 'DB_TRANSFER_DONE', 'DB_TRANSFER_FAILED'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!last) return { status: 'idle' as const }

  if (last.event === 'DB_TRANSFER_STARTED') return { status: 'running' as const }
  if (last.event === 'DB_TRANSFER_DONE') {
    return { status: 'done' as const, at: last.createdAt }
  }
  return {
    status: 'failed' as const,
    reason: (last.metadata as { reason?: string } | null)?.reason,
    at: last.createdAt,
  }
})
