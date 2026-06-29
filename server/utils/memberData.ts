import type { MemberData } from '~/types'
import { getClubDb } from './clubDatabase'
import {
  pgBatchUpdateMembers,
  pgDeleteMember,
  pgFindUserIdByEmail,
  pgGetAllMembers,
  pgGetAllMembersForClub,
  pgGetMember,
  pgSaveMember,
  pgUpdateMember,
} from './storage/postgres/members'

export async function getMemberData(
  userId: string,
  club: { id: string },
): Promise<MemberData | null> {
  const sql = await getClubDb(club.id)
  return pgGetMember(sql, userId)
}

export async function getAllMemberData(
  userIds: string[],
  club: { id: string },
): Promise<MemberData[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllMembers(sql, userIds)
}

export async function getAllMemberDataForClub(club: { id: string }): Promise<MemberData[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllMembersForClub(sql)
}

export async function saveMemberData(data: MemberData, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgSaveMember(sql, data)
}

export async function deleteMemberData(userId: string, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgDeleteMember(sql, userId)
}

export async function batchUpdateMembersData(
  updates: { userId: string; patch: Partial<MemberData> }[],
  club: { id: string },
  expectedLastEditedAt?: string | null,
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgBatchUpdateMembers(sql, updates, expectedLastEditedAt)
}

export async function updateMemberData(
  userId: string,
  updates: Partial<MemberData>,
  club: { id: string },
  expectedLastEditedAt?: string | null,
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgUpdateMember(sql, userId, updates, expectedLastEditedAt)
}

export async function findMemberIdByEmail(clubId: string, email: string): Promise<string | null> {
  const sql = await getClubDb(clubId)
  return pgFindUserIdByEmail(sql, email)
}
