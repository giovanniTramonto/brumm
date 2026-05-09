import { init } from '@paralleldrive/cuid2'

const createId = init({ length: 8 })

function normalizeNamePart(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatBirthDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function generateStorageId(): string {
  return createId()
}

export function buildStorageRef(
  birthDate: Date,
  firstName: string,
  lastName: string,
  storageId: string,
): string {
  const datePart = formatBirthDate(birthDate)
  const firstPart = normalizeNamePart(firstName)
  const lastPart = normalizeNamePart(lastName)
  return `${datePart}-${firstPart}-${lastPart}_${storageId}`
}
