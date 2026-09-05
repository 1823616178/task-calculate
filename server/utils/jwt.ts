import jwt from 'jsonwebtoken'
import type { UserRole } from '../../shared/types'

export interface AuthTokenPayload {
  userId: number
  username: string
  role: UserRole
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-me'
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '24h' })
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getSecret()) as AuthTokenPayload
  }
  catch {
    return null
  }
}
