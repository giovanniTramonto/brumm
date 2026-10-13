import { getManagerData } from './managerData'
import { prisma } from './prisma'

// Name stored as "lastEditedBy" on a member: MEMBER → guardian name, MANAGER → name from the
// club DB, SUPERUSER → "Admin"
export async function resolveEditorName(
  user: { id: string; role: string; storageId: string | null },
  existingMember: { guardian1Name: string | null },
  club: Parameters<typeof getManagerData>[1],
): Promise<string | null> {
  if (user.role === 'MEMBER') return existingMember.guardian1Name ?? null
  if (user.role === 'MANAGER' && user.storageId) {
    const manager = await prisma.manager.findFirst({
      where: { storageId: user.storageId, clubId: club.id },
    })
    if (manager) {
      const data = await getManagerData(manager.id, club)
      if (data?.name) return data.name
    }
  }
  return 'Admin'
}
