import { init } from "@paralleldrive/cuid2"
import { prisma } from "~/server/utils/prisma"

const createId = init({ length: 4 })

export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function generateSlug(name: string): Promise<string> {
  const base = normalizeSlug(name)
  let candidate = base

  const existing = await prisma.club.findUnique({ where: { slug: candidate } })
  if (!existing) return candidate

  candidate = `${base}-${createId()}`
  return candidate
}
