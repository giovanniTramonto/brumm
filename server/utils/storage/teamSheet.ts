import type { OAuthTokens, TeamData } from '~/types'
import { getDriveClientFromTokens, getSheetsClientFromTokens, protectSheet } from '../googleAuth'

const HEADERS = ['teamId', 'storageId', 'name', 'email']

function rowToTeamData(row: string[]): TeamData {
  return {
    teamId: row[0] ?? '',
    storageId: row[1] ?? '',
    name: row[2] ?? '',
    email: row[3] ?? '',
  }
}

export async function createTeamSheet(params: {
  tokens: OAuthTokens
  teamFolderId: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'team',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.teamFolderId],
    },
    fields: 'id',
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error('Failed to create team sheet')

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  })
  await protectSheet({ tokens: params.tokens, spreadsheetId: sheetId })

  return sheetId
}

export async function writeTeamMemberToSheet(params: {
  tokens: OAuthTokens
  teamSheetId: string
  data: TeamData
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)
  const { data } = params

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.teamSheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[data.teamId, data.storageId, data.name, data.email]] },
  })
}

export async function getAllTeamMembersFromSheet(params: {
  tokens: OAuthTokens
  teamSheetId: string
}): Promise<TeamData[]> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.teamSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  return rows.slice(1).map((row) => rowToTeamData(row as string[]))
}

export async function getTeamMemberFromSheet(params: {
  tokens: OAuthTokens
  teamSheetId: string
  teamId: string
}): Promise<TeamData | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.teamSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  const row = rows.slice(1).find((r) => r[0] === params.teamId)
  return row ? rowToTeamData(row as string[]) : null
}

export async function updateTeamMemberInSheet(params: {
  tokens: OAuthTokens
  teamSheetId: string
  teamId: string
  updates: Partial<Pick<TeamData, 'name' | 'email'>>
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.teamSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.teamId)
  if (rowIndex === -1) return

  const existing = rowToTeamData(rows[rowIndex] as string[])
  const merged = { ...existing, ...params.updates }

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.teamSheetId,
    range: `A${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[merged.teamId, merged.storageId, merged.name, merged.email]] },
  })
}

export async function findTeamMemberIdByEmail(params: {
  tokens: OAuthTokens
  teamSheetId: string
  email: string
}): Promise<string | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.teamSheetId,
    range: 'A:D',
  })
  const rows = response.data.values ?? []
  const match = rows.slice(1).find((row) => row[3]?.toLowerCase() === params.email.toLowerCase())
  return match ? (match[0] as string) : null
}

export async function removeTeamMemberFromSheet(params: {
  tokens: OAuthTokens
  teamSheetId: string
  teamId: string
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.teamSheetId,
    range: 'A:A',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.teamId)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.teamSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: 0, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        },
      ],
    },
  })
}
