import type { OAuthTokens } from '~/types'
import { getDriveClientFromTokens } from '../googleAuth'

async function getOrCreateFolder(params: {
  drive: ReturnType<typeof getDriveClientFromTokens>
  name: string
  parentId: string
}): Promise<string> {
  const result = await params.drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${params.name}' and mimeType = 'application/vnd.google-apps.folder' and '${params.parentId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  if (result.data.files?.[0]?.id) return result.data.files[0].id
  const folder = await params.drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: params.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [params.parentId],
    },
    fields: 'id',
  })
  const id = folder.data.id
  if (!id) throw new Error(`Failed to create folder: ${params.name}`)
  return id
}

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
}): Promise<void> {
  const drive = getDriveClientFromTokens(params.tokens)
  const documentsFolderId = await getOrCreateFolder({
    drive,
    name: 'documents',
    parentId: params.memberFolderId,
  })
  await Promise.all([
    getOrCreateFolder({ drive, name: 'contract', parentId: documentsFolderId }),
    getOrCreateFolder({ drive, name: 'other', parentId: documentsFolderId }),
  ])
}

export async function deleteMemberFolder(params: {
  tokens: OAuthTokens
  folderId: string
}): Promise<void> {
  const drive = getDriveClientFromTokens(params.tokens)
  await drive.files.delete({ fileId: params.folderId, supportsAllDrives: true })
}

export async function copyFileToMemberDocuments(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
  sourceFileId: string
  filename: string
}): Promise<string | null> {
  const contractFolderId = await findContractFolderId({
    tokens: params.tokens,
    membersFolderId: params.membersFolderId,
    storageRef: params.storageRef,
  })
  if (!contractFolderId) return null

  const drive = getDriveClientFromTokens(params.tokens)
  const copy = await drive.files.copy({
    fileId: params.sourceFileId,
    supportsAllDrives: true,
    requestBody: { name: params.filename, parents: [contractFolderId] },
    fields: 'id',
  })
  return copy.data.id ?? null
}

