import type { MemberData, OAuthTokens } from '~/types'
import { getDriveClientFromTokens, getSheetsClientFromTokens } from '../googleAuth'

const MASTER_SHEET_HEADERS = [
  'userId',
  'storageRef',
  'firstName',
  'lastName',
  'birthDate',
  'guardian1Name',
  'guardian2Name',
  'email1',
  'email2',
  'groupId',
  'isActive',
  'deactivatedAt',
  'deactivatedBy',
  'contractEnd',
  'phone1',
  'phone2',
  'surcharges',
  'careType',
  'lastEditedAt',
  'lastEditedBy',
]

function rowToMemberData(row: string[]): MemberData {
  return {
    userId: row[0] ?? '',
    storageRef: row[1] ?? '',
    firstName: row[2] ?? '',
    lastName: row[3] ?? '',
    birthDate: row[4] ?? '',
    guardian1Name: row[5] || null,
    guardian2Name: row[6] || null,
    email1: row[7] ?? '',
    email2: row[8] || null,
    groupId: row[9] || null,
    isActive: row[10] === 'true',
    deactivatedAt: row[11] || null,
    deactivatedBy: row[12] || null,
    contractEnd: row[13] || null,
    phone1: row[14] || null,
    phone2: row[15] || null,
    surcharges: row[16] ? row[16].split(',').filter(Boolean) : [],
    careType: row[17] || null,
    lastEditedAt: row[18] || null,
    lastEditedBy: row[19] || null,
  }
}

export async function createMembersSheet(params: {
  tokens: OAuthTokens
  memberFolderId: string
  clubName: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'members',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.memberFolderId],
    },
    fields: 'id',
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error('Failed to create master sheet')

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [MASTER_SHEET_HEADERS] },
  })

  return sheetId
}

export async function createMemberSheet(params: {
  tokens: OAuthTokens
  memberFolderId: string
  memberData: MemberData
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const { memberData } = params

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: memberData.storageRef,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.memberFolderId],
    },
    fields: 'id',
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error('Failed to create member sheet')

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Feld', 'Wert'],
        ['storageRef', memberData.storageRef],
        ['Vorname', memberData.firstName],
        ['Nachname', memberData.lastName],
        ['Geburtsdatum', memberData.birthDate],
      ],
    },
  })

  return sheetId
}

export async function writeMemberToSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
  data: MemberData
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)
  const { data } = params

  const row = [
    data.userId,
    data.storageRef,
    data.firstName,
    data.lastName,
    data.birthDate,
    data.guardian1Name ?? '',
    data.guardian2Name ?? '',
    data.email1,
    data.email2 ?? '',
    data.groupId ?? '',
    String(data.isActive),
    data.deactivatedAt ?? '',
    data.deactivatedBy ?? '',
    data.contractEnd ?? '',
    data.phone1 ?? '',
    data.phone2 ?? '',
    data.surcharges.join(','),
    data.careType ?? '',
    data.lastEditedAt ?? '',
    data.lastEditedBy ?? '',
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.membersSheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

export async function removeMemberFromSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
  storageRef: string
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'B:B',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row) => row[0] === params.storageRef)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.membersSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  })
}

export async function getAllMembersFromSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
}): Promise<MemberData[]> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:T',
  })

  const rows = response.data.values ?? []
  return rows.slice(1).map((row) => rowToMemberData(row as string[]))
}

export async function getMemberFromSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
  userId: string
}): Promise<MemberData | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:T',
  })

  const rows = response.data.values ?? []
  const dataRow = rows.slice(1).find((row) => row[0] === params.userId)
  if (!dataRow) return null

  return rowToMemberData(dataRow as string[])
}

export async function findUserIdByEmail(params: {
  tokens: OAuthTokens
  membersSheetId: string
  email: string
}): Promise<string | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:T',
  })

  const rows = response.data.values ?? []
  const match = rows
    .slice(1)
    .find(
      (row) =>
        row[7]?.toLowerCase() === params.email.toLowerCase() ||
        row[8]?.toLowerCase() === params.email.toLowerCase(),
    )

  return match ? (match[0] as string) : null
}

export async function updateMemberInSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
  userId: string
  updates: Partial<MemberData>
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:T',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === params.userId)
  if (rowIndex === -1) return

  const existing = rowToMemberData(rows[rowIndex] as string[])
  const merged: MemberData = { ...existing, ...params.updates }

  const updatedRow = [
    merged.userId,
    merged.storageRef,
    merged.firstName,
    merged.lastName,
    merged.birthDate,
    merged.guardian1Name ?? '',
    merged.guardian2Name ?? '',
    merged.email1,
    merged.email2 ?? '',
    merged.groupId ?? '',
    String(merged.isActive),
    merged.deactivatedAt ?? '',
    merged.deactivatedBy ?? '',
    merged.contractEnd ?? '',
    merged.phone1 ?? '',
    merged.phone2 ?? '',
    merged.surcharges.join(','),
    merged.careType ?? '',
    merged.lastEditedAt ?? '',
    merged.lastEditedBy ?? '',
  ]

  const sheetRow = rowIndex + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.membersSheetId,
    range: `A${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [updatedRow] },
  })
}
