import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createId } from '@paralleldrive/cuid2'
import { getClubS3 } from '../../s3Client'

// S3 keys contain slashes and are not URL-safe as route params.
// We encode/decode them as base64url for use in URLs and DB storage.
export function encodeS3FileId(key: string): string {
  return Buffer.from(key).toString('base64url')
}

export function decodeS3FileId(fileId: string): string {
  return Buffer.from(fileId, 'base64url').toString('utf-8')
}

export function sanitizeFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : ''
  const base = (dotIndex > 0 ? filename.slice(0, dotIndex) : filename)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '') // strip combining diacritics (é→e etc.)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._()-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
  return base + ext || 'file'
}

export async function s3UploadFile(
  clubId: string,
  prefix: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ fileId: string; key: string }> {
  const { client, bucket } = await getClubS3(clubId)
  const uid = createId()
  const key = `${prefix}/${uid}/${sanitizeFilename(filename)}`
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
    )
  } catch (err) {
    const code = err instanceof Error ? err.name : ''
    const s3Messages: Record<string, string> = {
      InvalidAccessKeyId: 'S3 Access Key ungültig',
      SignatureDoesNotMatch: 'S3 Secret Key ungültig',
      NoSuchBucket: 'Bucket nicht gefunden',
      AccessDenied: 'Zugriff verweigert',
      EntityTooLarge: 'Datei zu groß',
      RequestTimeout: 'Zeitüberschreitung',
      SlowDown: 'Zu viele Anfragen',
      ServiceUnavailable: 'Speicher nicht erreichbar',
    }
    const message = s3Messages[code] ?? `Upload fehlgeschlagen (${code || 'Unbekannter Fehler'})`
    throw createError({ statusCode: 500, statusMessage: message })
  }
  return { fileId: encodeS3FileId(key), key }
}

export async function s3DeleteFile(clubId: string, key: string): Promise<void> {
  const { client, bucket } = await getClubS3(clubId)
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {
    // ignore if already deleted
  }
}

export async function s3DeleteByPrefix(clubId: string, prefix: string): Promise<void> {
  const { client, bucket } = await getClubS3(clubId)
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/` }))
  const keys = (list.Contents ?? [])
    .filter((o): o is typeof o & { Key: string } => !!o.Key)
    .map((o) => ({ Key: o.Key }))
  if (!keys.length) return
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }))
}

export async function s3GetPresignedUrl(clubId: string, key: string): Promise<string> {
  const { client, bucket } = await getClubS3(clubId)
  const filename = key.split('/').pop() ?? 'download'
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: 3600 },
  )
}

export async function s3CopyFile(
  clubId: string,
  sourceKey: string,
  destPrefix: string,
): Promise<{ fileId: string; key: string }> {
  const { client, bucket } = await getClubS3(clubId)
  const filename = sourceKey.split('/').pop() ?? 'document'
  const uid = createId()
  const destKey = `${destPrefix}/${uid}/${filename}`
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      Key: destKey,
    }),
  )
  return { fileId: encodeS3FileId(destKey), key: destKey }
}

export async function s3ListFiles(
  clubId: string,
  prefix: string,
): Promise<{ id: string; name: string; createdTime: string }[]> {
  const { client, bucket } = await getClubS3(clubId)
  const result = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/` }),
  )
  return (result.Contents ?? [])
    .filter((o): o is typeof o & { Key: string } => !!o.Key && !o.Key.endsWith('/'))
    .map((o) => ({
      id: encodeS3FileId(o.Key),
      name: o.Key.split('/').pop() ?? o.Key,
      createdTime: o.LastModified?.toISOString() ?? new Date().toISOString(),
    }))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
}
