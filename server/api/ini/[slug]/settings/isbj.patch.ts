import { encrypt } from '~/server/utils/encryption'
import { invalidateISBJCache } from '~/server/utils/isbjClient'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Ungültige Anfrage' })

  const get = (name: string) =>
    parts
      .find((p) => p.name === name)
      ?.data.toString()
      .trim() || undefined
  const certPart = parts.find((p) => p.name === 'cert' && p.data.length > 0)

  const username = get('username')
  const traegerNummer = get('traegerNummer')
  const einrichtungsNummer = get('einrichtungsNummer')
  const apiKey = get('apiKey')
  const certPassphrase = get('certPassphrase')
  const host = get('host')

  const existing = await prisma.clubISBJConfig.findUnique({ where: { clubId: club.id } })

  if (!existing) {
    if (
      !username ||
      !traegerNummer ||
      !einrichtungsNummer ||
      !apiKey ||
      !certPart ||
      !certPassphrase
    ) {
      throw createError({ statusCode: 400, statusMessage: 'Alle Felder sind erforderlich.' })
    }
    await prisma.clubISBJConfig.create({
      data: {
        clubId: club.id,
        host: host ?? 'ds.traegerportal.isbj.verwalt-berlin.de',
        username,
        traegerNummer,
        einrichtungsNummer,
        encryptedApiKey: encrypt(apiKey),
        encryptedCert: encrypt(certPart.data.toString('base64')),
        encryptedCertPass: encrypt(certPassphrase),
      },
    })
  } else {
    await prisma.clubISBJConfig.update({
      where: { clubId: club.id },
      data: {
        ...(host && { host }),
        ...(username && { username }),
        ...(traegerNummer && { traegerNummer }),
        ...(einrichtungsNummer && { einrichtungsNummer }),
        ...(apiKey && { encryptedApiKey: encrypt(apiKey) }),
        ...(certPart && { encryptedCert: encrypt(certPart.data.toString('base64')) }),
        ...(certPassphrase && { encryptedCertPass: encrypt(certPassphrase) }),
      },
    })
  }

  invalidateISBJCache(club.id)
  return { ok: true }
})
