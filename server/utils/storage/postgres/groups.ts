import type { Sql } from 'postgres'
import type { Group } from '~/types'

type Row = {
  group_id: string
  name: string | null
  email: string | null
}

function rowToGroup(row: Row): Group {
  return {
    id: row.group_id,
    name: row.name ?? '',
    email: row.email ?? null,
  }
}

export async function pgGetAllGroups(sql: Sql): Promise<Group[]> {
  const rows = await sql<Row[]>`SELECT * FROM groups ORDER BY name`
  return rows.map(rowToGroup)
}

export async function pgGetGroup(sql: Sql, groupId: string): Promise<Group | null> {
  const rows = await sql<Row[]>`SELECT * FROM groups WHERE group_id = ${groupId}`
  return rows[0] ? rowToGroup(rows[0]) : null
}

export async function pgCreateGroup(
  sql: Sql,
  groupId: string,
  params: { name: string; email?: string | null },
): Promise<Group> {
  await sql`
    INSERT INTO groups (group_id, name, email)
    VALUES (${groupId}, ${params.name.trim()}, ${params.email ?? null})
  `
  return { id: groupId, name: params.name.trim(), email: params.email ?? null }
}

export async function pgUpdateGroup(
  sql: Sql,
  groupId: string,
  updates: Partial<{ name: string; email: string | null }>,
): Promise<Group | null> {
  const existing = await pgGetGroup(sql, groupId)
  if (!existing) return null
  const merged = { ...existing, ...updates }
  await sql`
    UPDATE groups SET name = ${merged.name}, email = ${merged.email ?? null}
    WHERE group_id = ${groupId}
  `
  return merged
}

export async function pgDeleteGroup(sql: Sql, groupId: string): Promise<void> {
  await sql`DELETE FROM groups WHERE group_id = ${groupId}`
}
