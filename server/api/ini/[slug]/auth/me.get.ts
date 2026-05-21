import { getMemberData } from '~/server/utils/memberData'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet' })
  }

  if (user.role === 'MEMBER') {
    const memberData = await getMemberData(user.id, club)
    if (memberData) {
      return {
        user: {
          ...user,
          firstName: memberData.guardian1Name ?? memberData.firstName,
          lastName: null,
        },
        club,
      }
    }
  }

  return { user, club }
})
