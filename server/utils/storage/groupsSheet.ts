import type { GroupData, OAuthTokens } from '~/types'
import { getDriveClientFromTokens, getSheetsClientFromTokens } from '../googleAuth'

const HEADERS = ['groupId', 'name', 'email']

function rowToGroupData(row: string[]): GroupData {
  return {
    groupId: row[0] ?? '',
    name: row[1] ?? '',
    email: row[2] || null,
  }
}

export async function createGroupsSheet(params: {
  tokens: OAuthTokens
  groupsFolderId: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'groups',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.groupsFolderId],
    },
    fields: 'id',
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error('Failed to create groups sheet')

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  })

  return sheetId
}

export async function getAllGroupsFromSheet(params: {
  tokens: OAuthTokens
  groupsSheetId: string
}): Promise<GroupData[]> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.groupsSheetId,
    range: 'A:C',
  })

  const rows = response.data.values ?? []
  return rows.slice(1).map((row) => rowToGroupData(row as string[]))
}

export async function writeGroupToSheet(params: {
  tokens: OAuthTokens
  groupsSheetId: string
  data: GroupData
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.groupsSheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[params.data.groupId, params.data.name, params.data.email ?? '']] },
  })
}

export async function updateGroupInSheet(params: {
  tokens: OAuthTokens
  groupsSheetId: string
  groupId: string
  updates: Partial<Pick<GroupData, 'name' | 'email'>>
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.groupsSheetId,
    range: 'A:C',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.groupId)
  if (rowIndex === -1) return

  const existing = rowToGroupData(rows[rowIndex] as string[])
  const merged = { ...existing, ...params.updates }

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.groupsSheetId,
    range: `A${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[merged.groupId, merged.name, merged.email ?? '']] },
  })
}

export async function removeGroupFromSheet(params: {
  tokens: OAuthTokens
  groupsSheetId: string
  groupId: string
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.groupsSheetId,
    range: 'A:A',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === params.groupId)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.groupsSheetId,
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
