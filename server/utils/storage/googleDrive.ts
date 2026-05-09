import { getDriveClient } from "../googleAuth"
import type { GoogleCredentials } from "../googleAuth"

export async function createMemberFolder(params: {
  credentials: GoogleCredentials
  parentFolderId: string
  folderName: string
}): Promise<string> {
  const drive = getDriveClient(params.credentials)

  const folder = await drive.files.create({
    requestBody: {
      name: params.folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [params.parentFolderId],
    },
    fields: "id",
  })

  const folderId = folder.data.id
  if (!folderId) throw new Error("Failed to create member folder")
  return folderId
}

export async function createUploadSubfolders(params: {
  credentials: GoogleCredentials
  memberFolderId: string
}): Promise<{ documentsId: string; imagesId: string; miscId: string }> {
  const drive = getDriveClient(params.credentials)

  const createFolder = async (name: string): Promise<string> => {
    const result = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [params.memberFolderId],
      },
      fields: "id",
    })
    const id = result.data.id
    if (!id) throw new Error(`Failed to create subfolder: ${name}`)
    return id
  }

  const [documentsId, imagesId, miscId] = await Promise.all([
    createFolder("documents"),
    createFolder("images"),
    createFolder("misc"),
  ])

  return { documentsId, imagesId, miscId }
}

export async function deleteMemberFolder(params: {
  credentials: GoogleCredentials
  folderId: string
}): Promise<void> {
  const drive = getDriveClient(params.credentials)
  await drive.files.delete({ fileId: params.folderId })
}

export async function createRootFolderStructure(params: {
  credentials: GoogleCredentials
  clubName: string
}): Promise<{
  rootFolderId: string
  appFolderId: string
  membersFolderId: string
}> {
  const drive = getDriveClient(params.credentials)

  const createFolder = async (name: string, parentId?: string): Promise<string> => {
    const result = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
    })
    const id = result.data.id
    if (!id) throw new Error(`Failed to create folder: ${name}`)
    return id
  }

  const rootFolderId = await createFolder(params.clubName)
  const [appFolderId, membersFolderId] = await Promise.all([
    createFolder("app", rootFolderId),
    createFolder("members", rootFolderId),
  ])

  return { rootFolderId, appFolderId, membersFolderId }
}
