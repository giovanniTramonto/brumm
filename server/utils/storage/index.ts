import { createMemberFolder, createUploadSubfolders, deleteMemberFolder } from "./googleDrive"
import { createMemberSheet, addMemberToMasterSheet, removeMemberFromMasterSheet } from "./sheets"
import { getDriveClient } from "../googleAuth"
import { generateStorageRef } from "~/server/utils/storageRef"
import { prisma } from "~/server/utils/prisma"
import type { GoogleDriveConfig } from "~/types"
import type { User } from "~/types"

export async function initUserStorage(params: {
  user: User
  storageConfig: GoogleDriveConfig
  emails: Array<{ email: string; isPrimary: boolean }>
  groupName?: string
}): Promise<string> {
  const { storageConfig } = params
  const credentials = {
    serviceAccountEmail: storageConfig.serviceAccountEmail,
    serviceAccountKey: storageConfig.serviceAccountKey,
  }

  const storageRef = generateStorageRef(
    new Date(params.user.birthDate),
    params.user.firstName,
    params.user.lastName
  )

  const memberFolderId = await createMemberFolder({
    credentials,
    parentFolderId: storageConfig.membersFolderId,
    folderName: storageRef,
  })

  await Promise.all([
    createUploadSubfolders({ credentials, memberFolderId }),
    createMemberSheet({ credentials, memberFolderId, storageRef, user: params.user }),
    addMemberToMasterSheet({
      credentials,
      masterSheetId: storageConfig.masterSheetId,
      storageRef,
      user: params.user,
      emails: params.emails,
      groupName: params.groupName,
    }),
  ])

  await prisma.user.update({
    where: { id: params.user.id },
    data: { storageRef },
  })

  return storageRef
}

export async function deleteMemberStorage(params: {
  userId: string
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
    fields: "files(id)",
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
