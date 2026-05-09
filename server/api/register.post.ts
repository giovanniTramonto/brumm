import { prisma } from "~/server/utils/prisma"
import { generateSlug, normalizeSlug } from "~/server/utils/slug"
import { registerSchema, formatZodError } from "~/server/utils/schemas"

const RESERVED_SLUGS = new Set(["ini"])

export default defineEventHandler(async (event) => {
  const parsed = registerSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { name, slug: customSlug } = parsed.data
  const slug = customSlug ? normalizeSlug(customSlug) : await generateSlug(name)

  if (RESERVED_SLUGS.has(slug)) {
    throw createError({ statusCode: 409, statusMessage: `"${slug}" ist ein reservierter Name` })
  }

  const existing = await prisma.club.findUnique({ where: { slug } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: "Dieser Slug ist bereits vergeben" })
  }

  const club = await prisma.club.create({
    data: { name: name.trim(), slug },
  })

  return { club }
})
