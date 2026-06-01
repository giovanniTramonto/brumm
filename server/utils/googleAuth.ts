import { google } from 'googleapis'
import type { OAuthTokens } from '~/types'

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`,
  )
}

export function getDriveClientFromTokens(tokens: OAuthTokens) {
  const auth = getOAuth2Client()
  auth.setCredentials(tokens)
  return google.drive({ version: 'v3', auth })
}

export function getSheetsClientFromTokens(tokens: OAuthTokens) {
  const auth = getOAuth2Client()
  auth.setCredentials(tokens)
  return google.sheets({ version: 'v4', auth })
}

export async function protectSheet(params: { tokens: OAuthTokens; spreadsheetId: string }) {
  const sheets = getSheetsClientFromTokens(params.tokens)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: {
        requests: [
          {
            addProtectedRange: {
              protectedRange: {
                range: { sheetId: 0 },
                description: 'Verwaltet von Brumm – bitte nicht manuell bearbeiten.',
                warningOnly: true,
              },
            },
          },
        ],
      },
    })
  } catch (err) {
    const message = (err as { message?: string })?.message ?? ''
    if (message.includes('already has sheet protection')) return
    throw err
  }
}

export async function withGoogleErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if ((err as { message?: string })?.message?.includes('invalid_grant')) {
      throw createError({
        statusCode: 503,
        statusMessage:
          'Die Verbindung zu Google ist abgelaufen. Bitte über die Einstellungen neu verbinden.',
      })
    }
    throw err
  }
}
