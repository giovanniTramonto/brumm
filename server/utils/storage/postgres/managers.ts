import type { Sql } from 'postgres'
import type { ManagerData } from '~/types'

type Row = {
  manager_id: string
  storage_id: string | null
  name: string | null
  email: string | null
}

function rowToManagerData(row: Row): ManagerData {
  return {
    managerId: row.manager_id,
    storageId: row.storage_id ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
  }
}

export async function pgGetManager(sql: Sql, managerId: string): Promise<ManagerData | null> {
  const rows = await sql<Row[]>`SELECT * FROM managers WHERE manager_id = ${managerId}`
  return rows[0] ? rowToManagerData(rows[0]) : null
}

export async function pgGetAllManagers(sql: Sql): Promise<ManagerData[]> {
  const rows = await sql<Row[]>`SELECT * FROM managers ORDER BY name`
  return rows.map(rowToManagerData)
}

export async function pgSaveManager(sql: Sql, data: ManagerData): Promise<void> {
  await sql`
    INSERT INTO managers (manager_id, storage_id, name, email)
    VALUES (${data.managerId}, ${data.storageId}, ${data.name}, ${data.email})
    ON CONFLICT (manager_id) DO UPDATE SET
      storage_id = EXCLUDED.storage_id,
      name       = EXCLUDED.name,
      email      = EXCLUDED.email
  `
}

export async function pgUpdateManager(
  sql: Sql,
  managerId: string,
  updates: Partial<Pick<ManagerData, 'name' | 'email'>>,
): Promise<void> {
  const existing = await pgGetManager(sql, managerId)
  if (!existing) return
  await pgSaveManager(sql, { ...existing, ...updates })
}

export async function pgDeleteManager(sql: Sql, managerId: string): Promise<void> {
  await sql`DELETE FROM managers WHERE manager_id = ${managerId}`
}

export async function pgFindManagerIdByEmail(sql: Sql, email: string): Promise<string | null> {
  const rows = await sql<{ manager_id: string }[]>`
    SELECT manager_id FROM managers WHERE email = ${email} LIMIT 1
  `
  return rows[0]?.manager_id ?? null
}
