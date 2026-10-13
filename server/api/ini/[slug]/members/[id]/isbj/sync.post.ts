import { getBerlinToday } from '~/server/utils/isbjContracts'
import { updateMemberData } from '~/server/utils/memberData'
import { resolveEditorName } from '~/server/utils/memberEditor'
import { loadMemberForIsbj, loadMemberIsbjData } from '~/server/utils/memberIsbj'
import type { MemberISBJSyncResponse } from '~/types'
import { getIsbjSyncPatch, selectCurrentContract } from '~/utils/isbjMatching'

// "ISBJ Aktualisieren": copies care type and surcharges of the current ISBJ contract into Brumm.
// Reads ISBJ again instead of trusting the client, nothing is sent to ISBJ.
export default defineEventHandler(async (event): Promise<MemberISBJSyncResponse> => {
  const club = event.context.club
  const { memberId, member } = await loadMemberForIsbj(event)
  const body = await readBody<{ lastEditedAt?: string | null }>(event)

  const isbj = await loadMemberIsbjData(club.id, member)
  if (!isbj.isConfigured) {
    throw createError({ statusCode: 400, statusMessage: 'ISBJ ist nicht eingerichtet.' })
  }
  if (isbj.error) throw createError({ statusCode: 502, statusMessage: isbj.error })

  const contract = selectCurrentContract(isbj.contracts, getBerlinToday())
  if (!contract) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'In ISBJ gibt es keinen laufenden oder künftigen Vertrag für diesen Gutschein.',
    })
  }

  const patch = getIsbjSyncPatch(contract, member, getBerlinToday())
  if (!patch.careType && !patch.surcharges) {
    return {
      isChanged: false,
      careType: member.careType,
      surcharges: member.surcharges,
      lastEditedAt: member.lastEditedAt,
      lastEditedBy: member.lastEditedBy,
    }
  }

  const lastEditedAt = new Date().toISOString()
  const lastEditedBy = await resolveEditorName(event.context.user, member, club)
  // Same optimistic locking as the regular save: 409 if someone else edited in the meantime
  await updateMemberData(
    memberId,
    { ...patch, lastEditedAt, lastEditedBy },
    club,
    body?.lastEditedAt,
  )

  return {
    isChanged: true,
    careType: patch.careType ?? member.careType,
    surcharges: patch.surcharges ?? member.surcharges,
    lastEditedAt,
    lastEditedBy,
  }
})
