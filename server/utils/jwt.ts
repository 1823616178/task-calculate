import jwt from 'jsonwebtoken'
import type { UserRole } from '../../shared/types'

export interface AuthTokenPayload {
  userId: number
  username: string
  role: UserRole
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  // 已知默认密钥意味着任何人都能伪造管理员 token：生产环境缺少 JWT_SECRET 时拒绝启动
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
  return 'dev-secret-change-me'
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
