// 服务端错误信息提取（全站共享，替代各页面重复实现）
interface ServerErrorLike {
  data?: { statusMessage?: string, message?: string }
  statusMessage?: string
  message?: string
}

function pick(e: ServerErrorLike): string {
  return e.data?.statusMessage || e.data?.message || e.statusMessage || e.message || ''
}

export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const msg = pick(err as ServerErrorLike)
    if (msg) return msg
  }
  return fallback
}
