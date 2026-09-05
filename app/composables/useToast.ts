// Toast 反馈：右上角堆叠，success/error/warning/info，自动消失且可悬停暂停。
// 用法：const toast = useToast(); toast.success('已保存') / toast.error(msg)

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout>
  remaining: number
  startedAt: number
}

const MAX_STACK = 5
const DEFAULT_DURATION = 3400

// 模块级单例状态（仅客户端事件会写入）
const toasts = reactive<ToastItem[]>([])
const timers = new Map<number, ToastTimer>()
let seq = 0

function dismiss(id: number) {
  const i = toasts.findIndex(t => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer.timeoutId)
    timers.delete(id)
  }
}

function schedule(id: number, duration: number) {
  timers.set(id, {
    remaining: duration,
    startedAt: Date.now(),
    timeoutId: setTimeout(() => dismiss(id), duration),
  })
}

function show(message: string, type: ToastType = 'info', duration: number = DEFAULT_DURATION): number {
  if (!import.meta.client || !message) return -1
  // 超出堆叠上限时移除最早的一条
  while (toasts.length >= MAX_STACK) {
    dismiss(toasts[0].id)
  }
  const id = ++seq
  toasts.push({ id, type, message })
  schedule(id, duration)
  return id
}

export function useToast() {
  return {
    toasts,
    show,
    success: (msg: string, duration?: number) => show(msg, 'success', duration),
    error: (msg: string, duration?: number) => show(msg, 'error', duration),
    warning: (msg: string, duration?: number) => show(msg, 'warning', duration),
    info: (msg: string, duration?: number) => show(msg, 'info', duration),
    dismiss,
    // 悬停暂停 / 离开恢复（保证剩余时间不少于 600ms）
    pause(id: number) {
      const timer = timers.get(id)
      if (!timer) return
      clearTimeout(timer.timeoutId)
      timer.remaining = Math.max(600, timer.remaining - (Date.now() - timer.startedAt))
    },
    resume(id: number) {
      const timer = timers.get(id)
      if (!timer) return
      schedule(id, timer.remaining)
    },
  }
}

export type UseToastReturn = ReturnType<typeof useToast>
