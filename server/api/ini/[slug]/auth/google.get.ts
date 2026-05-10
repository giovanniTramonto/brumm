import { getOAuth2Client } from '~/server/utils/googleAuth'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const club = event.context.club

  const oauth2Client = getOAuth2Client()

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    state: JSON.stringify({ clubId: club.id, slug }),
  })

  return sendRedirect(event, url)
})
