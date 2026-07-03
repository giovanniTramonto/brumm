import { createId } from '@paralleldrive/cuid2'
import type { ParentJob, ParentJobMember } from '~/types'
import { getClubDb } from './clubDatabase'
import {
  pgAddParentJobMember,
  pgCreateParentJob,
  pgDeleteParentJob,
  pgGetAllParentJobs,
  pgGetAllParentJobsWithMembers,
  pgGetParentJob,
  pgGetParentJobWithMembers,
  pgRemoveParentJobMember,
  pgReorderParentJobMembers,
  pgReorderParentJobs,
  pgSyncParentJobMemberContact,
  pgUpdateParentJob,
  pgUpdateParentJobMember,
} from './storage/postgres/parentJobs'

export async function getAllParentJobs(club: { id: string }): Promise<ParentJob[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllParentJobs(sql)
}

export async function getAllParentJobsWithMembers(club: { id: string }): Promise<ParentJob[]> {
  const sql = await getClubDb(club.id)
  return pgGetAllParentJobsWithMembers(sql)
}

export async function getParentJob(club: { id: string }, jobId: string): Promise<ParentJob | null> {
  const sql = await getClubDb(club.id)
  return pgGetParentJob(sql, jobId)
}

export async function getParentJobWithMembers(
  club: { id: string },
  jobId: string,
): Promise<ParentJob | null> {
  const sql = await getClubDb(club.id)
  return pgGetParentJobWithMembers(sql, jobId)
}

export async function createParentJob(club: { id: string }, name: string): Promise<ParentJob> {
  const sql = await getClubDb(club.id)
  return pgCreateParentJob(sql, createId(), name)
}

export async function updateParentJob(
  club: { id: string },
  jobId: string,
  name: string,
): Promise<ParentJob | null> {
  const sql = await getClubDb(club.id)
  return pgUpdateParentJob(sql, jobId, name)
}

export async function deleteParentJob(club: { id: string }, jobId: string): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgDeleteParentJob(sql, jobId)
}

export async function reorderParentJobs(club: { id: string }, ids: string[]): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgReorderParentJobs(sql, ids)
}

export async function addParentJobMember(
  club: { id: string },
  params: {
    jobId: string
    email: string
    name: string | null
    phone: string | null
    tasks: string | null
    isLeader: boolean
  },
): Promise<ParentJobMember> {
  const sql = await getClubDb(club.id)
  return pgAddParentJobMember(sql, createId(), params)
}

export async function updateParentJobMember(
  club: { id: string },
  jobId: string,
  memberId: string,
  params: { isLeader?: boolean; tasks?: string | null },
): Promise<ParentJobMember | null> {
  const sql = await getClubDb(club.id)
  return pgUpdateParentJobMember(sql, jobId, memberId, params)
}

export async function removeParentJobMember(
  club: { id: string },
  jobId: string,
  memberId: string,
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgRemoveParentJobMember(sql, jobId, memberId)
}

export async function reorderParentJobMembers(
  club: { id: string },
  jobId: string,
  ids: string[],
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgReorderParentJobMembers(sql, jobId, ids)
}

export async function syncParentJobMemberContact(
  club: { id: string },
  params: { oldEmail: string; newEmail: string; name: string | null; phone: string | null },
): Promise<void> {
  const sql = await getClubDb(club.id)
  await pgSyncParentJobMemberContact(sql, params)
}
