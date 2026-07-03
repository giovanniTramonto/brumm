import type { Sql } from 'postgres'
import type { ParentJob, ParentJobMember } from '~/types'

type JobRow = { job_id: string; name: string; sort_order: number }
type MemberRow = {
  member_id: string
  job_id: string
  email: string
  name: string | null
  phone: string | null
  tasks: string | null
  is_leader: boolean
  sort_order: number
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
    tasks: row.tasks,
    isLeader: row.is_leader,
  }
}

export async function pgGetAllParentJobs(sql: Sql): Promise<ParentJob[]> {
  const rows = await sql<JobRow[]>`SELECT * FROM parent_jobs ORDER BY sort_order, name`
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
    sql<MemberRow[]>`SELECT * FROM parent_job_members WHERE job_id = ${jobId} ORDER BY sort_order`,
  ])
  if (!jobs[0]) return null
  return { ...rowToJob(jobs[0]), members: members.map(rowToMember) }
}

export async function pgGetAllParentJobsWithMembers(sql: Sql): Promise<ParentJob[]> {
  const [jobs, members] = await Promise.all([
    sql<JobRow[]>`SELECT * FROM parent_jobs ORDER BY sort_order, name`,
    sql<MemberRow[]>`SELECT * FROM parent_job_members ORDER BY sort_order`,
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
  const [{ max }] = await sql<
    [{ max: number }]
  >`SELECT COALESCE(MAX(sort_order), -1) AS max FROM parent_jobs`
  const sortOrder = max + 1
  await sql`INSERT INTO parent_jobs (job_id, name, sort_order) VALUES (${jobId}, ${name.trim()}, ${sortOrder})`
  return { id: jobId, name: name.trim() }
}

export async function pgReorderParentJobs(sql: Sql, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, index) => sql`UPDATE parent_jobs SET sort_order = ${index} WHERE job_id = ${id}`),
  )
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
    tasks: string | null
    isLeader: boolean
  },
): Promise<ParentJobMember> {
  const [{ max }] = await sql<
    [{ max: number }]
  >`SELECT COALESCE(MAX(sort_order), -1) AS max FROM parent_job_members WHERE job_id = ${params.jobId}`
  const sortOrder = max + 1
  await sql`
    INSERT INTO parent_job_members (member_id, job_id, email, name, phone, tasks, is_leader, sort_order)
    VALUES (${memberId}, ${params.jobId}, ${params.email}, ${params.name}, ${params.phone}, ${params.tasks}, ${params.isLeader}, ${sortOrder})
  `
  return {
    id: memberId,
    jobId: params.jobId,
    email: params.email,
    name: params.name,
    phone: params.phone,
    tasks: params.tasks,
    isLeader: params.isLeader,
  }
}

export async function pgReorderParentJobMembers(
  sql: Sql,
  jobId: string,
  ids: string[],
): Promise<void> {
  await Promise.all(
    ids.map(
      (id, index) =>
        sql`UPDATE parent_job_members SET sort_order = ${index} WHERE member_id = ${id} AND job_id = ${jobId}`,
    ),
  )
}

export async function pgUpdateParentJobMember(
  sql: Sql,
  jobId: string,
  memberId: string,
  params: { isLeader?: boolean; tasks?: string | null },
): Promise<ParentJobMember | null> {
  const rows = await sql<MemberRow[]>`
    UPDATE parent_job_members SET
      is_leader = COALESCE(${params.isLeader ?? null}, is_leader),
      tasks = CASE WHEN ${params.tasks !== undefined} THEN ${params.tasks ?? null} ELSE tasks END
    WHERE member_id = ${memberId} AND job_id = ${jobId}
    RETURNING *
  `
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
