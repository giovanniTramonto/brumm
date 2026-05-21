import type { GoogleDriveConfig, MemberData, OAuthTokens } from '~/types'
import { getDriveClientFromTokens } from '../googleAuth'
import { createMemberFolder, createUploadSubfolders, deleteMemberFolder } from './googleDrive'
import { createMemberSheet, removeMemberFromMasterSheet } from './sheets'

export async function initUserStorage(params: {
  memberData: MemberData
  storageConfig: GoogleDriveConfig
  tokens: OAuthTokens
}): Promise<void> {
  const { storageConfig, memberData, tokens } = params

  const memberFolderId = await createMemberFolder({
    tokens,
    parentFolderId: storageConfig.membersFolderId,
    folderName: memberData.storageRef,
  })

  await Promise.all([
    createUploadSubfolders({ tokens, memberFolderId }),
    createMemberSheet({ tokens, memberFolderId, memberData }),
  ])
}

export async function deleteMemberStorage(params: {
  storageRef: string
  storageConfig: GoogleDriveConfig
  tokens: OAuthTokens
}): Promise<void> {
  const { storageConfig, tokens } = params

  const drive = getDriveClientFromTokens(tokens)

  const searchResult = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `name = '${params.storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${storageConfig.membersFolderId}' in parents`,
    fields: 'files(id)',
  })

  const folder = searchResult.data.files?.[0]
  if (folder?.id) {
    await deleteMemberFolder({ tokens, folderId: folder.id })
  }

  await removeMemberFromMasterSheet({
    tokens,
    masterSheetId: storageConfig.masterSheetId,
    storageRef: params.storageRef,
  })
}
