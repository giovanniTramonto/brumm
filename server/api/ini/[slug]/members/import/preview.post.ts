import { prisma } from '~/server/utils/prisma'
import { formatZodError, importPreviewSchema } from '~/server/utils/schemas'
import type { ImportError, ImportResult, ImportRow, ImportRowResult } from '~/types/import'

const MAX_IMPORT = 50

function parseCSV(content: string): string[][] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
}

function isValidDate(value: string): boolean {
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const parsed = importPreviewSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { csvContent } = parsed.data

  const lines = parseCSV(csvContent)
  if (lines.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'CSV leer oder nur Header' })
  }

  const [headerLine, ...dataLines] = lines
  const headers = headerLine.map((h) => h.toLowerCase())

  const getCol = (row: string[], name: string): string => row[headers.indexOf(name)] ?? ''

  const validGroups = await prisma.group.findMany({
    where: { clubId: club.id },
    select: { id: true },
  })
  const validGroupIds = new Set(validGroups.map((g) => g.id))

  const allEmails = new Set<string>()
  const existingEmails = await prisma.userEmail.findMany({ select: { email: true } })
  const dbEmails = new Set(existingEmails.map((e) => e.email))

  const rows: ImportRowResult[] = []
  let importable = 0
  let skipped = 0

  const dataToParse = dataLines.slice(0, MAX_IMPORT + 1)

  for (let i = 0; i < dataToParse.length; i++) {
    const row = dataToParse[i]
    const rowIndex = i + 2
    const errors: ImportError[] = []

    const parsed: ImportRow = {
      firstName: getCol(row, 'firstname'),
      lastName: getCol(row, 'lastname'),
      birthDate: getCol(row, 'birthdate'),
      guardian1Name: getCol(row, 'guardian1name'),
      guardian2Name: getCol(row, 'guardian2name') || undefined,
      email1: getCol(row, 'email1'),
      email2: getCol(row, 'email2') || undefined,
      groupId: getCol(row, 'groupid') || undefined,
      rowIndex,
    }

    if (!parsed.firstName)
      errors.push({
        rowIndex,
        field: 'firstName',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Vorname fehlt',
      })
    if (!parsed.lastName)
      errors.push({
        rowIndex,
        field: 'lastName',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Nachname fehlt',
      })
    if (!parsed.birthDate)
      errors.push({
        rowIndex,
        field: 'birthDate',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Geburtsdatum fehlt',
      })
    else if (!isValidDate(parsed.birthDate))
      errors.push({
        rowIndex,
        field: 'birthDate',
        code: 'INVALID_DATE',
        message: 'Ungültiges Datum (erwartet: YYYY-MM-DD)',
      })
    if (!parsed.email1)
      errors.push({
        rowIndex,
        field: 'email1',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'E-Mail (Elternteil 1) fehlt',
      })
    else if (!isValidEmail(parsed.email1))
      errors.push({
        rowIndex,
        field: 'email1',
        code: 'INVALID_EMAIL',
        message: 'Ungültige E-Mail-Adresse',
      })
    else if (
      dbEmails.has(parsed.email1.toLowerCase()) ||
      allEmails.has(parsed.email1.toLowerCase())
    )
      errors.push({
        rowIndex,
        field: 'email1',
        code: 'DUPLICATE_EMAIL',
        message: 'E-Mail bereits vorhanden',
      })

    if (parsed.email2) {
      if (!isValidEmail(parsed.email2))
        errors.push({
          rowIndex,
          field: 'email2',
          code: 'INVALID_EMAIL',
          message: 'Ungültige zweite E-Mail-Adresse',
        })
      else if (
        dbEmails.has(parsed.email2.toLowerCase()) ||
        allEmails.has(parsed.email2.toLowerCase())
      )
        errors.push({
          rowIndex,
          field: 'email2',
          code: 'DUPLICATE_EMAIL',
          message: 'Zweite E-Mail bereits vorhanden',
        })
    }

    if (parsed.groupId && !validGroupIds.has(parsed.groupId)) {
      errors.push({
        rowIndex,
        field: 'groupId',
        code: 'GROUP_NOT_FOUND',
        message: 'Gruppe nicht gefunden',
      })
    }

    if (errors.length === 0) {
      allEmails.add(parsed.email1.toLowerCase())
      if (parsed.email2) allEmails.add(parsed.email2.toLowerCase())
      importable++
    } else {
      skipped++
    }

    rows.push({
      rowIndex,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      isImportable: errors.length === 0,
      errors,
    })
  }

  const result: ImportResult = {
    total: rows.length,
    importable,
    skipped,
    rows,
  }

  return result
})
