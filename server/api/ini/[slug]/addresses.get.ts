import { getAllGroups } from '~/server/utils/groupData'
import { getAllMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const users = await prisma.user.findMany({
    where: { clubId: club.id, role: 'MEMBER', status: { in: ['ACTIVE', 'INACTIVE'] } },
    select: { id: true },
  })

  const [memberDataList, groups] = await Promise.all([
    getAllMemberData(
      users.map((u) => u.id),
      club,
    ),
    getAllGroups(club).catch(() => []),
  ])

  const addresses = memberDataList
    .map((md) => ({
      firstName: md.firstName,
      lastName: md.lastName,
      birthDate: md.birthDate,
      guardian1Name: md.guardian1Name,
      guardian2Name: md.guardian2Name,
      email1: md.email1,
      email2: md.email2,
      phone1: md.phone1,
      phone2: md.phone2,
      address: md.address,
      groupId: md.groupId,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))

  return { addresses, groups }
})
