import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Vereinsname zu kurz (min. 2 Zeichen)'),
  slug: z.string().min(2).optional(),
  email: z.string().email('Ungültige E-Mail-Adresse'),
})

export const magicLinkSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'PIN muss genau 4 Ziffern sein')
    .optional(),
})

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN muss genau 4 Ziffern sein'),
  userId: z.string().optional(),
})

const contractEndField = z
  .string()
  .regex(/^\d{4}$/, 'Vertragsende muss ein Jahr sein (YYYY)')
  .optional()
  .or(z.literal(''))

const guardianRefinement = (
  data: { guardian2Name?: string; email1?: string; email2?: string },
  ctx: z.RefinementCtx,
) => {
  if (data.guardian2Name?.trim() && !data.email2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'E-Mail-Adresse (Elternteil 2) fehlt',
      path: ['email2'],
    })
  }
  if (data.email1 && data.email2 && data.email1 === data.email2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Elternteil 1 und 2 dürfen nicht die gleiche E-Mail-Adresse haben',
      path: ['email2'],
    })
  }
}

export const createMemberSchema = z
  .object({
    firstName: z.string().min(1, 'Vorname fehlt'),
    lastName: z.string().min(1, 'Nachname fehlt'),
    birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Geburtsdatum'),
    guardian1Name: z.string().min(1, 'Erziehungsberechtigter 1 fehlt'),
    guardian2Name: z.string().optional(),
    email1: z.string().email('Ungültige E-Mail-Adresse (Elternteil 1)'),
    email2: z
      .string()
      .email('Ungültige E-Mail-Adresse (Elternteil 2)')
      .optional()
      .or(z.literal('')),
    phone1: z.string().optional().or(z.literal('')),
    phone2: z.string().optional().or(z.literal('')),
    groupId: z.string().optional(),
    careType: z.string().optional(),
    surcharges: z.array(z.string()).optional(),
    contractEnd: contractEndField,
    address: z.string().optional().or(z.literal('')),
    sendInvite: z.boolean().default(true),
  })
  .superRefine(guardianRefinement)

export const updateMemberSchema = z
  .object({
    firstName: z.string().min(1, 'Vorname fehlt'),
    lastName: z.string().min(1, 'Nachname fehlt'),
    birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Geburtsdatum'),
    guardian1Name: z.string().min(1, 'Erziehungsberechtigter 1 fehlt'),
    guardian2Name: z.string().optional(),
    email1: z.string().email('Ungültige E-Mail-Adresse (Elternteil 1)'),
    email2: z
      .string()
      .email('Ungültige E-Mail-Adresse (Elternteil 2)')
      .optional()
      .or(z.literal('')),
    phone1: z.string().optional().or(z.literal('')),
    phone2: z.string().optional().or(z.literal('')),
    groupId: z.string().optional(),
    careType: z.string().optional(),
    surcharges: z.array(z.string()).optional(),
    contractEnd: contractEndField,
    address: z.string().optional().or(z.literal('')),
    lastEditedAt: z.string().optional().nullable(),
  })
  .superRefine(guardianRefinement)

export const createParentJobSchema = z.object({
  name: z.string().min(1, 'Name fehlt'),
})

export const addParentJobMemberSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  tasks: z.string().nullable().optional(),
  isLeader: z.boolean().optional().default(false),
})

export const updateParentJobMemberSchema = z.object({
  isLeader: z.boolean().optional(),
  tasks: z.string().nullable().optional(),
})

export const createGroupSchema = z.object({
  name: z.string().min(2, 'Gruppenname zu kurz'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
})

export const updateGroupSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
})

export const createManagerSchema = z.object({
  name: z.string().min(1, 'Name fehlt'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  isMemberManager: z.boolean().optional().default(false),
})

export const updateManagerSchema = z.object({
  name: z.string().min(1, 'Name fehlt').optional(),
  email: z.string().email('Ungültige E-Mail-Adresse').optional(),
  isMemberManager: z.boolean().optional(),
})

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Name fehlt'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
})

export const updateTeamSchema = z.object({
  name: z.string().min(1, 'Name fehlt').optional(),
  email: z.string().email('Ungültige E-Mail-Adresse').optional(),
})

export const importPreviewSchema = z.object({
  csvContent: z.string().min(1, 'CSV-Inhalt fehlt'),
})

export const importRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum'),
  guardian1Name: z.string(),
  guardian2Name: z.string().optional(),
  email1: z.string().email(),
  email2: z.string().email().optional().or(z.literal('')),
  groupId: z.string().optional(),
  rowIndex: z.number(),
})

export const importConfirmSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(50, 'Maximal 50 Einträge pro Import'),
})

// Hilfsfunktion: Zod-Fehler in einen lesbaren String umwandeln
export function formatZodError(error: z.ZodError): string {
  return error.errors.map((e) => e.message).join(', ')
}
