import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'
import postgres from 'postgres'
import { decrypt } from '../../server/utils/encryption'

const prisma = new PrismaClient()

async function deleteS3MemberFiles(clubId: string, memberId: string): Promise<void> {
  const record = await prisma.clubFileStorage.findUnique({ where: { clubId } })
  if (!record?.encryptedConfig) return

  const config = JSON.parse(decrypt(record.encryptedConfig)) as {
    endpoint?: string
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  }

  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  })

  const prefix = `members/${memberId}/`
  const list = await client.send(
    new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix }),
  )
  const keys = (list.Contents ?? [])
    .filter((o): o is typeof o & { Key: string } => !!o.Key)
    .map((o) => ({ Key: o.Key }))

  if (keys.length > 0) {
    await client.send(
      new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: keys } }),
    )
  }
}

async function deleteMemberFromClubDb(clubId: string, userId: string): Promise<void> {
  const record = await prisma.clubDatabase.findUnique({ where: { clubId } })
  if (!record?.encryptedDsn) return

  const dsn = decrypt(record.encryptedDsn)
  const sql = postgres(dsn, { max: 1, idle_timeout: 10, ssl: { rejectUnauthorized: false } })
  try {
    await sql`DELETE FROM members WHERE user_id = ${userId}`
  } finally {
    await sql.end()
  }
}

export default async function handler() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const expiredUsers = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'DEACTIVATED',
      deactivatedAt: { lte: oneYearAgo },
    },
    select: { id: true, clubId: true },
  })

  console.log(`DSGVO-Cleanup: ${expiredUsers.length} Mitglieder zu bereinigen`)

  let cleaned = 0

  for (const user of expiredUsers) {
    try {
      await Promise.allSettled([
        deleteS3MemberFiles(user.clubId, user.id),
        deleteMemberFromClubDb(user.clubId, user.id),
      ])

      await prisma.deviceSession.deleteMany({ where: { userId: user.id } })
      await prisma.session.deleteMany({ where: { userId: user.id } })
      await prisma.magicLink.deleteMany({ where: { userId: user.id } })
      await prisma.invite.deleteMany({ where: { userId: user.id } })
      await prisma.memberDocument.deleteMany({ where: { memberId: user.id } })
      await prisma.userEmail.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })

      cleaned++
      console.log(`Bereinigt: user.id=${user.id}`)
    } catch (err) {
      console.error(`Fehler bei user.id=${user.id}:`, err)
    }
  }

  console.log(`DSGVO-Cleanup: ${cleaned} Mitglieder bereinigt`)

  const deletedDeviceSessions = await prisma.deviceSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  console.log(`Cleanup: ${deletedDeviceSessions.count} abgelaufene DeviceSessions gelöscht`)

  await prisma.$disconnect()

  return {
    statusCode: 200,
    body: JSON.stringify({ cleaned }),
  }
}
