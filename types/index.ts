export type Role = "SUPERUSER" | "TEAM" | "MEMBER"
export type Storage = "GOOGLE_DRIVE" | "S3" | "R2"

export interface GoogleDriveConfig {
  serviceAccountEmail: string
  serviceAccountKey: string
  rootFolderId: string
  appFolderId: string
  membersFolderId: string
  masterSheetId: string
}

export interface S3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
}

export type StorageConfig = GoogleDriveConfig | S3Config

export interface Club {
  id: string
  slug: string
  name: string
  storageType: Storage | null
  storageConfig: StorageConfig | null
  isSetupRequested: boolean
  isSetupDone: boolean
  createdAt: string
}

export interface Group {
  id: string
  clubId: string
  name: string
  email: string | null
  createdAt: string
}

export interface User {
  id: string
  clubId: string
  role: Role
  isActive: boolean
  storageRef: string | null
  firstName: string
  lastName: string
  birthDate: string
  guardian1Name: string | null
  guardian2Name: string | null
  groupId: string | null
  deactivatedAt: string | null
  deactivatedBy: string | null
  createdAt: string
  group?: Group | null
  emails?: UserEmail[]
}

export interface UserEmail {
  id: string
  userId: string
  email: string
  isPrimary: boolean
  createdAt: string
}

export interface Session {
  id: string
  userId: string
  clubId: string
  token: string
  expiresAt: string
  createdAt: string
}

export interface MagicLink {
  id: string
  userId: string
  token: string
  expiresAt: string
  isUsed: boolean
  createdAt: string
}

export interface Invite {
  id: string
  clubId: string
  userId: string
  token: string
  expiresAt: string
  isUsed: boolean
  createdAt: string
}

export interface AuthUser extends User {
  emails: UserEmail[]
  group: Group | null
}

export type UserWithDateStrings = Omit<User, 'birthDate' | 'deactivatedAt' | 'createdAt'> & {
  birthDate: string
  deactivatedAt: string | null
  createdAt: string
}

export interface ApiError {
  statusCode: number
  message: string
}
