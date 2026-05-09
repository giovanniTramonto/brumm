import { createRootFolderStructure } from "./googleDrive"
import { createMasterSheet } from "./sheets"
import { prisma } from "~/server/utils/prisma"
import type { GoogleCredentials } from "~/server/utils/googleAuth"
import type { GoogleDriveConfig } from "~/types"

export async function setupClubStorage(params: {
  clubId: string
  clubName: string
  credentials: GoogleCredentials
}): Promise<GoogleDriveConfig> {
  const { rootFolderId, appFolderId, membersFolderId } = await createRootFolderStructure({
    credentials: params.credentials,
    clubName: params.clubName,
  })

  const masterSheetId = await createMasterSheet({
    credentials: params.credentials,
    appFolderId,
    clubName: params.clubName,
  })

  const storageConfig: GoogleDriveConfig = {
    serviceAccountEmail: params.credentials.serviceAccountEmail,
    serviceAccountKey: params.credentials.serviceAccountKey,
    rootFolderId,
    appFolderId,
    membersFolderId,
    masterSheetId,
  }

  await prisma.club.update({
    where: { id: params.clubId },
    data: {
      storageType: "GOOGLE_DRIVE",
      storageConfig: storageConfig as object,
      isSetupDone: true,
    },
  })

  return storageConfig
}
