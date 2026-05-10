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
