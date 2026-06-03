import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'
import { createRootFolderStructure, createTemplatesStructure } from './googleDrive'
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

  const [membersSheetId, { templatesFolderId }] = await Promise.all([
    createMembersSheet({ tokens: params.tokens, memberFolderId, clubName: params.clubName }),
    createTemplatesStructure({ tokens: params.tokens, rootFolderId }),
  ])

  const storageConfig: GoogleDriveConfig = {
    rootFolderId,
    memberFolderId,
    membersSheetId,
    templatesFolderId,
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
