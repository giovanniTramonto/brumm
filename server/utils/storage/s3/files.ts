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
  // Only strip chars that are problematic in S3 keys or HTTP: path separators and control chars
  return filename.replace(/[/\\<>:"|?*]/g, '-').replace(/-+/g, '-') || 'file'
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
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
  )
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
