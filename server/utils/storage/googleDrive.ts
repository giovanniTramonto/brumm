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

async function findDocumentsFolderId(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<string | null> {
  const drive = getDriveClientFromTokens(params.tokens)

  const memberResult = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${params.storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${params.membersFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  const memberFolderId = memberResult.data.files?.[0]?.id
  if (!memberFolderId) return null

  const docsResult = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = 'documents' and mimeType = 'application/vnd.google-apps.folder' and '${memberFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  return docsResult.data.files?.[0]?.id ?? null
}

export async function listMemberDocuments(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<Array<{ id: string; name: string; createdTime: string | null }>> {
  const folderId = await findDocumentsFolderId(params)
  if (!folderId) return []

  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
  })

  return (result.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    createdTime: f.createdTime ?? null,
  }))
}

export async function uploadMemberDocument(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<{ id: string; name: string }> {
  const folderId = await findDocumentsFolderId({
    tokens: params.tokens,
    membersFolderId: params.membersFolderId,
    storageRef: params.storageRef,
  })
  if (!folderId) throw new Error('Documents folder not found')

  const { Readable } = await import('node:stream')
  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: params.filename, parents: [folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id, name',
  })

  return { id: result.data.id ?? '', name: result.data.name ?? '' }
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
