import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, OAuthTokens, TeamData } from '~/types'
import { createTeamStructure } from './storage/googleDrive'
import {
  createTeamSheet,
  getAllTeamMembersFromSheet,
  getTeamMemberFromSheet,
  removeTeamMemberFromSheet,
  updateTeamMemberInSheet,
  writeTeamMemberToSheet,
} from './storage/teamSheet'

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

function localDataToTeamData(teamId: string, localData: unknown): TeamData | null {
  if (!localData || typeof localData !== 'object') return null
  const d = localData as Record<string, unknown>
  return {
    teamId,
    storageId: (d.storageId as string) ?? '',
    name: (d.name as string) ?? '',
    email: (d.email as string) ?? '',
  }
}

async function ensureTeamStorage(club: ClubForData): Promise<GoogleDriveConfig> {
  const config = getStorageConfig(club.storageConfig)
  if (config.teamFolderId && config.teamSheetId) return config

  const tokens = getTokens(club.oauthToken)
  const { teamFolderId } = await createTeamStructure({ tokens, rootFolderId: config.rootFolderId })
  const teamSheetId = await createTeamSheet({ tokens, teamFolderId })

  const updated: GoogleDriveConfig = { ...config, teamFolderId, teamSheetId }
  await prisma.club.update({
    where: { id: club.id },
    data: { storageConfig: updated as unknown as Prisma.InputJsonValue },
  })
  return updated
}

export async function getTeamMemberData(
  teamId: string,
  club: ClubForData,
): Promise<TeamData | null> {
  if (!club.isSetupDone) {
    const member = await prisma.team.findUnique({ where: { id: teamId } })
    if (!member?.localData) return null
    return localDataToTeamData(teamId, member.localData)
  }

  const config = await ensureTeamStorage(club)
  if (!config.teamSheetId) return null
  const tokens = getTokens(club.oauthToken)
  return getTeamMemberFromSheet({ tokens, teamSheetId: config.teamSheetId, teamId })
}

export async function getAllTeamMemberData(club: ClubForData): Promise<TeamData[]> {
  if (!club.isSetupDone) {
    const members = await prisma.team.findMany({
      where: { clubId: club.id, localData: { not: Prisma.DbNull } },
    })
    return members.flatMap((m) => {
      const data = localDataToTeamData(m.id, m.localData)
      return data ? [data] : []
    })
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  if (!config.teamSheetId) return []

  const tokens = getTokens(club.oauthToken)
  return getAllTeamMembersFromSheet({ tokens, teamSheetId: config.teamSheetId })
}

export async function saveTeamMemberData(data: TeamData, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.team.update({
      where: { id: data.teamId },
      data: { localData: data as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const config = await ensureTeamStorage(club)
  if (!config.teamSheetId) return
  const tokens = getTokens(club.oauthToken)
  await writeTeamMemberToSheet({ tokens, teamSheetId: config.teamSheetId, data })
}

export async function updateTeamMemberData(
  teamId: string,
  updates: Partial<Pick<TeamData, 'name' | 'email'>>,
  club: ClubForData,
): Promise<void> {
  if (!club.isSetupDone) {
    const member = await prisma.team.findUnique({ where: { id: teamId } })
    const existing = localDataToTeamData(teamId, member?.localData) ?? ({} as TeamData)
    await prisma.team.update({
      where: { id: teamId },
      data: { localData: { ...existing, ...updates } as unknown as Prisma.InputJsonValue },
    })
    return
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  if (!config.teamSheetId) return

  const tokens = getTokens(club.oauthToken)
  await updateTeamMemberInSheet({ tokens, teamSheetId: config.teamSheetId, teamId, updates })
}

export async function deleteTeamMemberData(teamId: string, club: ClubForData): Promise<void> {
  if (!club.isSetupDone) {
    await prisma.team.update({
      where: { id: teamId },
      data: { localData: Prisma.DbNull },
    })
    return
  }

  const config = getStorageConfig(club.storageConfig) as GoogleDriveConfig
  const tokens = getTokens(club.oauthToken)

  if (config.teamSheetId) {
    await removeTeamMemberFromSheet({ tokens, teamSheetId: config.teamSheetId, teamId })
  }
}
