import { sendWelcomeEmail } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, registerSchema } from '~/server/utils/schemas'
import { generateSlug, normalizeSlug } from '~/server/utils/slug'

const RESERVED_SLUGS = new Set(['ini'])

export default defineEventHandler(async (event) => {
  const parsed = registerSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, slug: customSlug, email } = parsed.data
  const slug = customSlug ? normalizeSlug(customSlug) : await generateSlug(name)

  if (RESERVED_SLUGS.has(slug)) {
    throw createError({ statusCode: 409, statusMessage: `"${slug}" ist ein reservierter Name` })
  }

  const existing = await prisma.club.findUnique({ where: { slug } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Dieser Slug ist bereits vergeben' })
  }

  const existingEmail = await prisma.club.findFirst({ where: { adminEmail: email.toLowerCase() } })
  if (existingEmail) {
    throw createError({ statusCode: 409, statusMessage: 'E-Mail-Adresse bereits registriert' })
  }

  const club = await prisma.club.create({
    data: { name: name.trim(), slug, adminEmail: email.toLowerCase() },
  })

  const user = await prisma.user.create({
    data: {
      clubId: club.id,
      role: 'SUPERUSER',
    },
  })

  const magicLink = await prisma.magicLink.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  try {
    await sendWelcomeEmail({
      to: email,
      clubName: club.name,
      clubSlug: club.slug,
      token: magicLink.token,
    })
  } catch (err) {
    console.error('Registration email failed:', err)
  }

  return { slug }
})
