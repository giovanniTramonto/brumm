import type { OAuthTokens } from '~/types'
import { getDriveClientFromTokens } from '../googleAuth'

export async function createMemberFolder(params: {
  tokens: OAuthTokens
  parentFolderId: string
  folderName: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)

  const folder = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: params.folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [params.parentFolderId],
    },
    fields: 'id',
  })

  const folderId = folder.data.id
  if (!folderId) throw new Error('Failed to create member folder')
  return folderId
}

export async function createUploadSubfolders(params: {
  tokens: OAuthTokens
  memberFolderId: string
}): Promise<{ documentsId: string; imagesId: string; miscId: string }> {
  const drive = getDriveClientFromTokens(params.tokens)

  const createFolder = async (name: string): Promise<string> => {
    const result = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [params.memberFolderId],
      },
      fields: 'id',
    })
    const id = result.data.id
    if (!id) throw new Error(`Failed to create subfolder: ${name}`)
    return id
  }

  const [documentsId, imagesId, miscId] = await Promise.all([
    createFolder('documents'),
    createFolder('images'),
    createFolder('misc'),
  ])

  return { documentsId, imagesId, miscId }
}

export async function deleteMemberFolder(params: {
  tokens: OAuthTokens
  folderId: string
}): Promise<void> {
  const drive = getDriveClientFromTokens(params.tokens)
  await drive.files.delete({ fileId: params.folderId, supportsAllDrives: true })
}

export async function createRootFolderStructure(params: {
  tokens: OAuthTokens
  clubName: string
}): Promise<{
  rootFolderId: string
  appFolderId: string
  membersFolderId: string
}> {
  const drive = getDriveClientFromTokens(params.tokens)

  const createFolder = async (name: string, parentId?: string): Promise<string> => {
    const result = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id',
    })
    const id = result.data.id
    if (!id) throw new Error(`Failed to create folder: ${name}`)
    return id
  }

  const rootFolderId = await createFolder(params.clubName)
  const [appFolderId, membersFolderId] = await Promise.all([
    createFolder('app', rootFolderId),
    createFolder('members', rootFolderId),
  ])

  return { rootFolderId, appFolderId, membersFolderId }
}
