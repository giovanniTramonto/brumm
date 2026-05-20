import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, ManagerData, OAuthTokens } from '~/types'
import { createManagementStructure } from './storage/googleDrive'
import {
  createManagersSheet,
  getAllManagersFromSheet,
  getManagerFromSheet,
  removeManagerFromSheet,
  updateManagerInSheet,
  writeManagerToSheet,
} from './storage/managersSheet'

type ClubForData = {
  id: string
  isSetupDone: boolean
  storageConfig: unknown
  oauthToken: unknown
}

function getTokens(oauthToken: unknown): OAuthTokens {
  return oauthToken as OAuthTokens
}

function getStorageConfig(storageConfig: unknown): GoogleDriveConfig {
  return storageConfig as GoogleDriveConfig
}

function localDataToManagerData(managerId: string, localData: unknown): ManagerData | null {
  if (!localData || typeof localData !== 'object') return null
  const d = localData as Record<string, unknown>
  return {
    managerId,
    storageId: (d.storageId as string) ?? '',
    name: (d.name as string) ?? '',
    email: (d.email as string) ?? '',
  }
}

async function ensureManagementStorage(club: ClubForData): Promise<GoogleDriveConfig> {
  const config = getStorageConfig(club.storageConfig)
  if (config.managementFolderId && config.managersSheetId) return config

  const tokens = getTokens(club.oauthToken)
  const { managementFolderId } = await createManagementStructure({
    tokens,
    appFolderId: config.appFolderId,
  })
  const managersSheetId = await createManagersSheet({ tokens, managementFolderId })

  const updated: GoogleDriveConfig = { ...config, managementFolderId, managersSheetId }
  await prisma.club.update({
    where: { id: club.id },
    data: { storageConfig: updated as unknown as Prisma.InputJsonValue },
  })
  return updated
}

export async function getManagerData(
  managerId: string,
  club: ClubForData,
): Promise<ManagerData | null> {
  if (!club.isSetupDone) {
    const manager = await prisma.manager.findUnique({ where: { id: managerId } })
    if (!manager?.localData) return null
    return localDataToManagerData(managerId, manager.localData)
  }

  const config = await ensureManagementStorage(club)
  const tokens = getTokens(club.oauthToken)
  return getManagerFromSheet({ tokens, managersSheetId: config.managersSheetId!, managerId })
}

export async function getAllManagerData(club: ClubForData): Promise<ManagerData[]> {
  if (!club.isSetupDone) {
    const managers = await prisma.manager.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    return managers.flatMap((m) => {
      const data = localDataToManagerData(m.id, m.localData)
      return data ? [data] : []
    })
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  if (!config.managersSheetId) return []

  const tokens = getTokens(club.oauthToken)
  return getAllManagersFromSheet({ tokens, managersSheetId: config.managersSheetId })
}

export async function saveManagerData(data: ManagerData, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.manager.update({
      where: { id: data.managerId },
      data: { localData: data as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const config = await ensureManagementStorage(club)
  if (!config.managersSheetId) return
  const tokens = getTokens(club.oauthToken)

  await writeManagerToSheet({ tokens, managersSheetId: config.managersSheetId, data })
}

export async function updateManagerData(
  managerId: string,
  updates: Partial<Pick<ManagerData, 'name' | 'email'>>,
  club: ClubForData,
): Promise<void> {
  if (!club.isSetupDone) {
    const manager = await prisma.manager.findUnique({ where: { id: managerId } })
    const existing = localDataToManagerData(managerId, manager?.localData) ?? ({} as ManagerData)
    await prisma.manager.update({
      where: { id: managerId },
      data: { localData: { ...existing, ...updates } as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  if (!config.managersSheetId) return

  const tokens = getTokens(club.oauthToken)
  await updateManagerInSheet({
    tokens,
    managersSheetId: config.managersSheetId,
    managerId,
    updates,
  })
}

export async function deleteManagerData(
  managerId: string,
  club: ClubForData,
): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.manager.update({
      where: { id: managerId },
      data: { localData: Prisma.DbNull },
    })
    return
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  const tokens = getTokens(club.oauthToken)

  if (config.managersSheetId) {
    await removeManagerFromSheet({ tokens, managersSheetId: config.managersSheetId, managerId })
  }
}
