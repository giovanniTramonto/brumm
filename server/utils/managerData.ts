import type { ManagerData } from '~/types'
import { getClubDb } from './clubDatabase'
import {
  pgDeleteManager,
  pgFindManagerIdByEmail,
  pgGetAllManagers,
  pgGetManager,
  pgSaveManager,
  pgUpdateManager,
} from './storage/postgres/managers'

export async function getManagerData(
  managerId: string,
  club: { id: string },
): Promise<ManagerData | null> {
  const sql = await getClubDb(club.id)
  return pgGetManager(sql, managerId)
}

export async function getAllManagerData(club: { id: string }): Promise<ManagerData[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllManagers(sql)
}

export async function saveManagerData(data: ManagerData, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgSaveManager(sql, data)
}

export async function updateManagerData(
  managerId: string,
  updates: Partial<Pick<ManagerData, 'name' | 'email'>>,
  club: { id: string },
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgUpdateManager(sql, managerId, updates)
}

export async function deleteManagerData(managerId: string, club: { id: string }): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgDeleteManager(sql, managerId)
}

export async function findManagerIdByEmailPg(
  clubId: string,
  email: string,
): Promise<string | null> {
  const sql = await getClubDb(clubId)
  return pgFindManagerIdByEmail(sql, email)
}
