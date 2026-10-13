import type { H3Event } from 'h3'
import type { MemberData, MemberISBJResponse } from '~/types'
import { getISBJConfig } from './isbjClient'
import { fetchISBJVoucherWithContracts } from './isbjContracts'
import { getMemberData } from './memberData'
import { prisma } from './prisma'

// Shared by the member ISBJ endpoints: only member managers may see or sync a child's ISBJ data
export async function loadMemberForIsbj(
  event: H3Event,
): Promise<{ memberId: string; member: MemberData }> {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  if (!memberId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id, deletedAt: null },
    select: { id: true },
  })
  const member = user ? await getMemberData(memberId, club) : null
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  return { memberId, member }
}

// ISBJ failures (unreachable, voucher not found, …) come back as `error`, not as an HTTP error:
// the page still has to know that ISBJ is configured to hide the manual fields
export async function loadMemberIsbjData(
  clubId: string,
  member: MemberData,
): Promise<MemberISBJResponse> {
  const config = await getISBJConfig(clubId)
  const base = {
    voucherNumber: member.voucherNumber,
    facilityNumber: config?.facilityNumber ?? null,
    voucher: null,
    contracts: [],
    error: null,
  }
  if (!config) return { ...base, isConfigured: false }
  if (!member.voucherNumber) return { ...base, isConfigured: true }

  try {
    const { voucher, contracts } = await fetchISBJVoucherWithContracts(clubId, member.voucherNumber)
    return { ...base, isConfigured: true, voucher, contracts }
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const error =
      statusCode === 404
        ? `Gutschein ${member.voucherNumber} wurde in ISBJ nicht gefunden.`
        : ((err as { statusMessage?: string })?.statusMessage ?? 'ISBJ nicht erreichbar.')
    return { ...base, isConfigured: true, error }
  }
}
