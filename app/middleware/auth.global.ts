import { useAuthStore } from '../stores/auth'

// 全局路由守卫：除 /login 外都需要登录。
// 服务端用 useRequestFetch 携带 Cookie 恢复会话，使页面中间件（如 admin）
// 在 SSR 阶段也能拿到身份并正确放行 / 拦截，消除权限页刷新闪现。
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const auth = useAuthStore()
  if (!auth.user) {
    // 服务端转发原始 Cookie；客户端即普通 $fetch。
    // 经 unknown 断言摘掉 useRequestFetch 的路由级类型：Nuxt 生成的 typed-routes
    // 在该处实例化会触发 TS2321（Excessive stack depth），且此处并不需要字面路由类型。
    const requestFetch = (useRequestFetch as unknown as () => unknown)()
    const ok = await auth.fetchMe(import.meta.server ? (requestFetch as never) : undefined)
    if (!ok) return navigateTo('/login')
  }
})
