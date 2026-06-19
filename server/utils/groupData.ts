import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { GoogleDriveConfig, Group, GroupData, OAuthTokens } from '~/types'
import { getClubDb, getClubDbType } from './clubDatabase'
import { createGroupsStructure } from './storage/googleDrive'
import {
  createGroupsSheet,
  getAllGroupsFromSheet,
  removeGroupFromSheet,
  updateGroupInSheet,
  writeGroupToSheet,
} from './storage/groupsSheet'
import {
  pgCreateGroup,
  pgDeleteGroup,
  pgGetAllGroups,
  pgGetGroup,
  pgUpdateGroup,
} from './storage/postgres/groups'

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

function groupDataToGroup(data: GroupData): Group {
  return { id: data.groupId, name: data.name, email: data.email }
}

type GroupsConfig = GoogleDriveConfig & { groupsFolderId: string; groupsSheetId: string }

async function ensureGroupsStorage(club: ClubForData): Promise<GroupsConfig> {
  const config = getStorageConfig(club.storageConfig)
  if (config.groupsFolderId && config.groupsSheetId) {
    return config as GroupsConfig
  }

  const tokens = getTokens(club.oauthToken)
  const { groupsFolderId } = await createGroupsStructure({
    tokens,
    rootFolderId: config.rootFolderId,
  })
  const groupsSheetId = await createGroupsSheet({ tokens, groupsFolderId })

  const updated: GroupsConfig = { ...config, groupsFolderId, groupsSheetId }
  await prisma.club.update({
    where: { id: club.id },
    data: { storageConfig: updated as unknown as Prisma.InputJsonValue },
  })
  return updated
}

export async function getAllGroups(club: ClubForData): Promise<Group[]> {
  if ((await getClubDbType(club.id)) === 'POSTGRES') {
    const sql = await getClubDb(club.id)
    return pgGetAllGroups(sql)
  }

  const config = await ensureGroupsStorage(club)
  const tokens = getTokens(club.oauthToken)
  const rows = await getAllGroupsFromSheet({ tokens, groupsSheetId: config.groupsSheetId })
  return rows.map(groupDataToGroup).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createGroup(
  club: ClubForData,
  params: { name: string; email?: string | null },
): Promise<Group> {
  if ((await getClubDbType(club.id)) === 'POSTGRES') {
    const sql = await getClubDb(club.id)
    return pgCreateGroup(sql, createId(), params)
  }

  const config = await ensureGroupsStorage(club)
  const tokens = getTokens(club.oauthToken)
  const data: GroupData = {
    groupId: createId(),
    name: params.name.trim(),
    email: params.email || null,
  }
  await writeGroupToSheet({ tokens, groupsSheetId: config.groupsSheetId, data })
  return groupDataToGroup(data)
}

export async function getGroup(club: ClubForData, groupId: string): Promise<Group | null> {
  if ((await getClubDbType(club.id)) === 'POSTGRES') {
    const sql = await getClubDb(club.id)
    return pgGetGroup(sql, groupId)
  }

  const config = await ensureGroupsStorage(club)
  const tokens = getTokens(club.oauthToken)
  const rows = await getAllGroupsFromSheet({ tokens, groupsSheetId: config.groupsSheetId })
  const found = rows.find((r) => r.groupId === groupId)
  return found ? groupDataToGroup(found) : null
}

export async function updateGroup(
  club: ClubForData,
  groupId: string,
  updates: Partial<Pick<GroupData, 'name' | 'email'>>,
): Promise<Group | null> {
  if ((await getClubDbType(club.id)) === 'POSTGRES') {
    const sql = await getClubDb(club.id)
    return pgUpdateGroup(sql, groupId, updates)
  }

  const config = await ensureGroupsStorage(club)
  const tokens = getTokens(club.oauthToken)
  await updateGroupInSheet({ tokens, groupsSheetId: config.groupsSheetId, groupId, updates })
  return getGroup(club, groupId)
}

export async function deleteGroup(club: ClubForData, groupId: string): Promise<void> {
  if ((await getClubDbType(club.id)) === 'POSTGRES') {
    const sql = await getClubDb(club.id)
    await pgDeleteGroup(sql, groupId)
    return
  }

  const config = await ensureGroupsStorage(club)
  const tokens = getTokens(club.oauthToken)
  await removeGroupFromSheet({ tokens, groupsSheetId: config.groupsSheetId, groupId })
}
