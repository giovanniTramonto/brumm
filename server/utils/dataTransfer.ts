import postgres from 'postgres'
import type { Group, ManagerData, MemberData, TeamData } from '~/types'
import { clientCache } from './clubDatabase'
import { decrypt } from './encryption'
import { getAllGroups } from './groupData'
import { getAllManagerData } from './managerData'
import { getAllMemberData } from './memberData'
import { runMigrations } from './migrations/runner'
import { prisma } from './prisma'
import { getAllTeamMemberData } from './teamData'

async function writeAllToSql(
  sql: ReturnType<typeof postgres>,
  data: { members: MemberData[]; managers: ManagerData[]; groups: Group[]; team: TeamData[] },
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const m of data.members) {
      await tx`
        INSERT INTO members (
          user_id, storage_ref, first_name, last_name, birth_date,
          guardian1_name, guardian2_name, email1, email2, group_id,
          contract_end, phone1, phone2, surcharges, care_type,
          last_edited_at, last_edited_by, address
        ) VALUES (
          ${m.userId}, ${m.storageRef}, ${m.firstName}, ${m.lastName},
          ${m.birthDate}, ${m.guardian1Name}, ${m.guardian2Name},
          ${m.email1}, ${m.email2 ?? null}, ${m.groupId ?? null},
          ${m.contractEnd ?? null}, ${m.phone1 ?? null}, ${m.phone2 ?? null},
          ${m.surcharges.join(',')}, ${m.careType ?? null},
          ${m.lastEditedAt ?? null}, ${m.lastEditedBy ?? null}, ${m.address ?? null}
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

    for (const mgr of data.managers) {
      await tx`
        INSERT INTO managers (manager_id, storage_id, name, email)
        VALUES (${mgr.managerId}, ${mgr.storageId}, ${mgr.name}, ${mgr.email})
        ON CONFLICT (manager_id) DO UPDATE SET
          storage_id = EXCLUDED.storage_id,
          name       = EXCLUDED.name,
          email      = EXCLUDED.email
      `
    }

    for (const g of data.groups) {
      await tx`
        INSERT INTO groups (group_id, name, email)
        VALUES (${g.id}, ${g.name}, ${g.email ?? null})
        ON CONFLICT (group_id) DO UPDATE SET
          name  = EXCLUDED.name,
          email = EXCLUDED.email
      `
    }

    for (const t of data.team) {
      await tx`
        INSERT INTO team_members (team_id, storage_id, name, email)
        VALUES (${t.teamId}, ${t.storageId}, ${t.name}, ${t.email})
        ON CONFLICT (team_id) DO UPDATE SET
          storage_id = EXCLUDED.storage_id,
          name       = EXCLUDED.name,
          email      = EXCLUDED.email
      `
    }
  })
}

// Sheets → Postgres (first-time setup): reads from pending DSN, swaps to active after transfer
export async function transferSheetsToPostgres(clubId: string): Promise<void> {
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId } })
  const record = await prisma.clubDatabase.findUniqueOrThrow({ where: { clubId } })

  if (!record.pendingEncryptedDsn) throw new Error('Kein ausstehender DSN.')

  const targetSql = postgres(decrypt(record.pendingEncryptedDsn), {
    max: 5,
    idle_timeout: 30,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await runMigrations(targetSql)

    const allUsers = await prisma.user.findMany({
      where: { clubId, role: 'MEMBER' },
      select: { id: true },
    })

    const [members, managers, groups, team] = await Promise.all([
      getAllMemberData(
        allUsers.map((u) => u.id),
        club,
      ),
      getAllManagerData(club),
      getAllGroups(club),
      getAllTeamMemberData(club),
    ])

    await writeAllToSql(targetSql, { members, managers, groups, team })

    await prisma.clubDatabase.update({
      where: { clubId },
      data: {
        type: 'POSTGRES',
        encryptedDsn: record.pendingEncryptedDsn,
        pendingEncryptedDsn: null,
      },
    })
    clientCache.delete(clubId)
  } finally {
    await targetSql.end()
  }
}

// Postgres → Postgres (DB migration)
export async function transferPostgresToPostgres(clubId: string): Promise<void> {
  const record = await prisma.clubDatabase.findUniqueOrThrow({ where: { clubId } })

  if (!record.encryptedDsn || !record.pendingEncryptedDsn) {
    throw new Error('Quell- oder Ziel-DSN fehlt.')
  }

  const sourceSql = await getClubDb(clubId)
  const targetDsn = decrypt(record.pendingEncryptedDsn)
  const targetSql = postgres(targetDsn, {
    max: 5,
    idle_timeout: 30,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // Apply migrations to target DB first
    await runMigrations(targetSql)

    // Read all data from source
    const [members, managers, groups, team] = await Promise.all([
      sourceSql<
        {
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
        }[]
      >`SELECT * FROM members`,
      sourceSql<
        {
          manager_id: string
          storage_id: string | null
          name: string | null
          email: string | null
        }[]
      >`SELECT * FROM managers`,
      sourceSql<
        { group_id: string; name: string | null; email: string | null }[]
      >`SELECT * FROM groups`,
      sourceSql<
        { team_id: string; storage_id: string | null; name: string | null; email: string | null }[]
      >`SELECT * FROM team_members`,
    ])

    // Write to target using mapped types
    const mappedMembers: MemberData[] = members.map((r) => ({
      userId: r.user_id,
      storageRef: r.storage_ref ?? '',
      firstName: r.first_name ?? '',
      lastName: r.last_name ?? '',
      birthDate: r.birth_date ?? '',
      guardian1Name: r.guardian1_name,
      guardian2Name: r.guardian2_name,
      email1: r.email1 ?? '',
      email2: r.email2 ?? null,
      groupId: r.group_id ?? null,
      contractEnd: r.contract_end ?? null,
      phone1: r.phone1 ?? null,
      phone2: r.phone2 ?? null,
      surcharges: r.surcharges ? r.surcharges.split(',').filter(Boolean) : [],
      careType: r.care_type ?? null,
      lastEditedAt: r.last_edited_at ?? null,
      lastEditedBy: r.last_edited_by ?? null,
      address: r.address ?? null,
    }))

    const mappedManagers: ManagerData[] = managers.map((r) => ({
      managerId: r.manager_id,
      storageId: r.storage_id ?? '',
      name: r.name ?? '',
      email: r.email ?? '',
    }))

    const mappedGroups: Group[] = groups.map((r) => ({
      id: r.group_id,
      name: r.name ?? '',
      email: r.email ?? null,
    }))

    const mappedTeam: TeamData[] = team.map((r) => ({
      teamId: r.team_id,
      storageId: r.storage_id ?? '',
      name: r.name ?? '',
      email: r.email ?? '',
    }))

    await writeAllToSql(targetSql, {
      members: mappedMembers,
      managers: mappedManagers,
      groups: mappedGroups,
      team: mappedTeam,
    })

    // Swap: pending becomes active
    await prisma.clubDatabase.update({
      where: { clubId },
      data: {
        encryptedDsn: record.pendingEncryptedDsn,
        pendingEncryptedDsn: null,
      },
    })

    // Invalidate client cache so next request uses the new DSN
    clientCache.delete(clubId)
  } finally {
    await targetSql.end()
  }
}
