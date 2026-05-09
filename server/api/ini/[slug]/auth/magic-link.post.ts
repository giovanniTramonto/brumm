import { prisma } from "~/server/utils/prisma"
import { sendMagicLink } from "~/server/utils/email"
import { magicLinkSchema, formatZodError } from "~/server/utils/schemas"

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const parsed = magicLinkSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { email } = parsed.data

  const userEmail = await prisma.userEmail.findUnique({
    where: { email: email.toLowerCase() },
    include: { user: true },
  })

  if (!userEmail || userEmail.user.clubId !== club.id) {
    return { message: "Falls diese E-Mail bekannt ist, wurde ein Link gesendet" }
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const magicLink = await prisma.magicLink.create({
    data: { userId: userEmail.userId, expiresAt },
  })

  await sendMagicLink({
    to: email,
    clubName: club.name,
    clubSlug: club.slug,
    token: magicLink.token,
  })

  return { message: "Falls diese E-Mail bekannt ist, wurde ein Link gesendet" }
})
