import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'
import { createRootFolderStructure } from './googleDrive'
import { createMembersSheet } from './sheets'

export async function setupClubStorage(params: {
  clubId: string
  clubName: string
  tokens: OAuthTokens
  parentId?: string
}): Promise<GoogleDriveConfig> {
  const { rootFolderId, memberFolderId } = await createRootFolderStructure({
    tokens: params.tokens,
    parentId: params.parentId,
  })

  const membersSheetId = await createMembersSheet({
    tokens: params.tokens,
    memberFolderId,
    clubName: params.clubName,
  })

  const storageConfig: GoogleDriveConfig = {
    rootFolderId,
    memberFolderId,
    membersSheetId,
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
