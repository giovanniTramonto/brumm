import { getSheetsClient, getDriveClient } from "../googleAuth"
import type { GoogleCredentials } from "../googleAuth"
import type { User } from "~/types"

const MASTER_SHEET_HEADERS = [
  "storageRef",
  "firstName",
  "lastName",
  "birthDate",
  "guardian1Name",
  "guardian2Name",
  "email1",
  "email2",
  "groupName",
  "isActive",
  "createdAt",
]

export async function createMasterSheet(params: {
  credentials: GoogleCredentials
  appFolderId: string
  clubName: string
}): Promise<string> {
  const drive = getDriveClient(params.credentials)
  const sheets = getSheetsClient(params.credentials)

  const file = await drive.files.create({
    requestBody: {
      name: "master",
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [params.appFolderId],
    },
    fields: "id",
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error("Failed to create master sheet")

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: [MASTER_SHEET_HEADERS] },
  })

  return sheetId
}

export async function createMemberSheet(params: {
  credentials: GoogleCredentials
  memberFolderId: string
  storageRef: string
  user: Pick<User, "firstName" | "lastName" | "birthDate">
}): Promise<string> {
  const drive = getDriveClient(params.credentials)
  const sheets = getSheetsClient(params.credentials)

  const file = await drive.files.create({
    requestBody: {
      name: params.storageRef,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [params.memberFolderId],
    },
    fields: "id",
  })

  const sheetId = file.data.id
  if (!sheetId) throw new Error("Failed to create member sheet")

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        ["Feld", "Wert"],
        ["storageRef", params.storageRef],
        ["Vorname", params.user.firstName],
        ["Nachname", params.user.lastName],
        ["Geburtsdatum", params.user.birthDate],
      ],
    },
  })

  return sheetId
}

export async function addMemberToMasterSheet(params: {
  credentials: GoogleCredentials
  masterSheetId: string
  storageRef: string
  user: User
  emails: Array<{ email: string; isPrimary: boolean }>
  groupName?: string
}): Promise<void> {
  const sheets = getSheetsClient(params.credentials)

  const primaryEmail = params.emails.find((e) => e.isPrimary)?.email ?? ""
  const secondaryEmail = params.emails.find((e) => !e.isPrimary)?.email ?? ""

  const row = [
    params.storageRef,
    params.user.firstName,
    params.user.lastName,
    params.user.birthDate,
    params.user.guardian1Name ?? "",
    params.user.guardian2Name ?? "",
    primaryEmail,
    secondaryEmail,
    params.groupName ?? "",
    params.user.isActive ? "ja" : "nein",
    new Date().toISOString(),
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.masterSheetId,
    range: "A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  })
}

export async function removeMemberFromMasterSheet(params: {
  credentials: GoogleCredentials
  masterSheetId: string
  storageRef: string
}): Promise<void> {
  const sheets = getSheetsClient(params.credentials)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.masterSheetId,
    range: "A:A",
  })

  const rows = response.data.values ?? []
  const rowIndex = rows.findIndex((row) => row[0] === params.storageRef)
  if (rowIndex === -1) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.masterSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  })
}
