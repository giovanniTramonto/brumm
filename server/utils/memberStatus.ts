import type { MemberStatus } from '~/types'

// Valid state transitions — all other combinations are rejected with 409
const VALID_TRANSITIONS: Partial<Record<MemberStatus, MemberStatus[]>> = {
  PENDING_INVITE: ['REGISTERED', 'ACTIVE'],
  REGISTERED: ['ACTIVE'],
  ACTIVE: ['INACTIVE', 'DEACTIVATED'],
  INACTIVE: ['ACTIVE', 'DEACTIVATED'],
  DEACTIVATED: ['ACTIVE'],
}

export function assertValidTransition(current: MemberStatus, next: MemberStatus): void {
  if (!VALID_TRANSITIONS[current]?.includes(next)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ungültiger Statusübergang: ${current} → ${next}`,
    })
  }
}
