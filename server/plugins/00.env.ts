import { getJwtSecret } from '../utils/jwt'

// 00 开头最先执行：生产环境缺少 JWT_SECRET 时直接中止启动，而不是运行后全部请求 401/500
export default defineNitroPlugin(() => {
  getJwtSecret()
})
