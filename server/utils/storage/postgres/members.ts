import type { Sql } from 'postgres'
import type { MemberData } from '~/types'

type Row = {
  user_id: string
  storage_ref: string | null
  first_name: string | null
  last_name: string | null
  birth_date: string | null
  guardian1_name: string | null
  guardian2_name: string | null
  email1: string | null
  email2: string | null
  group_id: string | null
  contract_end: string | null
  phone1: string | null
  phone2: string | null
  surcharges: string | null
  care_type: string | null
  last_edited_at: string | null
  last_edited_by: string | null
  address: string | null
}

function rowToMemberData(row: Row): MemberData {
  return {
    userId: row.user_id,
    storageRef: row.storage_ref ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    birthDate: row.birth_date ?? '',
    guardian1Name: row.guardian1_name,
    guardian2Name: row.guardian2_name,
    email1: row.email1 ?? '',
    email2: row.email2 ?? null,
    groupId: row.group_id ?? null,
    contractEnd: row.contract_end ?? null,
    phone1: row.phone1 ?? null,
    phone2: row.phone2 ?? null,
    surcharges: row.surcharges ? row.surcharges.split(',').filter(Boolean) : [],
    careType: row.care_type ?? null,
    lastEditedAt: row.last_edited_at ?? null,
    lastEditedBy: row.last_edited_by ?? null,
    address: row.address ?? null,
  }
}

export async function pgGetMember(sql: Sql, userId: string): Promise<MemberData | null> {
  const rows = await sql<Row[]>`SELECT * FROM members WHERE user_id = ${userId}`
  return rows[0] ? rowToMemberData(rows[0]) : null
}

export async function pgGetAllMembers(sql: Sql, userIds: string[]): Promise<MemberData[]> {
  if (userIds.length === 0) return []
  const pgArray = `{${userIds.join(',')}}`
  const rows = await sql<Row[]>`SELECT * FROM members WHERE user_id = ANY(${pgArray}::text[])`
  return rows.map(rowToMemberData)
}

export async function pgSaveMember(sql: Sql, data: MemberData): Promise<void> {
  await sql`
    INSERT INTO members (
      user_id, storage_ref, first_name, last_name, birth_date,
      guardian1_name, guardian2_name, email1, email2, group_id,
      contract_end, phone1, phone2, surcharges, care_type,
      last_edited_at, last_edited_by, address
    ) VALUES (
      ${data.userId}, ${data.storageRef}, ${data.firstName}, ${data.lastName}, ${data.birthDate},
      ${data.guardian1Name}, ${data.guardian2Name}, ${data.email1}, ${data.email2 ?? null},
      ${data.groupId ?? null}, ${data.contractEnd ?? null}, ${data.phone1 ?? null},
      ${data.phone2 ?? null}, ${data.surcharges.join(',')}, ${data.careType ?? null},
      ${data.lastEditedAt ?? null}, ${data.lastEditedBy ?? null}, ${data.address ?? null}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      storage_ref    = EXCLUDED.storage_ref,
      first_name     = EXCLUDED.first_name,
      last_name      = EXCLUDED.last_name,
      birth_date     = EXCLUDED.birth_date,
      guardian1_name = EXCLUDED.guardian1_name,
      guardian2_name = EXCLUDED.guardian2_name,
      email1         = EXCLUDED.email1,
      email2         = EXCLUDED.email2,
      group_id       = EXCLUDED.group_id,
      contract_end   = EXCLUDED.contract_end,
      phone1         = EXCLUDED.phone1,
      phone2         = EXCLUDED.phone2,
      surcharges     = EXCLUDED.surcharges,
      care_type      = EXCLUDED.care_type,
      last_edited_at = EXCLUDED.last_edited_at,
      last_edited_by = EXCLUDED.last_edited_by,
      address        = EXCLUDED.address
  `
}

export async function pgDeleteMember(sql: Sql, userId: string): Promise<void> {
  // Remove guardian from parent jobs only if no sibling child still shares the same email
  await sql`
    DELETE FROM parent_job_members
    WHERE email IN (
      SELECT email1 FROM members WHERE user_id = ${userId}
      UNION
      SELECT email2 FROM members WHERE user_id = ${userId} AND email2 IS NOT NULL
    )
    AND email NOT IN (
      SELECT email1 FROM members WHERE user_id != ${userId}
      UNION
      SELECT email2 FROM members WHERE user_id != ${userId} AND email2 IS NOT NULL
    )
  `
  await sql`
    UPDATE parent_jobs SET contact_email = NULL, contact_type = NULL
    WHERE contact_type = 'PARENT'
    AND contact_email IN (
      SELECT email1 FROM members WHERE user_id = ${userId}
      UNION
      SELECT email2 FROM members WHERE user_id = ${userId} AND email2 IS NOT NULL
    )
    AND contact_email NOT IN (
      SELECT email1 FROM members WHERE user_id != ${userId}
      UNION
      SELECT email2 FROM members WHERE user_id != ${userId} AND email2 IS NOT NULL
    )
  `
  await sql`DELETE FROM members WHERE user_id = ${userId}`
}

export async function pgUpdateMember(
  sql: Sql,
  userId: string,
  updates: Partial<MemberData>,
  expectedLastEditedAt?: string | null,
): Promise<void> {
  if (expectedLastEditedAt !== undefined) {
    const current = await sql<{ last_edited_at: string | null }[]>`
      SELECT last_edited_at FROM members WHERE user_id = ${userId}
    `
    if (current[0]?.last_edited_at !== expectedLastEditedAt) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Die Daten wurden zwischenzeitlich geändert. Bitte Seite neu laden.',
      })
    }
  }

  const existing = await pgGetMember(sql, userId)
  if (!existing) return
  await pgSaveMember(sql, { ...existing, ...updates })
}

export async function pgBatchUpdateMembers(
  sql: Sql,
  updates: { userId: string; patch: Partial<MemberData> }[],
  expectedLastEditedAt?: string | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    for (let i = 0; i < updates.length; i++) {
      const { userId, patch } = updates[i]
      await pgUpdateMember(
        tx as unknown as Sql,
        userId,
        patch,
        i === 0 ? expectedLastEditedAt : undefined,
      )
    }
  })
}

export async function pgGetAllMembersForClub(sql: Sql): Promise<MemberData[]> {
  const rows = await sql<Row[]>`SELECT * FROM members`
  return rows.map(rowToMemberData)
}

export async function pgFindUserIdByEmail(sql: Sql, email: string): Promise<string | null> {
  const rows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM members WHERE email1 = ${email} OR email2 = ${email} LIMIT 1
  `
  return rows[0]?.user_id ?? null
}
