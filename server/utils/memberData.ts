import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, MemberData } from '~/types'
import {
  getAllMembersFromSheet,
  getMemberFromSheet,
  updateMemberInSheet,
  writeMemberToSheet,
} from './storage/sheets'

type ClubForData = {
  isSetupDone: boolean
  storageConfig: unknown
  id: string
}

function getCredentials(storageConfig: unknown) {
  const config = storageConfig as GoogleDriveConfig
  return {
    serviceAccountEmail: config.serviceAccountEmail,
    serviceAccountKey: config.serviceAccountKey,
  }
}

function getMasterSheetId(storageConfig: unknown): string {
  return (storageConfig as GoogleDriveConfig).masterSheetId
}

function localDataToMemberData(userId: string, localData: unknown): MemberData | null {
  if (!localData || typeof localData !== 'object') return null
  const d = localData as Record<string, unknown>
  return {
    userId,
    storageRef: (d.storageRef as string) ?? '',
    firstName: (d.firstName as string) ?? '',
    lastName: (d.lastName as string) ?? '',
    birthDate: (d.birthDate as string) ?? '',
    guardian1Name: (d.guardian1Name as string | null) ?? null,
    guardian2Name: (d.guardian2Name as string | null) ?? null,
    email1: (d.email1 as string) ?? '',
    email2: (d.email2 as string | null) ?? null,
    groupId: (d.groupId as string | null) ?? null,
    isActive: typeof d.isActive === 'boolean' ? d.isActive : false,
    deactivatedAt: (d.deactivatedAt as string | null) ?? null,
    deactivatedBy: (d.deactivatedBy as string | null) ?? null,
  }
}

export async function getMemberData(
  userId: string,
  club: { isSetupDone: boolean; storageConfig: unknown },
): Promise<MemberData | null> {
  if (!club.isSetupDone) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.localData) return null
    return localDataToMemberData(userId, user.localData)
  }

  const credentials = getCredentials(club.storageConfig)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  return getMemberFromSheet({ credentials, masterSheetId, userId })
}

export async function getAllMemberData(
  userIds: string[],
  club: ClubForData,
): Promise<MemberData[]> {
  if (!club.isSetupDone) {
    const users = await prisma.user.findMany({
      where: { clubId: club.id, localData: { not: null } },
    })
    return users
      .filter((u) => userIds.includes(u.id))
      .flatMap((u) => {
        const data = localDataToMemberData(u.id, u.localData)
        return data ? [data] : []
      })
  }

  const credentials = getCredentials(club.storageConfig)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  const allMembers = await getAllMembersFromSheet({ credentials, masterSheetId })
  return allMembers.filter((m) => userIds.includes(m.userId))
}

export async function saveMemberData(data: MemberData, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.user.update({
      where: { id: data.userId },
      data: { localData: data as unknown as Record<string, unknown> },
    })
    return
  }

  const credentials = getCredentials(club.storageConfig)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  await writeMemberToSheet({ credentials, masterSheetId, data })
}

export async function updateMemberData(
  userId: string,
  updates: Partial<MemberData>,
  club: ClubForData,
): Promise<void> {
  if (!club.isSetupDone) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const existing = localDataToMemberData(userId, user?.localData) ?? ({} as MemberData)
    const merged = { ...existing, ...updates }
    await prisma.user.update({
      where: { id: userId },
      data: { localData: merged as unknown as Record<string, unknown> },
    })
    return
  }

  const credentials = getCredentials(club.storageConfig)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  await updateMemberInSheet({ credentials, masterSheetId, userId, updates })
}
