export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event) return
    const message = (error as { message?: string })?.message ?? ''
    if (message.includes('invalid_grant')) {
      sendError(
        event,
        createError({
          statusCode: 503,
          statusMessage:
            'Die Verbindung zu Google ist abgelaufen. Bitte über die Einstellungen neu verbinden.',
        }),
      )
    }
  })
})
