import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, MemberData, OAuthTokens } from '~/types'
import {
  getAllMembersFromSheet,
  getMemberFromSheet,
  removeMemberFromMasterSheet,
  updateMemberInSheet,
  writeMemberToSheet,
} from './storage/sheets'

type ClubForData = {
  isSetupDone: boolean
  storageConfig: unknown
  oauthToken: unknown
  id: string
}

function getTokens(oauthToken: unknown): OAuthTokens {
  return oauthToken as OAuthTokens
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
    phone1: (d.phone1 as string | null) ?? null,
    phone2: (d.phone2 as string | null) ?? null,
    groupId: (d.groupId as string | null) ?? null,
    isActive: typeof d.isActive === 'boolean' ? d.isActive : false,
    deactivatedAt: (d.deactivatedAt as string | null) ?? null,
    deactivatedBy: (d.deactivatedBy as string | null) ?? null,
    contractEnd: (d.contractEnd as string | null) ?? null,
  }
}

export async function getMemberData(
  userId: string,
  club: { isSetupDone: boolean; storageConfig: unknown; oauthToken: unknown },
): Promise<MemberData | null> {
  if (!club.isSetupDone) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.localData) return null
    return localDataToMemberData(userId, user.localData)
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  return getMemberFromSheet({ tokens, masterSheetId, userId })
}

export async function getAllMemberData(
  userIds: string[],
  club: ClubForData,
): Promise<MemberData[]> {
  if (!club.isSetupDone) {
    const users = await prisma.user.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    return users
      .filter((u) => userIds.includes(u.id))
      .flatMap((u) => {
        const data = localDataToMemberData(u.id, u.localData)
        return data ? [data] : []
      })
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  const allMembers = await getAllMembersFromSheet({ tokens, masterSheetId })
  return allMembers.filter((m) => userIds.includes(m.userId))
}

export async function saveMemberData(data: MemberData, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.user.update({
      where: { id: data.userId },
      data: { localData: data as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  await writeMemberToSheet({ tokens, masterSheetId, data })
}

export async function deleteMemberData(
  userId: string,
  club: ClubForData,
): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.user.update({
      where: { id: userId },
      data: { localData: Prisma.DbNull },
    })
    return
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  const memberData = await getMemberFromSheet({ tokens, masterSheetId, userId })
  if (memberData) {
    await removeMemberFromMasterSheet({ tokens, masterSheetId, storageRef: memberData.storageRef })
  }
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
      data: { localData: merged as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  await updateMemberInSheet({ tokens, masterSheetId, userId, updates })
}
