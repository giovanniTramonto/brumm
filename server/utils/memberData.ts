import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, MemberData, OAuthTokens } from '~/types'
import { withGoogleErrorHandling } from './googleAuth'
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
    surcharges: Array.isArray(d.surcharges) ? (d.surcharges as string[]) : [],
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
  const sheetData = await withGoogleErrorHandling(() =>
    getMemberFromSheet({ tokens, masterSheetId, userId }),
  )
  if (sheetData) return sheetData

  // Fallback: member was created before storage setup and still has localData
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.localData) return null
  return localDataToMemberData(userId, user.localData)
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
  const allMembers = await withGoogleErrorHandling(() =>
    getAllMembersFromSheet({ tokens, masterSheetId }),
  )
  const sheetMembers = allMembers.filter((m) => userIds.includes(m.userId))
  const sheetUserIds = new Set(sheetMembers.map((m) => m.userId))

  // Fallback: members created before storage setup still have localData instead of a sheet row
  const localFallbackUsers = await prisma.user.findMany({
    where: {
      id: { in: userIds.filter((id) => !sheetUserIds.has(id)) },
      localData: { not: Prisma.DbNull },
    },
  })
  const localFallback = localFallbackUsers.flatMap((u) => {
    const data = localDataToMemberData(u.id, u.localData)
    return data ? [data] : []
  })

  return [...sheetMembers, ...localFallback]
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
  await withGoogleErrorHandling(() => writeMemberToSheet({ tokens, masterSheetId, data }))
}

export async function deleteMemberData(userId: string, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.user.update({
      where: { id: userId },
      data: { localData: Prisma.DbNull },
    })
    return
  }

  const tokens = getTokens(club.oauthToken)
  const masterSheetId = getMasterSheetId(club.storageConfig)
  const memberData = await withGoogleErrorHandling(() =>
    getMemberFromSheet({ tokens, masterSheetId, userId }),
  )
  if (memberData) {
    await withGoogleErrorHandling(() =>
      removeMemberFromMasterSheet({ tokens, masterSheetId, storageRef: memberData.storageRef }),
    )
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
  await withGoogleErrorHandling(() =>
    updateMemberInSheet({ tokens, masterSheetId, userId, updates }),
  )
}
