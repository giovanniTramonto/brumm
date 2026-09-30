import crypto from 'node:crypto'
import https from 'node:https'
import tls from 'node:tls'
import { decrypt } from './encryption'
import { BERLIN_CLASS2_ROOT_CA } from './isbjCa'
import { prisma } from './prisma'

const REQUEST_TIMEOUT_MS = 20_000

const agentCache = new Map<string, https.Agent>()

export function getISBJDefaultHost(): string {
  return useRuntimeConfig().isbjDefaultHost
}

export function invalidateISBJCache(clubId: string) {
  agentCache.delete(clubId)
}

export async function getISBJConfig(clubId: string) {
  const record = await prisma.clubISBJConfig.findUnique({ where: { clubId } })
  if (!record) return null
  return {
    host: record.host ?? getISBJDefaultHost(),
    username: record.username,
    providerNumber: record.providerNumber,
    facilityNumber: record.facilityNumber,
    apiKey: decrypt(record.encryptedApiKey),
    cert: Buffer.from(decrypt(record.encryptedCert), 'base64'),
    certPassphrase: decrypt(record.encryptedCertPass),
  }
}

function getOrCreateAgent(clubId: string, cert: Buffer, certPassphrase: string) {
  const cached = agentCache.get(clubId)
  if (cached) return cached
  const agent = new https.Agent({
    pfx: cert,
    passphrase: certPassphrase,
    ca: [...tls.rootCertificates, BERLIN_CLASS2_ROOT_CA],
  })
  agentCache.set(clubId, agent)
  return agent
}

// See ISBJ Entwicklerleitfaden 4.1.2: HMAC-SHA256 over "METHOD\npath\nmd5(body)\ndate",
// keyed with the API key as-is, sent hex-encoded (the guide's prose says base64, but its
// worked example only matches hex). The "normalized path" excludes the query string —
// verified against ISBJ, which rejects signatures that include it.
function buildHeaders(
  method: string,
  path: string,
  body: string,
  username: string,
  apiKey: string,
) {
  const date = new Date().toUTCString()
  const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')
  const normalizedPath = path.split('?')[0] ?? path
  const message = [method.toUpperCase(), normalizedPath, bodyMd5, date].join('\n')
  const hmac = crypto.createHmac('sha256', apiKey).update(message).digest('hex')
  return {
    Authorization: `HMAC ${username}:${hmac}`,
    Date: date,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function toISBJError(err: unknown, host: string) {
  const code = (err as { code?: string })?.code ?? ''
  const message = err instanceof Error ? err.message : String(err)

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return createError({ statusCode: 502, statusMessage: `ISBJ-Host „${host}" nicht gefunden.` })
  }
  if (code === 'ECONNREFUSED') {
    return createError({ statusCode: 502, statusMessage: 'ISBJ hat die Verbindung abgelehnt.' })
  }
  if (code === 'ECONNRESET') {
    return createError({
      statusCode: 502,
      statusMessage:
        'ISBJ hat die Verbindung abgebrochen – vermutlich wurde das Client-Zertifikat nicht akzeptiert.',
    })
  }
  if (code === 'ETIMEDOUT') {
    return createError({
      statusCode: 504,
      statusMessage: 'ISBJ antwortet nicht (Zeitüberschreitung).',
    })
  }
  if (/mac verify failure|bad decrypt/i.test(message)) {
    return createError({ statusCode: 400, statusMessage: 'Zertifikat-Passwort ist falsch.' })
  }
  if (/unsupported/i.test(message)) {
    return createError({
      statusCode: 400,
      statusMessage: 'Zertifikat-Format wird nicht unterstützt (veraltete PKCS12-Verschlüsselung).',
    })
  }
  if (/certificate|self.signed|UNABLE_TO_VERIFY/i.test(`${code} ${message}`)) {
    return createError({
      statusCode: 502,
      statusMessage: `Serverzertifikat von ISBJ konnte nicht geprüft werden (${code || message}).`,
    })
  }
  if (/handshake|alert/i.test(message)) {
    return createError({
      statusCode: 502,
      statusMessage: 'ISBJ hat das Client-Zertifikat abgelehnt.',
    })
  }
  return createError({ statusCode: 502, statusMessage: `Verbindungsfehler: ${code || message}` })
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
    const fail = (err: unknown) => {
      invalidateISBJCache(clubId)
      reject(toISBJError(err, config.host))
    }
    let req: ReturnType<typeof https.request>
    try {
      // The PKCS12 is only parsed here (lazily), so a wrong passphrase throws synchronously
      req = https.request({ hostname: config.host, path, method, headers, agent }, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(
              createError({
                statusCode: res.statusCode,
                statusMessage: `ISBJ hat die Anmeldung abgelehnt (${res.statusCode}). Benutzername, API-Key oder Berechtigung „Dienstschnittstelle" prüfen.${data ? ` Antwort: ${data.slice(0, 300)}` : ''}`,
              }),
            )
            return
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              createError({
                statusCode: res.statusCode,
                statusMessage: `ISBJ-Fehler ${res.statusCode}${data ? `: ${data.slice(0, 300)}` : ''}`,
              }),
            )
            return
          }
          try {
            resolve(JSON.parse(data) as T)
          } catch {
            resolve(data as unknown as T)
          }
        })
      })
    } catch (err) {
      fail(err)
      return
    }
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    })
    req.on('error', fail)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}