export async function findMemberFolderId(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<string | null> {
  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${params.storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${params.membersFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  return result.data.files?.[0]?.id ?? null
}

export async function createTemplatesStructure(params: {
  tokens: OAuthTokens
  rootFolderId: string
}): Promise<{ templatesFolderId: string }> {
  const templatesFolderId = await getOrCreateFolder({
    drive: getDriveClientFromTokens(params.tokens),
    name: 'contract-templates',
    parentId: params.rootFolderId,
  })
  return { templatesFolderId }
}

export async function getOrCreateTemplateSubfolder(params: {
  tokens: OAuthTokens
  templatesFolderId: string
  ref: string
}): Promise<string> {
  const drive = getDriveClientFromTokens(params.tokens)
  return getOrCreateFolder({ drive, name: params.ref, parentId: params.templatesFolderId })
}

export async function uploadTemplateFile(params: {
  tokens: OAuthTokens
  templatesFolderId: string
  ref: string
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<{ driveFileId: string }> {
  const folderId = await getOrCreateTemplateSubfolder({
    tokens: params.tokens,
    templatesFolderId: params.templatesFolderId,
    ref: params.ref,
  })

  const { Readable } = await import('node:stream')
  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: params.filename, parents: [folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id',
  })
  return { driveFileId: result.data.id ?? '' }
}

export async function downloadDriveFile(params: {
  tokens: OAuthTokens
  fileId: string
}): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const drive = getDriveClientFromTokens(params.tokens)

  const meta = await drive.files.get({
    fileId: params.fileId,
    supportsAllDrives: true,
    fields: 'name, mimeType',
  })
  const response = await drive.files.get(
    { fileId: params.fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )

  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    filename: meta.data.name ?? 'download',
    mimeType: meta.data.mimeType ?? 'application/octet-stream',
  }
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

async function findContractFolderId(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<string | null> {
  const documentsFolderId = await findDocumentsFolderId(params)
  if (!documentsFolderId) return null

  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = 'contract' and mimeType = 'application/vnd.google-apps.folder' and '${documentsFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  return result.data.files?.[0]?.id ?? null
}

async function findOtherFolderId(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<string | null> {
  const documentsFolderId = await findDocumentsFolderId(params)
  if (!documentsFolderId) return null
  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = 'other' and mimeType = 'application/vnd.google-apps.folder' and '${documentsFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
  })
  return result.data.files?.[0]?.id ?? null
}

async function getOrCreateOtherFolder(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<string | null> {
  const drive = getDriveClientFromTokens(params.tokens)
  const memberFolderId = await findMemberFolderId(params)
  if (!memberFolderId) return null
  const documentsFolderId = await getOrCreateFolder({
    drive,
    name: 'documents',
    parentId: memberFolderId,
  })
  return getOrCreateFolder({ drive, name: 'other', parentId: documentsFolderId })
}

export async function listOtherDocuments(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<Array<{ id: string; name: string; createdTime: string | null }>> {
  const folderId = await findOtherFolderId(params)
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

export async function findDriveFileByName(
  drive: ReturnType<typeof getDriveClientFromTokens>,
  folderId: string,
  name: string,
): Promise<string | null> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const result = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${folderId}' in parents and name = '${escaped}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  })
  return result.data.files?.[0]?.id ?? null
}

export async function findMemberContractFileId(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
  fileName: string
}): Promise<string | null> {
  const contractFolderId = await findContractFolderId({
    tokens: params.tokens,
    membersFolderId: params.membersFolderId,
    storageRef: params.storageRef,
  })
  if (!contractFolderId) return null
  const drive = getDriveClientFromTokens(params.tokens)
  return findDriveFileByName(drive, contractFolderId, params.fileName)
}

export async function deleteDriveFile(params: {
  tokens: OAuthTokens
  fileId: string
}): Promise<void> {
  const drive = getDriveClientFromTokens(params.tokens)
  await drive.files.delete({ fileId: params.fileId, supportsAllDrives: true })
}

export async function updateDriveFile(params: {
  tokens: OAuthTokens
  fileId: string
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<void> {
  const { Readable } = await import('node:stream')
  const drive = getDriveClientFromTokens(params.tokens)
  await drive.files.update({
    fileId: params.fileId,
    supportsAllDrives: true,
    requestBody: { name: params.filename },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
  })
}

export async function uploadOtherDocument(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<{ id: string; name: string }> {
  const folderId = await getOrCreateOtherFolder({
    tokens: params.tokens,
    membersFolderId: params.membersFolderId,
    storageRef: params.storageRef,
  })
  if (!folderId) throw new Error('Other documents folder not found')
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

export async function listMemberDocuments(params: {
  tokens: OAuthTokens
  membersFolderId: string
  storageRef: string
}): Promise<Array<{ id: string; name: string; createdTime: string | null }>> {
  const folderId = await findContractFolderId(params)
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
  const folderId = await findContractFolderId({
    tokens: params.tokens,
    membersFolderId: params.membersFolderId,
    storageRef: params.storageRef,
  })
  if (!folderId) throw new Error('Contract folder not found')

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

export async function createDocumentsStructure(params: {
  tokens: OAuthTokens
  rootFolderId: string
}): Promise<{ documentsFolderId: string }> {
  const documentsFolderId = await getOrCreateFolder({
    drive: getDriveClientFromTokens(params.tokens),
    name: 'documents',
    parentId: params.rootFolderId,
  })
  return { documentsFolderId }
}

export async function uploadClubDocument(params: {
  tokens: OAuthTokens
  folderId: string
  filename: string
  mimeType: string
  buffer: Buffer
}): Promise<string> {
  const { Readable } = await import('node:stream')
  const drive = getDriveClientFromTokens(params.tokens)
  const result = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: params.filename, parents: [params.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id',
  })
  return result.data.id ?? ''
}

export async function createManagersStructure(params: {
  tokens: OAuthTokens
  rootFolderId: string
}): Promise<{ managersFolderId: string }> {
  const managersFolderId = await getOrCreateFolder({
    drive: getDriveClientFromTokens(params.tokens),
    name: 'managers',
    parentId: params.rootFolderId,
  })
  return { managersFolderId }
}

export async function createTeamStructure(params: {
  tokens: OAuthTokens
  rootFolderId: string
}): Promise<{ teamFolderId: string }> {
  const teamFolderId = await getOrCreateFolder({
    drive: getDriveClientFromTokens(params.tokens),
    name: 'team',
    parentId: params.rootFolderId,
  })
  return { teamFolderId }
}

export async function createGroupsStructure(params: {
  tokens: OAuthTokens
  rootFolderId: string
}): Promise<{ groupsFolderId: string }> {
  const groupsFolderId = await getOrCreateFolder({
    drive: getDriveClientFromTokens(params.tokens),
    name: 'groups',
    parentId: params.rootFolderId,
  })
  return { groupsFolderId }
}

export async function createRootFolderStructure(params: {
  tokens: OAuthTokens
  parentId?: string
}): Promise<{
  rootFolderId: string
  membersFolderId: string
}> {
  const drive = getDriveClientFromTokens(params.tokens)

  const rootFolderId = await getOrCreateFolder({
    drive,
    name: 'brumm',
    parentId: params.parentId ?? 'root',
  })
  const membersFolderId = await getOrCreateFolder({
    drive,
    name: 'members',
    parentId: rootFolderId,
  })

  return { rootFolderId, membersFolderId }
}
