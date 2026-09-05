import { useAuthStore } from '../stores/auth'

// admin 页面导航前拦截（配合 definePageMeta({ middleware: 'admin' })），
// 取代此前 onMounted 里 navigateTo 造成"页面闪现后再被踢走"的问题。
// 全局守卫 auth.global 已确保此处拿到已恢复的会话。
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (!auth.isAdmin) {
    return navigateTo('/', { redirectCode: 302 })
  }
})
