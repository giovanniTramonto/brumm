import { S3Client } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import { decrypt } from './encryption'
import { prisma } from './prisma'

type S3Config = {
  endpoint?: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export type CachedS3 = { client: S3Client; bucket: string }
const cache = new Map<string, CachedS3>()

export async function getClubS3(clubId: string): Promise<CachedS3> {
  const hit = cache.get(clubId)
  if (hit) return hit

  const record = await prisma.club.findUnique({
    where: { id: clubId },
    select: { encryptedS3Config: true },
  })
  if (!record?.encryptedS3Config) {
    throw createError({ statusCode: 503, statusMessage: 'S3 nicht konfiguriert' })
  }

  const config = JSON.parse(decrypt(record.encryptedS3Config)) as S3Config
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  })

  const entry: CachedS3 = { client, bucket: config.bucket }
  cache.set(clubId, entry)
  return entry
}

export function invalidateS3Cache(clubId: string): void {
  cache.delete(clubId)
}
