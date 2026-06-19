import type { TeamData } from '~/types'
import { getClubDb } from './clubDatabase'
import {
  pgDeleteTeamMember,
  pgFindTeamMemberIdByEmail,
  pgGetAllTeamMembers,
  pgGetTeamMember,
  pgSaveTeamMember,
  pgUpdateTeamMember,
} from './storage/postgres/team'

export async function getTeamMemberData(
  teamId: string,
  club: { id: string },
): Promise<TeamData | null> {
  const sql = await getClubDb(club.id)
  return pgGetTeamMember(sql, teamId)
}

export async function getAllTeamMemberData(club: { id: string }): Promise<TeamData[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllTeamMembers(sql)
}

export async function saveTeamMemberData(data: TeamData, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgSaveTeamMember(sql, data)
}

export async function updateTeamMemberData(
  teamId: string,
  updates: Partial<Pick<TeamData, 'name' | 'email'>>,
  club: { id: string },
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgUpdateTeamMember(sql, teamId, updates)
}

export async function deleteTeamMemberData(teamId: string, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgDeleteTeamMember(sql, teamId)
}

export async function findTeamMemberIdByEmailPg(
  clubId: string,
  email: string,
): Promise<string | null> {
  const sql = await getClubDb(clubId)
  return pgFindTeamMemberIdByEmail(sql, email)
}
