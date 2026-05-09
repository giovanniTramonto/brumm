export interface ImportRow {
  firstName: string
  lastName: string
  birthDate: string
  guardian1Name: string
  guardian2Name?: string
  email1: string
  email2?: string
  groupId?: string
  rowIndex: number
}

export type ImportErrorCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_DATE"
  | "INVALID_EMAIL"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_MEMBER"
  | "GROUP_NOT_FOUND"
  | "LIMIT_EXCEEDED"

export interface ImportError {
  rowIndex: number
  field?: string
  code: ImportErrorCode
  message: string
}

export interface ImportRowResult {
  rowIndex: number
  firstName: string
  lastName: string
  isImportable: boolean
  errors: ImportError[]
}

export interface ImportResult {
  total: number
  importable: number
  skipped: number
  rows: ImportRowResult[]
}

export interface ImportConfirmResult {
  succeeded: number
  failed: number
  errors: Array<{ rowIndex: number; message: string }>
}
