import type { ManagerData, OAuthTokens } from '~/types'
import { getDriveClientFromTokens, getSheetsClientFromTokens } from '../googleAuth'

const HEADERS = ['managerId', 'storageId', 'name', 'email']

function rowToManagerData(row: string[]): ManagerData {
  return {
    managerId: row[0] ?? '',
    storageId: row[1] ?? '',
    name: row[2] ?? '',
    email: row[3] ?? '',
  }
}

export async function createManagersSheet(params: {
  tokens: OAuthTokens
  managersFolderId: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'managers',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.managersFolderId],
    },
    fields: 'id',
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error('Failed to create managers sheet')

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  })

  return sheetId
}

export async function writeManagerToSheet(params: {
  tokens: OAuthTokens
  managersSheetId: string
  data: ManagerData
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)
  const { data } = params

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.managersSheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[data.managerId, data.storageId, data.name, data.email]] },
  })
}

export async function getAllManagersFromSheet(params: {
  tokens: OAuthTokens
  managersSheetId: string
}): Promise<ManagerData[]> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.managersSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  return rows.slice(1).map((row) => rowToManagerData(row as string[]))
}

export async function getManagerFromSheet(params: {
  tokens: OAuthTokens
  managersSheetId: string
  managerId: string
}): Promise<ManagerData | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.managersSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  const row = rows.slice(1).find((r) => r[0] === params.managerId)
  return row ? rowToManagerData(row as string[]) : null
}

export async function updateManagerInSheet(params: {
  tokens: OAuthTokens
  managersSheetId: string
  managerId: string
  updates: Partial<Pick<ManagerData, 'name' | 'email'>>
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.managersSheetId,
    range: 'A:D',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.managerId)
  if (rowIndex === -1) return

  const existing = rowToManagerData(rows[rowIndex] as string[])
  const merged = { ...existing, ...params.updates }

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.managersSheetId,
    range: `A${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[merged.managerId, merged.storageId, merged.name, merged.email]] },
  })
}

export async function findManagerIdByEmail(params: {
  tokens: OAuthTokens
  managersSheetId: string
  email: string
}): Promise<string | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.managersSheetId,
    range: 'A:D',
  })
  const rows = response.data.values ?? []
  const match = rows.slice(1).find((row) => row[3]?.toLowerCase() === params.email.toLowerCase())
  return match ? (match[0] as string) : null
}

export async function removeManagerFromSheet(params: {
  tokens: OAuthTokens
  managersSheetId: string
  managerId: string
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.managersSheetId,
    range: 'A:A',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.managerId)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.managersSheetId,
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
