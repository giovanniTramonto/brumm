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
      event: { in: ['FILE_TRANSFER_STARTED', 'FILE_TRANSFER_DONE', 'FILE_TRANSFER_FAILED'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!last) return { status: 'idle' }
  if (last.event === 'FILE_TRANSFER_DONE') {
    type LogEntry = { name: string; source: string; dest?: string; status: string; error?: string }
    type Sec = { ok: number; failed: number; errors: string[]; log: LogEntry[] }
    const result = last.metadata as {
      templates?: Sec
      memberDocs?: Sec
      wallDocs?: Sec
      otherDocs?: Sec
    } | null
    return { status: 'done', at: last.createdAt, result }
  }
  if (last.event === 'FILE_TRANSFER_FAILED') {
    const meta = last.metadata as { reason?: string } | null
    return { status: 'failed', reason: meta?.reason, at: last.createdAt }
  }
  const TIMEOUT_MS = 20 * 60 * 1000
  if (Date.now() - last.createdAt.getTime() > TIMEOUT_MS) {
    return {
      status: 'failed',
      reason: 'Transfer-Timeout (Netlify-Limit erreicht)',
      at: last.createdAt,
    }
  }
  return { status: 'running' }
})
