import { getAllMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const users = await prisma.user.findMany({
    where: { clubId: club.id, role: 'MEMBER', isActive: true },
    select: { id: true },
  })

  const memberDataList = await getAllMemberData(
    users.map((u) => u.id),
    club,
  )

  const addresses = memberDataList
    .map((md) => ({
      firstName: md.firstName,
      lastName: md.lastName,
      guardian1Name: md.guardian1Name,
      guardian2Name: md.guardian2Name,
      email1: md.email1,
      email2: md.email2,
      phone1: md.phone1,
      phone2: md.phone2,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))

  return { addresses }
})
