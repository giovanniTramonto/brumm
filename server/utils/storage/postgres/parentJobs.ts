import type { Sql } from 'postgres'
import type { ParentJob, ParentJobMember } from '~/types'

type JobRow = { job_id: string; name: string }
type MemberRow = {
  member_id: string
  job_id: string
  email: string
  name: string | null
  phone: string | null
  is_leader: boolean
}

function rowToJob(row: JobRow): ParentJob {
  return { id: row.job_id, name: row.name }
}

function rowToMember(row: MemberRow): ParentJobMember {
  return {
    id: row.member_id,
    jobId: row.job_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    isLeader: row.is_leader,
  }
}

export async function pgGetAllParentJobs(sql: Sql): Promise<ParentJob[]> {
  const rows = await sql<JobRow[]>`SELECT * FROM parent_jobs ORDER BY name`
  return rows.map(rowToJob)
}

export async function pgGetParentJob(sql: Sql, jobId: string): Promise<ParentJob | null> {
  const rows = await sql<JobRow[]>`SELECT * FROM parent_jobs WHERE job_id = ${jobId}`
  return rows[0] ? rowToJob(rows[0]) : null
}

export async function pgGetParentJobWithMembers(
  sql: Sql,
  jobId: string,
): Promise<ParentJob | null> {
  const [jobs, members] = await Promise.all([
    sql<JobRow[]>`SELECT * FROM parent_jobs WHERE job_id = ${jobId}`,
    sql<
      MemberRow[]
    >`SELECT * FROM parent_job_members WHERE job_id = ${jobId} ORDER BY is_leader DESC`,
  ])
  if (!jobs[0]) return null
  return { ...rowToJob(jobs[0]), members: members.map(rowToMember) }
}

export async function pgGetAllParentJobsWithMembers(sql: Sql): Promise<ParentJob[]> {
  const [jobs, members] = await Promise.all([
    sql<JobRow[]>`SELECT * FROM parent_jobs ORDER BY name`,
    sql<MemberRow[]>`SELECT * FROM parent_job_members ORDER BY job_id, is_leader DESC`,
  ])
  const membersByJob = new Map<string, ParentJobMember[]>()
  for (const m of members) {
    const jm = membersByJob.get(m.job_id) ?? []
    jm.push(rowToMember(m))
    membersByJob.set(m.job_id, jm)
  }
  return jobs.map((j) => ({ ...rowToJob(j), members: membersByJob.get(j.job_id) ?? [] }))
}

export async function pgCreateParentJob(sql: Sql, jobId: string, name: string): Promise<ParentJob> {
  await sql`INSERT INTO parent_jobs (job_id, name) VALUES (${jobId}, ${name.trim()})`
  return { id: jobId, name: name.trim() }
}

export async function pgUpdateParentJob(
  sql: Sql,
  jobId: string,
  name: string,
): Promise<ParentJob | null> {
  const rows = await sql<
    JobRow[]
  >`UPDATE parent_jobs SET name = ${name.trim()} WHERE job_id = ${jobId} RETURNING *`
  return rows[0] ? rowToJob(rows[0]) : null
}

export async function pgDeleteParentJob(sql: Sql, jobId: string): Promise<void> {
  await sql`DELETE FROM parent_jobs WHERE job_id = ${jobId}`
}

export async function pgAddParentJobMember(
  sql: Sql,
  memberId: string,
  params: {
    jobId: string
    email: string
    name: string | null
    phone: string | null
    isLeader: boolean
  },
): Promise<ParentJobMember> {
  await sql`
    INSERT INTO parent_job_members (member_id, job_id, email, name, phone, is_leader)
    VALUES (${memberId}, ${params.jobId}, ${params.email}, ${params.name}, ${params.phone}, ${params.isLeader})
  `
  return {
    id: memberId,
    jobId: params.jobId,
    email: params.email,
    name: params.name,
    phone: params.phone,
    isLeader: params.isLeader,
  }
}

export async function pgUpdateParentJobMember(
  sql: Sql,
  jobId: string,
  memberId: string,
  isLeader: boolean,
): Promise<ParentJobMember | null> {
  const rows = await sql<
    MemberRow[]
  >`UPDATE parent_job_members SET is_leader = ${isLeader} WHERE member_id = ${memberId} AND job_id = ${jobId} RETURNING *`
  return rows[0] ? rowToMember(rows[0]) : null
}

export async function pgRemoveParentJobMember(
  sql: Sql,
  jobId: string,
  memberId: string,
): Promise<void> {
  await sql`DELETE FROM parent_job_members WHERE member_id = ${memberId} AND job_id = ${jobId}`
}

export async function pgSyncParentJobMemberContact(
  sql: Sql,
  params: { oldEmail: string; newEmail: string; name: string | null; phone: string | null },
): Promise<void> {
  await sql`
    UPDATE parent_job_members
    SET email = ${params.newEmail}, name = ${params.name}, phone = ${params.phone}
    WHERE email = ${params.oldEmail}
  `
}
