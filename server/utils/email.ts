import { Resend } from 'resend'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(key)
}

async function send(...args: Parameters<Resend['emails']['send']>): Promise<void> {
  const resend = getResend()
  const { error } = await resend.emails.send(...args)
  if (error) throw new Error(`Resend error: ${error.message}`)
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Jita Vereinsverwaltung <onboarding@resend.dev>'

export async function sendMagicLink(params: {
  to: string
  clubName: string
  clubSlug: string
  token: string
}): Promise<void> {
  const link = `${process.env.APP_URL ?? ''}/ini/${params.clubSlug}/auth/verify/${params.token}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Anmeldung bei ${params.clubName}`,
    html: `
      <h2>Anmeldung bei ${params.clubName}</h2>
      <p>Klicke auf den folgenden Link, um dich anzumelden. Der Link ist 15 Minuten gültig.</p>
      <p><a href="${link}">Jetzt anmelden</a></p>
      <p>Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>
    `,
  })
}

export async function sendWelcomeEmail(params: {
  to: string
  clubName: string
  clubSlug: string
  token: string
}): Promise<void> {
  const link = `${process.env.APP_URL ?? ''}/ini/${params.clubSlug}/auth/verify/${params.token}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Willkommen bei Jita – ${params.clubName} einrichten`,
    html: `
      <h2>Willkommen bei Jita!</h2>
      <p>Dein Verein <strong>${params.clubName}</strong> wurde registriert.</p>
      <p>Klicke auf den folgenden Link, um die Einrichtung abzuschließen. Der Link ist 24 Stunden gültig.</p>
      <p><a href="${link}">Einrichtung starten</a></p>
      <p>Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>
    `,
  })
}

export async function sendInviteEmail(params: {
  to: string
  clubName: string
  clubSlug: string
  token: string
  childName: string
}): Promise<void> {
  const link = `${process.env.APP_URL ?? ''}/ini/${params.clubSlug}/auth/verify/${params.token}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Einladung: ${params.childName} bei ${params.clubName}`,
    html: `
      <h2>Willkommen bei ${params.clubName}!</h2>
      <p>Ihr Kind <strong>${params.childName}</strong> wurde angemeldet.</p>
      <p>Bitte klicken Sie auf den folgenden Link, um Ihr Profil einzurichten. Der Link ist 7 Tage gültig.</p>
      <p><a href="${link}">Profil einrichten</a></p>
    `,
  })
}

export async function sendSuperUserNotification(params: {
  to: string[]
  clubName: string
  childName: string
  clubSlug: string
  userId: string
}): Promise<void> {
  const link = `${process.env.APP_URL ?? ''}/ini/${params.clubSlug}/members/${params.userId}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Neues Kind wartet auf Freischaltung: ${params.childName}`,
    html: `
      <h2>Neues Kind bei ${params.clubName}</h2>
      <p><strong>${params.childName}</strong> hat das Onboarding abgeschlossen und wartet auf Freischaltung.</p>
      <p><a href="${link}">Kind freischalten</a></p>
    `,
  })
}

export async function sendActivationEmail(params: {
  to: string[]
  clubName: string
  childName: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `${params.childName} wurde freigeschaltet – ${params.clubName}`,
    html: `
      <h2>Freischaltung bestätigt</h2>
      <p><strong>${params.childName}</strong> wurde erfolgreich bei <strong>${params.clubName}</strong> freigeschaltet.</p>
      <p>Wir freuen uns auf eine schöne gemeinsame Zeit!</p>
    `,
  })
}

export async function sendDeactivationConfirmation(params: {
  to: string[]
  clubName: string
  childName: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Abmeldung bestätigt: ${params.childName}`,
    html: `
      <h2>Abmeldung bei ${params.clubName}</h2>
      <p><strong>${params.childName}</strong> wurde erfolgreich vom Verein abgemeldet.</p>
      <p>Gemäß DSGVO werden alle persönlichen Daten nach einem Jahr vollständig gelöscht.</p>
    `,
  })
}

export async function sendImportSummary(params: {
  to: string[]
  clubName: string
  succeeded: number
  failed: number
  total: number
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `CSV-Import abgeschlossen: ${params.clubName}`,
    html: `
      <h2>Import-Zusammenfassung für ${params.clubName}</h2>
      <p>Der CSV-Import wurde abgeschlossen:</p>
      <ul>
        <li>Gesamt: ${params.total}</li>
        <li>Erfolgreich: ${params.succeeded}</li>
        <li>Fehlgeschlagen: ${params.failed}</li>
      </ul>
    `,
  })
}
