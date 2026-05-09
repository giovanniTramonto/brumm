import type { GoogleDriveConfig, MemberData } from '~/types'
import { getDriveClient } from '../googleAuth'
import { createMemberFolder, createUploadSubfolders, deleteMemberFolder } from './googleDrive'
import { createMemberSheet, removeMemberFromMasterSheet, writeMemberToSheet } from './sheets'

export async function initUserStorage(params: {
  memberData: MemberData
  storageConfig: GoogleDriveConfig
}): Promise<void> {
  const { storageConfig, memberData } = params
  const credentials = {
    serviceAccountEmail: storageConfig.serviceAccountEmail,
    serviceAccountKey: storageConfig.serviceAccountKey,
  }

  const memberFolderId = await createMemberFolder({
    credentials,
    parentFolderId: storageConfig.membersFolderId,
    folderName: memberData.storageRef,
  })

  await Promise.all([
    createUploadSubfolders({ credentials, memberFolderId }),
    createMemberSheet({ credentials, memberFolderId, memberData }),
    writeMemberToSheet({
      credentials,
      masterSheetId: storageConfig.masterSheetId,
      data: memberData,
    }),
  ])
}

export async function deleteMemberStorage(params: {
  storageRef: string
  storageConfig: GoogleDriveConfig
}): Promise<void> {
  const { storageConfig } = params
  const credentials = {
    serviceAccountEmail: storageConfig.serviceAccountEmail,
    serviceAccountKey: storageConfig.serviceAccountKey,
  }

  const drive = getDriveClient(credentials)

  const searchResult = await drive.files.list({
    q: `name = '${params.storageRef}' and mimeType = 'application/vnd.google-apps.folder' and '${storageConfig.membersFolderId}' in parents`,
    fields: 'files(id)',
  })

  const folder = searchResult.data.files?.[0]
  if (folder?.id) {
    await deleteMemberFolder({ credentials, folderId: folder.id })
  }

  await removeMemberFromMasterSheet({
    credentials,
    masterSheetId: storageConfig.masterSheetId,
    storageRef: params.storageRef,
  })
}
