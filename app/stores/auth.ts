import { defineStore } from 'pinia'
import type { AuthUser } from '../types'
import type { ApiPermission } from '../../shared/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    token: '',
  }),
  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    can: state => (permission: ApiPermission) => {
      if (!state.user) return false
      if (state.user.authType === 'user') return state.user.role === 'admin' || permission === 'data:read'
      return state.user.permissions.includes(permission)
    },
  },
  actions: {
    async login(username: string, password: string) {
      const res = await $fetch<{ token: string, user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      this.user = res.user
      this.token = res.token
      // 认证统一走 httpOnly Cookie（含 WS 握手）；token 不再持久化到 localStorage，减少 XSS 暴露面
    },

    async loginWithApiKey(apiKey: string) {
      const res = await $fetch<{ token: null, user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { apiKey },
      })
      this.user = res.user
      this.token = ''
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
      this.user = null
      this.token = ''
      await navigateTo('/login')
    },

    // 页面刷新后恢复会话（Cookie 还在则从服务端取回用户）
    // fetcher：服务端调用时传入 useRequestFetch() 以携带原始请求 Cookie
    async fetchMe(fetcher: typeof $fetch = $fetch): Promise<boolean> {
      try {
        const res = await fetcher<{ user: AuthUser }>('/api/auth/me')
        this.user = res.user
        return true
      }
      catch {
        this.user = null
        return false
      }
    },
  },
})
