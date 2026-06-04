import { prisma } from '~/server/utils/prisma'
import { createDocumentsStructure } from '~/server/utils/storage/googleDrive'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

type ClubForDocs = {
  id: string
  isSetupDone: boolean
  storageConfig: unknown
  oauthToken: unknown
}

export async function ensureDocumentsFolder(club: ClubForDocs): Promise<string> {
  const config = club.storageConfig as GoogleDriveConfig
  if (config.documentsFolderId) return config.documentsFolderId

  const tokens = club.oauthToken as OAuthTokens
  const { documentsFolderId } = await createDocumentsStructure({
    tokens,
    rootFolderId: config.rootFolderId,
  })

  await prisma.club.update({
    where: { id: club.id },
    data: {
      storageConfig: {
        ...(config as object),
        documentsFolderId,
      },
    },
  })

  return documentsFolderId
}
