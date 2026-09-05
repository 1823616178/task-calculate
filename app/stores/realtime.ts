import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useDashboardStore } from './dashboard'
import type { MetricUpdateEvent } from '../../shared/types'

// WebSocket 实例不放 state（不可序列化），模块级持有
let ws: WebSocket | null = null
let retryCount = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
// 因认证失败（token 失效）被服务端拒绝时置位，停止自动重连
let authFailed = false

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    connected: false,
    // 用于断线 toast 去重（首次断开提示一次）
    hadDisconnectToast: false,
  }),
  actions: {
    connect() {
      if (!import.meta.client) return
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

      const auth = useAuthStore()
      if (!auth.user) return

      authFailed = false
      // 认证走同源握手自动携带的 httpOnly Cookie，token 不再拼进 URL（防泄漏进访问/代理日志）
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${proto}://${location.host}/ws/dashboard`)
      ws = socket

      socket.onopen = () => {
        retryCount = 0
        this.connected = true
        this.hadDisconnectToast = false
      }
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as { type: string, code?: string, data?: MetricUpdateEvent['data'] }
          if (msg.type === 'error' && msg.code === 'unauthorized') {
            // 会话已过期：停止重连并回到登录页
            authFailed = true
            socket.close()
            return
          }
          if (msg.type === 'metric.update' && msg.data) {
            useDashboardStore().applyMetricUpdate(msg.data)
          }
        }
        catch {
          // 无法解析的帧直接忽略
        }
      }
      socket.onclose = () => {
        if (ws === socket) ws = null
        this.connected = false
        if (authFailed) {
          void useAuthStore().logout()
          return
        }
        // 首次意外断开时提示一次，重连循环不重复轰炸
        if (!this.hadDisconnectToast) {
          this.hadDisconnectToast = true
          try {
            useToast().warning('实时连接已断开，正在自动重连…')
          } catch {
            // Toast 尚未就绪时静默降级
          }
        }
        this.scheduleReconnect()
      }
      socket.onerror = () => {
        socket.close()
      }
    },

    scheduleReconnect() {
      if (!import.meta.client || retryTimer) return
      // 指数退避：1s → 2s → 4s → … 封顶 30s
      const delay = Math.min(30000, 1000 * 2 ** retryCount)
      retryCount += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        this.connect()
      }, delay)
    },

    disconnect() {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      retryCount = 0
      authFailed = false
      ws?.close()
      ws = null
      this.connected = false
    },
  },
})
