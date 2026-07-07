export type Role = 'SUPERUSER' | 'TEAM' | 'MEMBER' | 'MANAGER'
export type MemberStatus = 'PENDING_INVITE' | 'REGISTERED' | 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'

export interface S3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
}

export interface Club {
  id: string
  slug: string
  name: string
  adminEmail: string | null
  membershipFee: number | null
  createdAt: string
}

export interface GroupData {
  groupId: string
  name: string
  email: string | null
}

export interface Group {
  id: string
  name: string
  email: string | null
}

export interface User {
  id: string
  clubId: string
  role: Role
  status: MemberStatus
  isMemberManager: boolean
  storageId: string | null
  deactivatedAt: string | null
  createdAt: string
}

export interface MemberData {
  userId: string
  storageRef: string
  firstName: string
  lastName: string
  birthDate: string
  guardian1Name: string | null
  guardian2Name: string | null
  email1: string
  email2: string | null
  phone1: string | null
  phone2: string | null
  groupId: string | null
  careType: string | null
  surcharges: string[]
  contractEnd: string | null
  lastEditedAt: string | null
  lastEditedBy: string | null
  address: string | null
}

export interface Member extends User {
  firstName: string
  lastName: string
  birthDate: string
  guardian1Name: string | null
  guardian2Name: string | null
  email1: string
  email2: string | null
  phone1: string | null
  phone2: string | null
  groupId: string | null
  careType: string | null
  surcharges: string[]
  storageRef: string
  contractEnd: string | null
  lastEditedAt: string | null
  lastEditedBy: string | null
  address: string | null
  isOwnChild: boolean
  hasInvite: boolean
  hasSubmittedDocuments: boolean
  group?: Group | null
}

export interface ManagerData {
  managerId: string
  storageId: string
  name: string
  email: string
}

export interface Manager {
  id: string
  clubId: string
  storageId: string
  isMemberManager: boolean
  name: string
  email: string
  createdAt: string
}

export interface TeamData {
  teamId: string
  storageId: string
  name: string
  email: string
}

export interface TeamMember {
  id: string
  clubId: string
  storageId: string
  name: string
  email: string
  createdAt: string
}

export interface ParentJobMember {
  id: string
  jobId: string
  email: string
  name: string | null
  phone: string | null
  tasks: string | null
}

export interface ParentJobContact {
  email: string
  type: 'PARENT' | 'MANAGER' | 'ADMIN'
  name: string | null
  phone: string | null
}

export interface ParentJob {
  id: string
  name: string
  icon: string | null
  contact: ParentJobContact | null
  members?: ParentJobMember[]
}

export interface AuthUser extends User {
  firstName?: string | null
  lastName?: string | null
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

export interface ApiError {
  statusCode: number
  message: string
}
