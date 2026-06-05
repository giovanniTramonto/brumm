import { Resend } from 'resend'
import { joinWithAnd } from '~/utils/string'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(key)
}

const DEV_WHITELIST = process.env.DEV_EMAIL_WHITELIST
  ? process.env.DEV_EMAIL_WHITELIST.split(',').map((e) => e.trim().toLowerCase())
  : null

function filterRecipients(to: string | string[]): string[] | null {
  if (!DEV_WHITELIST) return Array.isArray(to) ? to : [to]
  const allowed = (Array.isArray(to) ? to : [to]).filter((e) =>
    DEV_WHITELIST.includes(e.toLowerCase()),
  )
  if (allowed.length === 0) return null
  return allowed
}

async function send(...args: Parameters<Resend['emails']['send']>): Promise<void> {
  const [params] = args
  const recipients = filterRecipients(params.to as string | string[])
  if (!recipients) {
    console.log(
      `[DEV] E-Mail nicht gesendet (kein Empfänger in Whitelist): ${JSON.stringify(params.to)}`,
    )
    return
  }
  const resend = getResend()
  const { error } = await resend.emails.send({ ...params, to: recipients })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Brumm Vereinsverwaltung <onboarding@resend.dev>'

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
    subject: `Willkommen bei Brumm – ${params.clubName} einrichten`,
    html: `
      <h2>Willkommen bei Brumm!</h2>
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
      <p>Dein Kind <strong>${params.childName}</strong> wurde angemeldet.</p>
      <p>Klicke auf den folgenden Link, um dein Profil einzurichten und die Unterlagen hochzuladen. Der Link ist 7 Tage gültig.</p>
      <p><a href="${link}">Profil einrichten</a></p>
      <p>Bitte beachte: Die Betreuung kann erst beginnen, wenn alle erforderlichen Vertragsunterlagen vollständig eingereicht wurden.</p> 
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
  profileUrl: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `${params.childName} wurde freigeschaltet – ${params.clubName}`,
    html: `
      <h2>Anmeldung fertig!</h2>
      <p><strong>${params.childName}</strong> wurde erfolgreich bei <strong>${params.clubName}</strong> freigeschaltet.</p>
      <p>Wir freuen uns auf eine schöne gemeinsame Zeit!</p>
      <p>Alle Infos zum Kind und der Kita findest du unter: <a href="${params.profileUrl}">${params.profileUrl}</a></p>
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

export async function sendReactivationEmail(params: {
  to: string[]
  clubName: string
  childName: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Abmeldung aufgehoben: ${params.childName} – ${params.clubName}`,
    html: `
      <h2>Abmeldung aufgehoben</h2>
      <p>Die Abmeldung von <strong>${params.childName}</strong> bei <strong>${params.clubName}</strong> wurde aufgehoben.</p>
      <p>Das Mitglied ist ab sofort wieder aktiv.</p>
    `,
  })
}

export async function sendManagerAddedEmail(params: {
  to: string
  name: string
  clubName: string
  clubSlug: string
}): Promise<void> {
  const loginLink = `${process.env.APP_URL ?? ''}/login/${params.clubSlug}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Willkommen im Vorstand – ${params.clubName}`,
    html: `
      <h2>Hallo ${params.name},</h2>
      <p>Du wurdest als Vorstandsmitglied bei <strong>${params.clubName}</strong> eingetragen.</p>
      <p><a href="${loginLink}">Hier kannst du dich einloggen</a></p>
      <p>Bei Fragen wende dich an den Admin.</p>
    `,
  })
}

export async function sendManagerRemovedEmail(params: {
  to: string
  name: string
  clubName: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Vorstandsmitglied entfernt – ${params.clubName}`,
    html: `
      <h2>Hallo ${params.name},</h2>
      <p>Du wurdest als Vorstandsmitglied bei <strong>${params.clubName}</strong> entfernt.</p>
    `,
  })
}

export async function sendMemberRemovedEmail(params: {
  to: string[]
  clubName: string
  childName: string
}): Promise<void> {
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `${params.childName} wurde entfernt – ${params.clubName}`,
    html: `
      <h2>Kind entfernt</h2>
      <p><strong>${params.childName}</strong> wurde aus dem System von <strong>${params.clubName}</strong> entfernt.</p>
      <p>Alle gespeicherten Daten wurden gelöscht.</p>
    `,
  })
}

export async function sendEmailRemovedNotification(params: {
  to: string
  clubName: string
  childNames: string[]
}): Promise<void> {
  const nameList = joinWithAnd(params.childNames.map((n) => `<strong>${n}</strong>`))
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `E-Mail-Adresse geändert – ${params.clubName}`,
    html: `
      <p>Diese E-Mail-Adresse ist ab sofort nicht mehr als Kontaktadresse für ${nameList} beim <strong>${params.clubName}</strong> hinterlegt.</p>
      <p>Falls diese Änderung nicht von dir veranlasst wurde oder du Fragen hast, wende dich bitte direkt an den Vereinsadmin.</p>
    `,
  })
}

export async function sendEmailAddedNotification(params: {
  to: string
  clubName: string
  childNames: string[]
  clubSlug: string
}): Promise<void> {
  const loginLink = `${process.env.APP_URL ?? ''}/login/${params.clubSlug}`
  const nameList = joinWithAnd(params.childNames.map((n) => `<strong>${n}</strong>`))
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `E-Mail-Adresse eingetragen – ${params.clubName}`,
    html: `
      <p>Diese E-Mail-Adresse wurde als Kontaktadresse für ${nameList} beim <strong>${params.clubName}</strong> eingetragen.</p>
      <p>Du kannst dich ab sofort mit dieser Adresse anmelden:</p>
      <p><a href="${loginLink}">${loginLink}</a></p>
      <p>Falls diese Änderung nicht von dir veranlasst wurde oder du Fragen hast, wende dich bitte direkt an den Vereinsadmin.</p>
    `,
  })
}

export async function sendPinDeleteLink(params: {
  to: string
  clubName: string
  clubSlug: string
  token: string
}): Promise<void> {
  const link = `${process.env.APP_URL ?? ''}/ini/${params.clubSlug}/auth/verify/${params.token}`
  await send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `PIN löschen – ${params.clubName}`,
    html: `
      <h2>PIN löschen bei ${params.clubName}</h2>
      <p>Du hast angefordert, deinen gespeicherten PIN auf diesem Gerät zu löschen.</p>
      <p>Klicke auf den folgenden Link, um den PIN zu löschen und dich gleichzeitig anzumelden. Der Link ist 15 Minuten gültig.</p>
      <p><a href="${link}">PIN löschen und anmelden</a></p>
      <p>Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
    `,
  })
}

export async function sendDocumentsSubmittedNotification(params: {
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
    subject: `Vertragsunterlagen eingereicht: ${params.childName}`,
    html: `
      <h2>Vertragsunterlagen eingereicht – ${params.clubName}</h2>
      <p><strong>${params.childName}</strong> hat alle Vertragsunterlagen eingereicht und wartet auf Freischaltung.</p>
      <p><a href="${link}">Kind freischalten</a></p>
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
