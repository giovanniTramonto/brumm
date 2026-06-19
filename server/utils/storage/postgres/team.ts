import type { Sql } from 'postgres'
import type { TeamData } from '~/types'

type Row = {
  team_id: string
  storage_id: string | null
  name: string | null
  email: string | null
}

function rowToTeamData(row: Row): TeamData {
  return {
    teamId: row.team_id,
    storageId: row.storage_id ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
  }
}

export async function pgGetTeamMember(sql: Sql, teamId: string): Promise<TeamData | null> {
  const rows = await sql<Row[]>`SELECT * FROM team_members WHERE team_id = ${teamId}`
  return rows[0] ? rowToTeamData(rows[0]) : null
}

export async function pgGetAllTeamMembers(sql: Sql): Promise<TeamData[]> {
  const rows = await sql<Row[]>`SELECT * FROM team_members ORDER BY name`
  return rows.map(rowToTeamData)
}

export async function pgSaveTeamMember(sql: Sql, data: TeamData): Promise<void> {
  await sql`
    INSERT INTO team_members (team_id, storage_id, name, email)
    VALUES (${data.teamId}, ${data.storageId}, ${data.name}, ${data.email})
    ON CONFLICT (team_id) DO UPDATE SET
      storage_id = EXCLUDED.storage_id,
      name       = EXCLUDED.name,
      email      = EXCLUDED.email
  `
}

export async function pgUpdateTeamMember(
  sql: Sql,
  teamId: string,
  updates: Partial<Pick<TeamData, 'name' | 'email'>>,
): Promise<void> {
  const existing = await pgGetTeamMember(sql, teamId)
  if (!existing) return
  await pgSaveTeamMember(sql, { ...existing, ...updates })
}

export async function pgDeleteTeamMember(sql: Sql, teamId: string): Promise<void> {
  await sql`DELETE FROM team_members WHERE team_id = ${teamId}`
}

export async function pgFindTeamMemberIdByEmail(sql: Sql, email: string): Promise<string | null> {
  const rows = await sql<{ team_id: string }[]>`
    SELECT team_id FROM team_members WHERE email = ${email} LIMIT 1
  `
  return rows[0]?.team_id ?? null
}
