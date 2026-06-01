import type { Credentials } from 'google-auth-library'
import { getOAuth2Client, protectSheet } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { setupClubStorage } from '~/server/utils/storage/setupClubStorage'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string | undefined
  const stateRaw = query.state as string | undefined
  const errorParam = query.error as string | undefined

  let state: { clubId: string; slug: string; parentId?: string } | null = null
  try {
    if (stateRaw) state = JSON.parse(stateRaw)
  } catch {
    // ignore parse errors
  }

  if (errorParam) {
    const slug = state?.slug
    if (slug) {
      return sendRedirect(
        event,
        `/ini/${slug}/settings/onboarding?error=${encodeURIComponent(errorParam)}`,
      )
    }
    throw createError({ statusCode: 403, statusMessage: errorParam })
  }

  if (!code || !state) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Callback-Parameter' })
  }

  const oauth2Client = getOAuth2Client()

  let tokens: Credentials
  try {
    const result = (await oauth2Client.getToken(code)) as unknown as { tokens: Credentials }
    tokens = result.tokens
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token-Austausch fehlgeschlagen'
    console.error('[google/callback] getToken error:', err)
    return sendRedirect(
      event,
      `/ini/${state.slug}/settings/onboarding?error=${encodeURIComponent(message)}`,
    )
  }

  if (!tokens.refresh_token) {
    return sendRedirect(
      event,
      `/ini/${state.slug}/settings/onboarding?error=${encodeURIComponent('Kein Refresh Token erhalten. Bitte erneut verbinden.')}`,
    )
  }

  const oauthTokens: OAuthTokens = {
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? 0,
    token_type: tokens.token_type ?? 'Bearer',
    scope: tokens.scope ?? '',
  }

  const club = await prisma.club.findUnique({ where: { id: state.clubId } })
  if (!club) {
    throw createError({ statusCode: 404, statusMessage: 'Verein nicht gefunden' })
  }

  if (club.isSetupDone) {
    // Reconnect: nur Token aktualisieren, Ordnerstruktur bleibt
    await prisma.club.update({
      where: { id: club.id },
      data: { oauthToken: oauthTokens as object },
    })

    const config = club.storageConfig as unknown as GoogleDriveConfig
    const sheetIds = [config.membersSheetId, config.managersSheetId, config.groupsSheetId].filter(
      (id): id is string => !!id,
    )
    const results = await Promise.allSettled(
      sheetIds.map((spreadsheetId) => protectSheet({ tokens: oauthTokens, spreadsheetId })),
    )
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error(`[protectSheet] ${sheetIds[i]} failed:`, result.reason)
      }
    }

    return sendRedirect(event, `/ini/${state.slug}/settings?reconnected=1`)
  }

  try {
    await setupClubStorage({
      clubId: club.id,
      clubName: club.name,
      tokens: oauthTokens,
      parentId: state.parentId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[google/callback] setupClubStorage error:', err)
    return sendRedirect(
      event,
      `/ini/${state.slug}/settings/onboarding?error=${encodeURIComponent(message)}`,
    )
  }

  return sendRedirect(event, `/ini/${state.slug}/settings/onboarding?success=1`)
})
