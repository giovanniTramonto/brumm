import { createId } from '@paralleldrive/cuid2'
import type { Group, GroupData } from '~/types'
import { getClubDb } from './clubDatabase'
import {
  pgCreateGroup,
  pgDeleteGroup,
  pgGetAllGroups,
  pgGetGroup,
  pgUpdateGroup,
} from './storage/postgres/groups'

export async function getAllGroups(club: { id: string }): Promise<Group[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllGroups(sql)
}

export async function createGroup(
  club: { id: string },
  params: { name: string; email?: string | null },
): Promise<Group> {
  const sql = await getClubDb(club.id)
  return pgCreateGroup(sql, createId(), params)
}

export async function getGroup(club: { id: string }, groupId: string): Promise<Group | null> {
  const sql = await getClubDb(club.id)
  return pgGetGroup(sql, groupId)
}

export async function updateGroup(
  club: { id: string },
  groupId: string,
  updates: Partial<Pick<GroupData, 'name' | 'email'>>,
): Promise<Group | null> {
  const sql = await getClubDb(club.id)
  return pgUpdateGroup(sql, groupId, updates)
}

export async function deleteGroup(club: { id: string }, groupId: string): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgDeleteGroup(sql, groupId)
}
