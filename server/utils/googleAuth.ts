import { GoogleAuth } from 'google-auth-library'
import { google } from 'googleapis'

export interface GoogleCredentials {
  serviceAccountEmail: string
  serviceAccountKey: string
}

function extractPrivateKey(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { private_key?: string }
    if (parsed.private_key) return parsed.private_key.replace(/\\n/g, '\n')
  } catch {
    // not JSON — treat as raw PEM
  }
  return raw.replace(/\\n/g, '\n')
}

export function getGoogleAuth(credentials: GoogleCredentials): GoogleAuth {
  return new GoogleAuth({
    credentials: {
      client_email: credentials.serviceAccountEmail,
      private_key: extractPrivateKey(credentials.serviceAccountKey),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })
}

export function getDriveClient(credentials: GoogleCredentials) {
  const auth = getGoogleAuth(credentials)
  return google.drive({ version: 'v3', auth })
}

export function getSheetsClient(credentials: GoogleCredentials) {
  const auth = getGoogleAuth(credentials)
  return google.sheets({ version: 'v4', auth })
}
