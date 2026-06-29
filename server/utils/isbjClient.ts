import crypto from 'node:crypto'
import https from 'node:https'
import { decrypt } from './encryption'
import { prisma } from './prisma'

const agentCache = new Map<string, https.Agent>()

export function invalidateISBJCache(clubId: string) {
  agentCache.delete(clubId)
}

export async function getISBJConfig(clubId: string) {
  const record = await prisma.clubISBJConfig.findUnique({ where: { clubId } })
  if (!record) return null
  return {
    host: record.host,
    username: record.username,
    traegerNummer: record.traegerNummer,
    einrichtungsNummer: record.einrichtungsNummer,
    apiKey: decrypt(record.encryptedApiKey),
    cert: Buffer.from(decrypt(record.encryptedCert), 'base64'),
    certPassphrase: decrypt(record.encryptedCertPass),
  }
}

function getOrCreateAgent(clubId: string, cert: Buffer, certPassphrase: string) {
  const cached = agentCache.get(clubId)
  if (cached) return cached
  const agent = new https.Agent({ pfx: cert, passphrase: certPassphrase })
  agentCache.set(clubId, agent)
  return agent
}

function buildHeaders(
  method: string,
  path: string,
  body: string,
  username: string,
  apiKey: string,
) {
  const date = new Date().toUTCString()
  const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')
  const message = [method.toUpperCase(), path, bodyMd5, date].join('\n')
  const hmac = crypto.createHmac('sha256', apiKey).update(message).digest('base64')
  return {
    Authorization: `HMAC ${username}:${hmac}`,
    Date: date,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function isbjFetch<T = unknown>(
  clubId: string,
  method: string,
  path: string,
  body?: object,
): Promise<T> {
  const config = await getISBJConfig(clubId)
  if (!config) throw createError({ statusCode: 503, statusMessage: 'ISBJ nicht konfiguriert.' })

  const agent = getOrCreateAgent(clubId, config.cert, config.certPassphrase)
  const bodyStr = body ? JSON.stringify(body) : ''
  const headers = buildHeaders(method, path, bodyStr, config.username, config.apiKey)

  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: config.host, path, method, headers, agent }, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(createError({ statusCode: res.statusCode, statusMessage: data || 'ISBJ-Fehler' }))
          return
        }
        try {
          resolve(JSON.parse(data) as T)
        } catch {
          resolve(data as unknown as T)
        }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}
