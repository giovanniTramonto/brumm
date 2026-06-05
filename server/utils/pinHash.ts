import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(pin, salt, 32)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const computed = (await scryptAsync(pin, salt, 32)) as Buffer
  return timingSafeEqual(hashBuffer, computed)
}
