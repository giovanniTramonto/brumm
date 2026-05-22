import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'
import { createRootFolderStructure } from './googleDrive'
import { createMasterSheet } from './sheets'

export async function setupClubStorage(params: {
  clubId: string
  clubName: string
  tokens: OAuthTokens
  parentId?: string
}): Promise<GoogleDriveConfig> {
  const { rootFolderId, appFolderId, membersFolderId } = await createRootFolderStructure({
    tokens: params.tokens,
    clubName: params.clubName,
    parentId: params.parentId,
  })

  const masterSheetId = await createMasterSheet({
    tokens: params.tokens,
    appFolderId,
    clubName: params.clubName,
  })

  const storageConfig: GoogleDriveConfig = {
    rootFolderId,
    appFolderId,
    membersFolderId,
    masterSheetId,
  }

  await prisma.club.update({
    where: { id: params.clubId },
    data: {
      storageType: 'GOOGLE_DRIVE',
      storageConfig: storageConfig as object,
      oauthToken: params.tokens as object,
      isSetupDone: true,
    },
  })

  return storageConfig
}
