import type { MemberData, OAuthTokens } from '~/types'
import { getDriveClientFromTokens, getSheetsClientFromTokens, protectSheet } from '../googleAuth'

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
  'contractEnd',
  'phone1',
  'phone2',
  'surcharges',
  'careType',
  'lastEditedAt',
  'lastEditedBy',
  'address',
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
    contractEnd: row[10] || null,
    phone1: row[11] || null,
    phone2: row[12] || null,
    surcharges: row[13] ? row[13].split(',').filter(Boolean) : [],
    careType: row[14] || null,
    lastEditedAt: row[15] || null,
    lastEditedBy: row[16] || null,
    address: row[17] || null,
  }
}

export async function createMembersSheet(params: {
  tokens: OAuthTokens
  membersFolderId: string
  clubName: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  const sheets = getSheetsClientFromTokens(params.tokens)

  const file = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'members',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [params.membersFolderId],
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
  await protectSheet({ tokens: params.tokens, spreadsheetId: sheetId })

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
    data.contractEnd ?? '',
    data.phone1 ?? '',
    data.phone2 ?? '',
    data.surcharges.join(','),
    data.careType ?? '',
    data.lastEditedAt ?? '',
    data.lastEditedBy ?? '',
    data.address ?? '',
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

function isDriveUnavailable(err: unknown): boolean {
  const e = err as { response?: { status?: number }; message?: string }
  return (
    e?.response?.status === 404 || (e?.message?.includes('Missing required parameters') ?? false)
  )
}

function throwDriveNotFound(originalErr?: unknown): never {
  const originalMessage = (originalErr as { message?: string })?.message
  throw createError({
    statusCode: 503,
    statusMessage: 'Die Google-Ablage wurde nicht gefunden.',
    message: originalMessage,
  })
}

export async function getAllMembersFromSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
}): Promise<MemberData[]> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: params.membersSheetId,
      range: 'A:R',
    })
    const rows = response.data.values ?? []
    return rows.slice(1).map((row) => rowToMemberData(row as string[]))
  } catch (err) {
    if (isDriveUnavailable(err)) throwDriveNotFound(err)
    throw err
  }
}

export async function getMemberFromSheet(params: {
  tokens: OAuthTokens
  membersSheetId: string
  userId: string
}): Promise<MemberData | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: params.membersSheetId,
      range: 'A:R',
    })
    const rows = response.data.values ?? []
    const dataRow = rows.slice(1).find((row) => row[0] === params.userId)
    if (!dataRow) return null
    return rowToMemberData(dataRow as string[])
  } catch (err) {
    if (isDriveUnavailable(err)) throwDriveNotFound(err)
    throw err
  }
}

export async function findUserIdByEmail(params: {
  tokens: OAuthTokens
  membersSheetId: string
  email: string
}): Promise<string | null> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:R',
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
  expectedLastEditedAt?: string | null
}): Promise<void> {
  const sheets = getSheetsClientFromTokens(params.tokens)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.membersSheetId,
    range: 'A:R',
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === params.userId)
  if (rowIndex === -1) return

  if (
    params.expectedLastEditedAt !== undefined &&
    params.expectedLastEditedAt !== null &&
    (rows[rowIndex][15] ?? '') !== params.expectedLastEditedAt
  ) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Dieses Kind wurde zwischenzeitlich von jemand anderem gespeichert. Bitte Seite neu laden.',
    })
  }

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
    merged.contractEnd ?? '',
    merged.phone1 ?? '',
    merged.phone2 ?? '',
    merged.surcharges.join(','),
    merged.careType ?? '',
    merged.lastEditedAt ?? '',
    merged.lastEditedBy ?? '',
    merged.address ?? '',
  ]

  const sheetRow = rowIndex + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.membersSheetId,
    range: `A${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [updatedRow] },
  })
}
